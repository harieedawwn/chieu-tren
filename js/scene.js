/* js/scene.js  (owner TABLE) the play screen, SPEC §5-§12. Needs everything before it in the script order.
 * API  TL.Screens.table = Screen {enter(args), exit(), resize(), update(dt), draw(ctx), pointer(e), key(e)}
 *   enter: uses Game.run (creates one from ?seed if absent). phase 'ban' -> bàn intro -> deal -> turns -> ván end -> next ván | payout.
 *   payout is drawn here (lines count in); then setScreen('shop', {paid:true}) if Screens.shop exists, else the next bàn.
 *   lost / won -> setScreen('end', {result, run}) if Screens.end exists, else a fresh run. ?auto: AI plays seat 0, sets Game.autoResult.
 * Quẻ: two slots on the table's left edge (tap = description + Dùng; Run.useQue; Đổi bài flies cards out/in, Soi bài flips the opponent fan until the hũ is taken, Gấp đôi shows ×2 on the Nhân box, Thêm ván juices the ván counter).
 * First Chặt / Thối heo / Cóng / Tới trắng each show a one-line Tutorial bubble once ever. Flags: ?auto (+ &endless: start already won, play chặng 4, stop).
 * All logic is computed first (Rules/Scoring/Run); the result is played back through FX.queue; input is locked while it is busy.
 */
(function (TL) {
  'use strict';
  const CFG = TL.CFG, M = CFG.MOTION, D = TL.DATA, T = D.TEXT, C = TL.Cards, RU = TL.Rules, S = TL.Scoring, FX = TL.FX, SP = TL.Sprite, A = TL.Art, PAL = CFG.PAL;
  // timings (s, before the speed divisor) and look constants
  const K = { think: [0.4, 0.9], intro: 1.5, introHouse: 0.9, gap: 0.12, slamHold: M.play.hold, vongHold: 0.7, endHold: 0.9, payLine: 0.6, payEnd: 1.0, sweep: 0.45, tipW: 230, tipSize: 11 };
  const Game = () => TL.Game, snd = (n, o) => { try { TL.Audio && TL.Audio.play(n, o); } catch (e) {} };
  const key = c => c.cards.join(','), ctr = b => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 }), top = b => ({ x: b.x + b.w / 2, y: b.y }), fmt = TL.fmt;
  const TU = () => (TL.Tutorial && TL.Tutorial.on() ? TL.Tutorial : null);                       // the running lesson, if any
  const gateOK = (p, t) => !TL.Tutorial || TL.Tutorial.gate(p, t), tnote = (ev, d) => { const t = TU(); if (t) t.notify(ev, d); };
  const J = { diem: {}, the: {}, pot: {}, diemBan: {}, lixi: {}, van: {}, house: {}, khi: {} };   // juice holders read by the HUD (numbers swell instead of covering popups)

  let run, info, st, r, lk = '', hs = 1, ts = 1, os = 1, vm, cv, shownDB, hand, opp, qnS, groups, ghost, vongPlays, ready, leg, hintList, hintIdx, sortMode, selOk, selMsg, tmsg, tmsgTok = 0;
  let cnt = [0, 0, 0, 0], passedS = [false, false, false, false];   // 4-seat table: cards left per seat, who passed in this vòng
  let khi = TL.Khi.make(), turnT = 0, fin = null;   // Khí thế {lv}; turnT = FX.time when your turn became ready; fin = winning finale {t, skip, slow}
  let pay, tipHover, tipPin, downBtn, hovBtn, dead, rcard = null, ruleSeen = '';   // rcard: boss rule card {t, ...} while it is up
  let queS = [null, null], qr = [], qtip = null, qbtn = null, qdown = false, swapFly = [], soiOn = false;   // Quẻ: sprites, slot rects, pinned slot, Dùng button rect

  // ------------------------------------------------------------ helpers
  function mk(tex, scale, id) { const s = SP.create({ tex: tex, x: 0, y: 0, scale: scale }); s.id = id; return s; }
  function say(m, sec) { tmsg = m; const t = ++tmsgTok; FX.after(sec || 2, () => { if (tmsgTok === t) { tmsg = null; refresh(); } }); refresh(); }
  function first(k) {   // one-line bubble the first time a rule comes up, ever (Tutorial keeps the flag); the queue waits for the tap
    if (Game().flags.auto || !TL.Tutorial) return;
    FX.queue.add(() => { TL.Tutorial.onFirst(k); return 0; }, 0.15); FX.queue.wait(() => !TL.Tutorial.on());
  }
  const selIds = () => hand.filter(s => s.selected).map(s => s.id).sort((a, b) => a - b);
  const dbPt = () => ctr(r.dbBox);
  const stampAt = (str, kind) => { const c = ctr(r.table); FX.stamp(str, kind, c.x, c.y); };
  const KHI = () => CFG.KHI;
  function setKhi(changed, fromLv) {   // apply the level everywhere; juice + rising drum roll when it went up
    FX.khi = khi.lv; if (TL.BG) TL.BG.setKhi(khi.lv); vm.khi = khi.lv;
    if (!changed) return;
    FX.juice(J.khi, 1.2); if (khi.lv > fromLv) { snd('khi', { pitch: KHI().tick[khi.lv] }); if (TL.BG) TL.BG.pulse(0.5); }
  }
  function khiDo(fn) { const was = khi.lv, ch = fn(khi); setKhi(ch, was); }
  const tickSnd = (n, i) => { const lv = khi.lv; snd(n, { pitch: FX.tickPitch(i) * KHI().tick[lv] }); if (KHI().drum[lv] > 0) snd('bass', { vol: KHI().drum[lv] }); };
  const dim = (s, a, b) => { s.scale = a; s.V.sx = s.V.sy = b / a; };       // new scale, springs in from the old size
  const canAct = () => ready && !dead && !rcard && !pay && st && !st.over && !FX.queue.busy() && !Game().flags.auto && vm.turn === 0 && !Game().overlay;

  const four = () => !!info && info.seats === 4;
  const kinName = id => D.HOUSE_RULES[id] ? D.HOUSE_RULES[id].name : id;
  const seatBox = seat => four() ? r.chips[seat - 1] : null;
  const seatCtr = seat => four() ? ctr(seatBox(seat)) : ctr(r.oppPlate);
  const seatTop = seat => four() ? top(seatBox(seat)) : top(r.oppHand);
  function seatVm() {   // chip data for the three AI seats
    if (!four()) { vm.seats = 2; vm.seatInfo = null; return; }
    const ids = [info.opp].concat(info.kin), names = [info.name].concat(info.kin.map(kinName)), heoOk = S.slotOf(run, 'co_hang_xom') >= 0;
    vm.seats = 4; vm.seatInfo = [1, 2, 3].map(k => ({ seat: k, id: ids[k - 1], name: names[k - 1], count: cnt[k], passed: passedS[k], heo: heoOk && st ? st.hands[k].filter(C.isHeo).length : null }));
  }
  function buildVm() {
    const hr = info.house ? D.HOUSE_RULES[info.house] : null;
    vm = { chang: { idx: run.chang, name: info.changName }, x2: !!run.flags.x2Next, ban: { idx: run.ban, kind: info.kind, name: info.name }, target: info.target, diemBan: 0, pot: 0, combo: null, diem: 0, the: 0,
      vanLeft: info.vanLeft, vanMax: info.vanMax, lixi: run.money, oppId: info.opp, oppName: info.name, house: hr ? { name: hr.name, quote: hr.quote, short: hr.short } : null,
      oppCount: 0, oppHeo: null, oppReveal: [], deckLeft: 52, qn: [], turn: 0, live: false, vanNo: info.vanUsed + 1, j: J, canPlay: false, canPass: false, busy: true, sortMode: sortMode, msg: null, flames: false, khi: 0, seats: 2, seatInfo: null };
  }
  function qnCopy() { return run.qn.map((q, i) => ghost[i] || (q ? { id: q.id, n: q.n } : null)); }
  function sync() {
    vm.pot = Math.round(cv.pot); vm.diemBan = Math.round(cv.diemBan); vm.lixi = Math.round(cv.lixi); vm.diem = Math.round(cv.diem); vm.the = Math.round(cv.the * 10) / 10;
    vm.flames = !!st && (cv.pot >= info.target || khi.lv >= KHI().FLAME_AT); vm.khi = khi.lv; vm.qn = qnCopy(); vm.oppCount = four() ? Math.min(cnt[1], cnt[2], cnt[3]) : opp.length; seatVm(); vm.sortMode = sortMode;
    vm.oppHeo = four() ? null : S.slotOf(run, 'co_hang_xom') >= 0 ? opp.filter(s => C.isHeo(s.id)).length : null;
    vm.oppReveal = st ? (st.peek || []).filter(id => opp.some(s => s.id === id)) : [];
    vm.busy = !!FX.queue.busy() || !ready || !!pay || !st || st.over; vm.canPlay = selOk && canAct(); vm.canPass = !!(leg && leg.canPass) && canAct();
    vm.doiLeft = run.doi || 0; vm.canDoi = !!st && !st.over && !st.table && vm.turn === 0 && run.doi > 0 && selIds().length >= 1 && selIds().length <= CFG.QUE.DOI_MAX && canAct(); vm.suc = st ? run.van.suc : 0;
    vm.x2 = !!run.flags.x2Next; vm.msg = tmsg || selMsg; vm.hoverBtn = hovBtn; vm.downBtn = downBtn;
  }
  function clearScore() { cv.diem = cv.the = 0; vm.combo = null; }

  // ------------------------------------------------------------ layout
  function relayout() {
    const G = Game(), k = G.w + 'x' + G.h + 'x' + G.dpr;
    if (k === lk && r) return;
    lk = k; r = TL.HUD.layout(G.w, G.h, G.safe);
    hs = TL.HUD.scaleFor(r.cardH, G.dpr); ts = TL.HUD.scaleFor(r.tableCardH * 1.08, G.dpr); os = TL.HUD.scaleFor(r.oppCardH, G.dpr);
    hand.forEach(s => { s.scale = hs; }); opp.forEach(s => { s.scale = os; });
    groups.forEach(g => g.list.forEach(s => { s.scale = ts; }));
    qnS.forEach((s, i) => { if (s) placeQn(s, i); });
    queLayout(); queS.forEach((s, i) => { if (s) placeQue(s, i); });
    fanHand(0); fanOpp(0); groups.forEach(g => SP.fan(g.list, tableRect(g.k), { overlap: 0.35, curve: 0 }));
  }
  function placeQn(s, i) { const b = r.qnSlot[i]; s.scale = TL.HUD.scaleFor(b.h, Game().dpr); s.sway = false; const c = ctr(b); s.T.x = s.V.x = c.x; s.T.y = s.V.y = c.y; s._sp.x.x = c.x; s._sp.y.x = c.y; }
  const fanHand = dur => SP.fan(hand, r.hand, { dur: dur });
  const fanOpp = dur => SP.fan(opp, r.oppHand, { overlap: 0.5, curve: 0.6, dur: dur });
  function tableRect(k) { const p = r.tablePlay, dx = ((k % 3) - 1) * p.w * 0.05, dy = (k % 2 ? 1 : -1) * p.h * 0.04; return { x: p.x + dx, y: p.y + dy, w: p.w, h: p.h }; }
  // Quẻ rail: two slots on the left edge of the table (stacked when the table is tall enough, else side by side), under the played cards
  function queLayout() { qr = r.queSlot.slice(); }   // Quẻ slots live beside the Quý nhân row (HUD.layout), never over the table
  function placeQue(s, i) { const b = qr[i], c = ctr(b); s.scale = TL.HUD.scaleFor(b.h, Game().dpr); s.sway = false; s.T.x = s.V.x = c.x; s.T.y = s.V.y = c.y; s._sp.x.x = c.x; s._sp.y.x = c.y; }
  function buildQue() { queS = run.que.map((q, i) => { if (!q) return null; const s = mk(A.que(q), 1, q); placeQue(s, i); return s; }); qtip = null; }
  function buildQn() {
    qnS = run.qn.map((q, i) => { if (!q) return null; const s = mk(A.quyNhan(q.id), 1, q.id); placeQn(s, i); return s; });
  }

  // ------------------------------------------------------------ flow
  function enter() {
    const G = Game();
    if (!G.run) G.run = TL.Run.create(G.flags.seed != null ? G.flags.seed : undefined);
    if (G.flags.auto && G.flags.endless && !G.run.endless) { const x = G.run; x.chang = 2; x.ban = 2; x.phase = 'won'; TL.Run.continueEndless(x); }
    run = G.run; if (TL.Tutorial) TL.Tutorial.attach(run); dead = false; pay = null; rcard = null; ruleSeen = ''; sortMode = G.settings.sort === 'suit' ? 'suit' : 'rank'; ghost = {}; tmsg = selMsg = null; tipHover = tipPin = null; downBtn = hovBtn = null; lk = '';
    hand = []; opp = []; qnS = []; groups = []; st = null; ready = false; leg = null; selOk = false; vongPlays = 0; khi = TL.Khi.make(); fin = null;
    cv = { pot: 0, diemBan: 0, diem: 0, the: 0, lixi: run.money, juiceTargets: J }; shownDB = 0; info = TL.Run.ban(run); buildVm(); FX.reset(); relayout(); buildQn(); buildQue(); swapFly = []; soiOn = false;
    if (run.phase === 'payout') return showPay();
    if (run.phase === 'shop') return leave();
    if (run.phase === 'won' || run.phase === 'lost') return toEnd(run.phase);
    startBan();
  }
  function openRule(again) { rcard = { again: again, t: again ? 1.2 : 0, rule: info.rule, opp: info.opp, name: info.name }; snd('gong', { vol: 0.8 }); }
  function closeRule() { if (!rcard) return; rcard = null; snd('select'); }
  function ruleSay(m) { return info && info.rule ? info.rule.name + ': ' + m : m; }   // a message caused by the luật nhà names the rule and juices its chip
  function startBan() {
    info = TL.Run.ban(run); cv.lixi = run.money; cv.diemBan = shownDB = run.diemBan; buildVm(); buildQn(); buildQue(); sweepAll(true); st = null; ready = false; soiOn = false;
    khi = TL.Khi.make(); fin = null; FX.timeScale = 1; FX.zoom = 1; setKhi(false, 0);
    if (TL.BG) TL.BG.setMood(info.giaoThua ? 'giao_thua' : info.kind === 'trum' ? (CFG.MOODS[info.opp] ? info.opp : 'boss') : 'ban');
    if (!Game().flags.auto) saveRun();
    const card = run.vanUsed === 0 && info.kind === 'trum' && info.rule && !Game().flags.auto;   // a bàn trùm opens with the rule card instead of two stamps
    if (card) { FX.queue.add(() => { openRule(false); return 0; }, 0.2); FX.queue.wait(() => !rcard); }
    else if (run.vanUsed === 0) {
      FX.queue.add(() => { stampAt(T.kind[info.kind] + ' · ' + info.name, 'gold'); snd(info.kind === 'trum' ? 'gong' : 'stamp'); return K.intro; }, 0.2);
      if (info.rule) FX.queue.add(() => { stampAt(info.rule.name + ': ' + info.rule.quote, 'bad'); snd('stamp'); return K.introHouse; }, 0);
    }
    if (info.kind === 'trum' && run.vanUsed === 0 && TL.Tutorial) { FX.queue.add(() => { TL.Tutorial.onBoss(); return 0; }, 0.1); FX.queue.wait(() => TL.Tutorial.gate('boss')); }
    if (four() && !Game().flags.auto) first(info.giaoThua ? 'giaoThua' : 'sonBon');
    FX.queue.add(startVan, 0.1);
  }
  function startVan() {
    info = TL.Run.ban(run); vm.vanLeft = info.vanLeft; vm.vanNo = info.vanUsed + 1; vm.live = false; sweepAll(true); st = TL.Run.startVan(run, TU() ? TU().vanOpts(run) : undefined); vongPlays = 0; cv.pot = 0; cv.diemBan = shownDB = run.diemBan; clearScore();
    leg = null; ready = false; vm.deckLeft = 52 - info.seats * (four() ? CFG.HAND_SIZE_4 : CFG.HAND_SIZE); cnt = [0, 0, 0, 0]; passedS = [false, false, false, false]; process(st.log.slice());
  }
  function process(evs) {
    const steps = evs.map(e => S.onEvent(run, e));
    TL.Run.record(run, evs);
    evs.forEach(e => { if (e.type === 'vanEnd') { e._bonus = S.vanBonus(run, e); e._res = TL.Run.endVan(run, e); } });
    evs.forEach((e, i) => playEv(e, steps[i]));
  }
  function schedule(seat) {
    const d = K.think[0] + Math.random() * (K.think[1] - K.think[0]);
    FX.queue.add(() => {
      if (dead || !st || st.over) return;
      const scripted = seat === 1 && !four() && TU() ? TU().oppMove(RU.view(st, seat)) : null;
      const m = scripted || TL.AI.choose(RU.view(st, seat), seat >= 1 ? info.aiLevel : 3);
      let evs = m.type === 'play' ? RU.play(st, seat, m.cardIds) : RU.pass(st, seat);
      if (!evs.length) { const l = RU.legal(st, seat); evs = l.canPass ? RU.pass(st, seat) : RU.play(st, seat, l.plays[0].cards); }
      process(evs);
    }, d);
  }
  function act(id) {
    if (!canAct()) return;
    if (TU() && !TU().allowBtn(id)) { TU().nudge(); return; }
    if (id === 'danh') {
      if (!selOk) return;
      const ids = selIds(), think = FX.time - turnT, p = TL.Khi.winProb(hand.map(s => s.id), vm.oppCount); ready = false; const evs = RU.play(st, 0, ids);
      if (evs.length && !Game().flags.auto) khiDo(k => TL.Khi.fast(k, think, p)); if (evs.length) process(evs); else { ready = true; say(T.msg.illegal); }
    } else if (id === 'bo') {
      if (!leg.canPass) { if (!st.table) return; if (st.mods.passMax !== undefined && st.passes[0] >= st.mods.passMax && !st.mods.mustBeat) { say(T.msg.passMax); return; }
      if (st.mods.mustBeat && info.rule) { FX.juice(J.house, 1.2); say(ruleSay(T.msg.mustBeat)); } else say(T.msg.mustBeat); return; }
      ready = false; hand.forEach(s => { s.selected = false; }); process(RU.pass(st, 0));
    } else if (id === 'doi') {
      const res = TL.Run.doiBai(run, st, selIds());
      if (!res.ok) { say(res.msg); snd('button'); return; }
      snd('stamp', { vol: 0.8 }); doSwap(res.events[0]); if (run.van.xau) FX.juice(J.the, 1.1); saveRun();
    } else if (id === 'goiy') hint();
    else if (id === 'menu') Game().setScreen('settings');
  }
  function hint() {
    if (!leg.plays.length) return say(T.msg.hintNone);
    if (!hintList) {
      hintList = leg.plays.slice(); const m = TL.AI.choose(RU.view(st, 0), 3);
      if (m.type === 'play') { const k = m.cardIds.slice().sort((a, b) => a - b).join(','), i = hintList.findIndex(p => key(p) === k); if (i > 0) hintList.unshift(hintList.splice(i, 1)[0]); }
      hintIdx = -1;
    }
    hintIdx = (hintIdx + 1) % hintList.length; const ids = hintList[hintIdx].cards;
    hand.forEach(s => { const on = ids.indexOf(s.id) >= 0; if (on && !s.selected) s.juice(0.5); s.selected = on; }); snd('select'); refresh();
  }
  function xep() {
    const G = Game(); G.settings.sort = G.settings.sort === 'suit' ? 'rank' : 'suit'; G.saveSettings(); applySort(true);
  }
  function applySort(fx) {   // sortMode follows Game.settings.sort (Menu toggle, S key, default for the next deal)
    const want = Game().settings.sort === 'suit' ? 'suit' : 'rank'; if (want === sortMode && !fx) return; sortMode = want; vm.sortMode = sortMode;
    if (!hand || !hand.length) return; const order = C.sortHand(hand.map(s => s.id), sortMode);
    hand.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)); fanHand(0.35); hand.forEach(s => s.juice(0.4)); snd('shuffle');
  }
  function refresh() {   // selection preview: combo name, level, Điểm × Thế only for a legal selection
    const ids = hand ? selIds() : []; selOk = false; selMsg = null; tnote('sel', ids);
    if (!ready || !leg) return;
    if (!ids.length) { ruleSeen = ''; clearScore(); return; }
    const c = C.detect(ids, st.mods);
    let ruled = false;
    if (!c) { ruled = !!(st.mods.sameSuitStraight && C.detect(ids)); selMsg = ruled ? T.msg.sameSuit : T.msg.illegal; }
    else if (!leg.plays.some(p => key(p) === key(c))) {
      ruled = !!(st.table && st.mods.noChat && C.beats(c, st.table.combo, {}) === 'chat') || !!(st.mods.noHeoFinish && C.finishesWithHeo(c, st.hands[0]));
      selMsg = st.table && st.mods.noChat && C.beats(c, st.table.combo, {}) === 'chat' ? T.msg.noChat : st.mods.noHeoFinish && C.finishesWithHeo(c, st.hands[0]) ? T.msg.noHeoFinish : T.msg.cantBeat;
    }
    else { const p = S.preview(run, c); selOk = true; vm.combo = { name: D.COMBO_NAME[c.type], level: p.level }; cv.diem = p.diem; cv.the = p.the; }
    if (ruled && info.rule) { selMsg = ruleSay(selMsg); if (ruleSeen !== selMsg) FX.juice(J.house, 1.2); ruleSeen = selMsg; } else ruleSeen = '';
    if (!selOk) clearScore();
  }

  // ------------------------------------------------------------ event playback (SPEC §10)
  function playEv(e, steps) {
    const Q = FX.queue, P = { sp: {}, target: null, a: { diem: 0, the: 0 } };
    if (e.type === 'deal') Q.add(() => doDeal(e, steps), 0);
    else if (e.type === 'toiTrang') { Q.add(() => { stampAt(T.stamp.toiTrang, 'gold'); snd('gong'); return K.endHold; }, 0.1); first('toiTrang'); }
    else if (e.type === 'turn') Q.add(() => {
      vm.turn = e.seat; clearScore(); hintList = null; tmsg = null;
      if (e.seat >= 1 || Game().flags.auto) schedule(e.seat);
      else { leg = RU.legal(st, 0); ready = true; turnT = FX.time; refresh(); tnote('ready'); }
    }, 0);
    else if (e.type === 'play') {
      if (e.seat === 0 && hand.length === e.combo.cards.length && !Game().flags.auto) Q.add(() => { startFinale(); return 0; }, 0);   // the last card: hit-stop, slow motion, zoom
      Q.add(() => { flyCards(e, P); return M.play.fly; }, 0);
      e.score.steps.forEach((s, i, a) => Q.add(() => step(s, i, e, P), i ? FX.stepGap(a.length) : 0.05));
      Q.add(() => slam(e.score.total, e.pot, e.score.total >= M.bigScore), 0.1);
      Q.add(() => K.slamHold, 0);
      Q.add(() => { tnote('scoreDone', { seat: e.seat, type: 'play' }); return 0; }, 0); Q.wait(() => gateOK('afterScore', 'play'));
    } else if (e.type === 'chat') Q.add(() => {
      FX.counter(cv, 'pot', e.pot, M.counter.dur); FX.popup('×' + e.xPot, top(r.pot).x, top(r.pot).y, 'xthe', { center: true }); FX.shake(FX.shakeFor(e.pot)); snd('mult', { pitch: 1.3 }); return 0.5;
    }, 0.1), Q.add(() => { tnote('scoreDone', { seat: e.seat, type: 'chat' }); return 0; }, 0), Q.wait(() => gateOK('afterScore', 'chat')), first('chat');
    else if (e.type === 'pass') Q.add(() => {
      if (e.seat > 0) { passedS[e.seat] = true; refresh(); } const p = e.seat === 0 ? top(r.hand) : seatTop(e.seat); FX.popup(T.stamp.boLuot, p.x, p.y, 'gold'); snd('button'); steps.forEach(qnFx); return 0.4;
    }, 0);
    else if (e.type === 'vong') { Q.add(() => vong(e, steps), 0.15); Q.wait(() => gateOK('afterVong')); }
    else if (e.type === 'vanEnd') vanEnd(e);
  }
  function qnFx(s) {
    const b = r.qnSlot[s.slot], c = ctr(b), sp = qnS[s.slot];
    if (sp) sp.juice(1);
    if (s.dissolve) {
      ghost[s.slot] = { id: s.ref, n: 0 }; stampAt(s.label, 'bad'); snd('dissolve');
      if (sp) sp.dissolve(M.dissolve.dur, () => { delete ghost[s.slot]; qnS[s.slot] = null; });
    } else if (s.label) FX.popup(s.label, c.x, b.y + b.h * 0.34, s.xThe ? 'xthe' : s.the ? 'the' : 'gold', { center: true });
  }
  function doDeal(e, steps) {
    const d = ctr(r.deck), n = e.hands[0].length, DL = M.deal, G = Game();
    // card k lands on flick k of the riffle cue (same curve as audio 'shuffle'); the cue starts when the first card lands, the last card lands on its closing thud
    const N = n * 2, land = k => (k >= N - 1 ? DL.riffle + 0.03 : DL.riffle * Math.pow(Math.floor(k * DL.flicks / N) / DL.flicks, DL.pow)), lastT = DL.fly + land(N - 1);
    sortMode = G.settings.sort === 'suit' ? 'suit' : 'rank'; vm.live = true; FX.after(DL.fly, () => { snd('deal'); snd('shuffle'); });
    hand = C.sortHand(e.hands[0], sortMode).map(id => mk(A.back(), hs, id)); fanHand(0);
    if (four()) { cnt = e.hands.map(h => h.length); passedS = [false, false, false, false]; opp = []; refresh(); } else { opp = e.hands[1].map(id => mk(A.back(), os, id)); fanOpp(0); }
    hand.forEach((s, i) => s.deal(d, land(i * 2), A.card(s.id)));
    opp.forEach((s, i) => s.deal(d, land(i * 2 + 1), st.peek.indexOf(s.id) >= 0 ? A.card(s.id) : null));
    steps.forEach(s => FX.after(lastT, () => { qnFx(s); snd('mult'); }));
    return lastT + (steps.length ? 0.5 : 0.15);
  }
  function soloUnlock() {   // the first bàn ever won opens Sòng bốn: stamp + a short flourish after the Qua bàn stamp
    if (Game().flags.auto) return;
    let first = false; try { const pr = TL.Profile.get(); first = TL.Profile.noteBan(pr); if (first) TL.Profile.save(pr); } catch (e) { return; }
    if (!first) return;
    FX.queue.add(() => 0, 0.9);
    FX.queue.add(() => { snd('stamp'); stampAt(T.stamp.soloOpen, 'good'); FX.confetti(r.table.x + r.table.w / 2, r.table.y + r.table.h * 0.4, 36); FX.ring(r.table.x + r.table.w / 2, r.table.y + r.table.h / 2, Math.min(r.table.w, r.table.h) * 0.6, 0.6); return 0; }, 1.0);
  }
  function flyCards(e, P) {
    const ids = e.combo.cards, k = vongPlays++;
    let from = e.seat === 0 ? hand : opp;
    if (four() && e.seat > 0) {   // AI cards are not drawn at a 4-seat table: they appear face down at the seat's chip and fly out
      const c = seatCtr(e.seat); cnt[e.seat] -= ids.length; from = ids.map(id => { const sp = mk(A.back(), os, id); sp.T.x = sp.V.x = c.x; sp.T.y = sp.V.y = c.y; sp._sp.x.x = c.x; sp._sp.y.x = c.y; return sp; }); refresh();
    }
    const list = ids.map(id => { const i = from.findIndex(s => s.id === id); return from.splice(i, 1)[0]; });
    P.target = groups.length ? groups[groups.length - 1].list : null;
    groups.push({ list: list, k: k });
    list.forEach(s => { P.sp[s.id] = s; s.selected = false; s.hover = false; dim(s, ts, s.scale); if (e.seat > 0 && s.tex !== A.card(s.id)) s.flip(A.card(s.id), 0.05); });
    SP.fan(list, tableRect(k), { overlap: 0.35, curve: 0, dur: M.play.fly });
    if (e.seat === 0) { fanHand(0.25); selOk = false; selMsg = null; } else fanOpp(0.25);
    ready = false; snd('place'); tnote('played', { seat: e.seat, type: e.combo.type });
    vm.combo = { name: D.COMBO_NAME[e.combo.type], level: e.seat === 0 ? run.sao[e.combo.type] || 1 : 1 }; cv.diem = cv.the = 0;
  }
  const cardTop = sp => ({ x: sp.T.x, y: sp.T.y - (64 * sp.scale / (Game().dpr || 1)) / 2 });   // the target, not the springing visual
  function step(s, i, e, P) {
    const a = P.a, sp = s.kind === 'card' ? P.sp[s.ref] : null, feedsThe = !!(s.xThe || (s.the && !s.diem));
    if (s.kind === 'chat') {
      const at = ctr(r.tablePlay);
      if (e.seat === 0) khiDo(k => TL.Khi.onChat(k, 0)); stampAt(T.stamp.chat, 'gold'); snd('chat'); FX.confetti(at.x, at.y, M.confetti.n); FX.shake(M.shake.max * 0.6); if (TL.BG) TL.BG.pulse(0.6);
      (P.target || []).forEach(t => { if (C.isHeo(t.id)) t.dissolve(M.dissolve.dur, () => {}); }); if (P.target) snd('dissolve');
      return 0.4;
    }
    if (sp) sp.juice(0.8);
    if (s.kind === 'qn') qnFx(Object.assign({}, s, { label: null }));
    // popups start just above the thing they explain and never on a label: cards -> their top edge, Điểm/Thế -> top of that box, Quý nhân -> its art
    if (s.kind === 'base') { const d = top(r.diemBox), t = top(r.theBox); FX.popup('+' + s.diem, d.x, d.y, 'diem', { center: true }); FX.popup('+' + s.the + ' ' + T.hud.the, t.x, t.y, 'the', { center: true }); }
    else if (s.kind === 'card') { const c = sp ? cardTop(sp) : top(r.tablePlay); FX.popup(s.label, c.x, c.y, 'diem'); }
    else if (s.kind === 'qn') { const b = r.qnSlot[s.slot]; FX.popup(s.label, b.x + b.w / 2, b.y + b.h * 0.34, s.xThe ? 'xthe' : feedsThe ? 'the' : 'diem', { center: true }); }
    else { const at = feedsThe ? top(r.theBox) : top(r.diemBox); FX.popup(s.label, at.x, at.y, s.xThe ? 'xthe' : feedsThe ? 'the' : 'diem', { center: true }); }
    a.diem += s.diem || 0; a.the += s.the || 0; if (s.xThe) a.the *= s.xThe;
    FX.counter(cv, 'diem', a.diem, M.counter.dur * 0.6); FX.counter(cv, 'the', a.the, M.counter.dur * 0.6);
    if (s.the || s.xThe) snd('mult', { pitch: FX.tickPitch(i) * KHI().tick[khi.lv] }); else tickSnd('tick', i);
    return 0;
  }
  function slam(total, pot, big) {
    const p = top(r.pot); FX.popup('+' + fmt(total), p.x, p.y, 'gold', { center: true }); FX.counter(cv, 'pot', pot, M.counter.dur); FX.shake(FX.shakeFor(total)); snd('stamp', { vol: 0.7 }); if (big && TL.BG) TL.BG.pulse(1);
    if (KHI().pao[khi.lv] > 0) { snd('pao', { vol: KHI().pao[khi.lv] }); FX.confetti(p.x, p.y + 20, 8 * khi.lv); }
  }
  function vong(e, steps) {
    const w = e.winner, dest = w === 0 ? dbPt() : seatCtr(w), all = []; passedS = [false, false, false, false]; tnote('vong', { winner: w });
    groups.forEach(g => g.list.forEach((s, i) => { all.push(s); s.moveTo(dest.x, dest.y, 0.4, (i - 1) * 6, i * 0.03); }));
    FX.after(K.sweep, () => { all.forEach(s => { s.dead = true; }); });
    if (w === 0) FX.popup('+' + fmt(e.pot), dest.x, dest.y, 'gold', { center: true }); else { const tp = seatTop(w); FX.popup(fmt(e.pot), tp.x, tp.y, 'bad'); } snd('vong'); steps.forEach(s => { qnFx(s); }); khiDo(k => TL.Khi.onVong(k, w));
    if (soiOn) { soiOn = false; opp.forEach(sp => { if (st.peek.indexOf(sp.id) < 0) sp.flip(A.back(), 0); }); }
    FX.counter(cv, 'pot', 0, M.counter.dur); if (w === 0) { shownDB += e.pot; FX.counter(cv, 'diemBan', shownDB, M.counter.dur * 1.5); snd('coin'); }
    vongPlays = 0; return K.vongHold;
  }
  function vanEnd(e) {
    const Q = FX.queue, win = e.winner === 0, b = e._bonus, a = { diem: 0, the: 0 };
    Q.add(() => { ready = false; vm.live = false; tnote('vanEnd'); snd(win ? 'venhat' : 'thua'); if (win && !e.toiTrang) return finale(e); if (!e.toiTrang) stampAt(win ? T.stamp.veNhat : T.stamp.thua, win ? 'good' : 'bad'); return 0.7; }, 0.2);
    if (win && !e.toiTrang) Q.wait(() => !fin || fin.skip || fin.t >= CFG.FINALE.HOLD);
    b.steps.forEach((s, i) => Q.add(() => {
      const tb = top(r.theBox), db = top(r.diemBox);
      if (!(win && s.ref === 'veNhat' && !e.toiTrang)) stampAt(s.label, win ? 'good' : 'bad');
      vm.combo = { name: T.stamp[win ? 'veNhat' : 'thua'], level: 1 };
      if (s.ref === 'veNhat' || s.ref === 'thoi' && s.diem != null) { a.diem = s.diem; a.the = 1; FX.popup((s.diem < 0 ? '' : '+') + s.diem, db.x, db.y, s.diem < 0 ? 'bad' : 'diem', { center: true }); }
      else { a.the = s.xThe; FX.popup('×' + Math.round(s.xThe * 10) / 10, tb.x, tb.y, 'xthe', { center: true }); }
      FX.counter(cv, 'diem', a.diem, M.counter.dur * 0.6); FX.counter(cv, 'the', a.the, M.counter.dur * 0.6); tickSnd(s.xThe ? 'mult' : 'tick', i);
      return 0.5;
    }, K.gap * 3));
    if (e.cong) first('cong'); if (win ? e.heo.slice(1).some(x => x > 0) : e.heo[0] > 0) first('thoi');
    Q.add(() => {
      shownDB = run.diemBan; const p = ctr(r.dbBox); FX.popup((b.total >= 0 ? '+' : '') + fmt(b.total), p.x, p.y, b.total >= 0 ? 'gold' : 'bad', { center: true });
      FX.counter(cv, 'diemBan', shownDB, M.counter.dur * 1.5); FX.shake(FX.shakeFor(Math.abs(b.total))); snd(b.total >= 0 ? 'coin' : 'thua', { vol: 0.7 }); vm.vanLeft = TL.Run.ban(run).vanLeft; return K.endHold;
    }, 0.2);
    Q.wait(() => gateOK('afterVan'));
    Q.add(() => endOfVan(e._res), 0);
  }
  function startFinale() {   // the player's last card is about to fly: hit-stop, slow motion while it flies, zoom into the table
    const F = CFG.FINALE; fin = { t: 0, skip: false, slow: F.SLOW_FOR };
    if (FX.reducedMotion) return;
    FX.hitStop(F.HIT_STOP); FX.timeScale = F.SLOW; FX.tween(FX, { zoom: F.ZOOM }, 0.5, 'out');
  }
  function endFinale() { FX.timeScale = 1; if (FX.zoom !== 1) FX.tween(FX, { zoom: 1 }, 0.3, 'out'); }
  function finale(e) {   // "Về nhất." stamp, shockwave, flash, string of firecrackers and drums; strength follows Khí thế and the cards the opponent still holds
    const F = CFG.FINALE, c = ctr(r.table); if (!fin) fin = { t: 0, skip: false, slow: 0 };
    fin.t = 0; fin.skip = false; fin.slow = 0; FX.timeScale = 1;
    const i = F.BASE_FRAC + (1 - F.BASE_FRAC) * Math.min(1, (khi.lv + Math.max(...e.left.slice(1)) / (four() ? CFG.HAND_SIZE_4 : CFG.HAND_SIZE)) / (KHI().MAX + 1));
    FX.stamp(T.stamp.veNhat, 'good', c.x, c.y, { big: 1.5 + 0.7 * i, hold: F.HOLD });
    for (let k = 0; k < 1 + Math.round(i * (F.RINGS - 1)); k++) FX.ring(c.x, c.y, Math.max(Game().w, Game().h) * (0.35 + 0.2 * i), 0.7, k * 0.18);
    if (i > 0.55) FX.flash(F.FLASH);
    for (let k = 0; k < 2 + Math.round(i * 3); k++) FX.after(k * 0.12, () => FX.confetti(c.x + (k - 2) * 60, c.y, Math.round(M.confetti.n * (0.5 + i))));
    snd('finale', { vol: 0.6 + 0.4 * i }); snd('paoday', { vol: 0.5 + 0.5 * i }); if (TL.BG) TL.BG.pulse(1); FX.shake(M.shake.max * i);
    endFinale(); return 0;
  }
  function endOfVan(res) {
    fin = null; endFinale();
    if (!Game().flags.auto) saveRun();
    if (res === 'next') { sweepAll(false); clearScore(); FX.queue.add(startVan, K.sweep); }
    else if (res === 'cleared') { snd('gong'); stampAt(T.stamp.quaBan, 'gold'); FX.confetti(r.table.x + r.table.w / 2, r.table.y, 50); sweepAll(false); soloUnlock(); FX.queue.add(() => { tnote('cleared'); return 0; }, 0.6); FX.queue.wait(() => gateOK('beforePay')); FX.queue.add(showPay, 0.4); }
    else FX.queue.add(() => toEnd('lost'), 0.3);
  }
  function sweepAll(now) {   // slide every remaining card off (or drop it at once)
    const all = [].concat(hand, opp, ...groups.map(g => g.list)); hand = []; opp = []; groups = [];
    if (now) return;
    all.forEach((s, i) => { s.selected = false; s.moveTo(s.V.x, s.V.y < Game().h / 2 ? -80 : Game().h + 80, K.sweep, 0, i * 0.01); });
    all.forEach(s => FX.after(K.sweep + 0.2, () => { s.dead = true; })); groups = [{ list: all, k: 0 }]; FX.after(K.sweep + 0.25, () => { groups = []; });
  }

  // ------------------------------------------------------------ payout, leaving
  function saveRun() { if (run.phase === 'won' || run.phase === 'lost') return; try { localStorage.setItem(CFG.STORAGE.save, TL.Run.save(run)); } catch (e) {} }
  function showPay() {
    const before = run.paid ? null : run.money, p = TL.Run.payout(run); let money = before != null ? before : run.money - p.total;
    cv.lixi = money; clearScore(); st = null; ready = false; vm.live = false;
    pay = { lines: p.lines.map(l => ({ label: l.label, amount: l.amount, v: 0, on: false })), total: p.total, tv: 0, tOn: false, done: false };
    if (!Game().flags.auto) saveRun();
    pay.lines.forEach(l => FX.queue.add(() => { l.on = true; money += l.amount; FX.counter(l, 'v', l.amount, 0.4); FX.counter(cv, 'lixi', money, 0.4); snd('coin'); return K.payLine; }, 0.25));
    FX.queue.add(() => { pay.tOn = true; FX.counter(pay, 'tv', pay.total, 0.5); snd('coin', { pitch: 1.3 }); pay.done = true; return 0.2; }, 0.2);
    if (Game().flags.auto) FX.queue.add(leave, K.payEnd);
  }
  function leave() {
    pay = null; const G = Game();
    if (run.phase === 'shop') {
      if (TL.Screens && TL.Screens.shop) return G.setScreen('shop', { paid: true, run: run });
      TL.Run.nextBan(run); startBan(); return;
    }
    if (TL.Run.nextBan(run) === 'won' || (Game().flags.auto && Game().flags.endless && run.chang >= 4)) toEnd('won'); else startBan();
  }
  function toEnd(result) {
    const G = Game(); dead = true; try { localStorage.removeItem(CFG.STORAGE.save); } catch (e) {}
    if (G.flags.auto) { G.autoResult = { result: result, stats: run.stats }; try { console.log('autoResult ' + JSON.stringify(G.autoResult)); } catch (e) {} return; }
    if (TL.Screens && TL.Screens.end) return G.setScreen('end', { result: result, run: run });
    stampAt(result === 'won' ? T.end.win : T.end.lose, result === 'won' ? 'gold' : 'bad');
    FX.queue.add(() => { G.run = TL.Run.create(); run = G.run; dead = false; cv.lixi = run.money; startBan(); }, 1.6);
  }

  // ------------------------------------------------------------ input
  function slotAt(x, y) { for (let i = 0; i < r.qnSlot.length; i++) { const b = r.qnSlot[i]; if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h && run.qn[i]) return i; } return null; }
  function payBtn() { const w = Math.min(Game().w - 24, 340), h = 44; return { x: (Game().w - w) / 2 + 20, y: payBox().y + payBox().h - h - 14, w: w - 40, h: h }; }
  function payBox() { const w = Math.min(Game().w - 24, 340), h = 120 + (pay ? pay.lines.length : 0) * 26 + 60; return { x: (Game().w - w) / 2, y: Math.max(8, (Game().h - h) / 2), w: w, h: h }; }
  function pointer(e) {
    if (!r) return;
    const inB = (b, x, y) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
    if (fin && fin.t > 0.2 && fin.t < CFG.FINALE.HOLD + 0.6 && e.type === 'down' && !fin.skip && !fin.slow) { fin.skip = true; FX.skipFinale(); return; }
    if (rcard) { if (e.type === 'down' && rcard.t >= 1.2) closeRule(); return; }
    if (e.type === 'down' && !dead && skipOK() && FX.skipTap()) return;   // tap = fast-forward, second tap = end state
    if (pay) { if (e.type === 'down' && pay.done && inB(payBtn(), e.x, e.y)) leave(); return; }
    if (e.type === 'down' && info.rule && !dead && !Game().overlay && inB(four() ? r.chips[0] : r.oppPlate, e.x, e.y) && !slotAt(e.x, e.y)) { openRule(true); return; }
    if (e.type === 'down' && qtip != null && qbtn && e.x >= qbtn.x && e.x <= qbtn.x + qbtn.w && e.y >= qbtn.y && e.y <= qbtn.y + qbtn.h) { qdown = true; snd('button'); return; }
    if (e.type === 'up' && qdown) { qdown = false; if (qtip != null && qbtn && e.x >= qbtn.x && e.x <= qbtn.x + qbtn.w && e.y >= qbtn.y && e.y <= qbtn.y + qbtn.h) useQueUI(qtip); return; }
    if (e.type === 'move') { tipHover = slotAt(e.x, e.y); const id = TL.HUD.hit(r, e.x, e.y); hovBtn = id; SP.hover(hand, canAct() ? e.x : null, e.y); return; }
    if (e.type === 'down') {
      const qi = queAt(e.x, e.y); if (qi != null) { qtip = qtip === qi ? null : qi; tipPin = null; snd('select'); return; }
      if (qtip != null) { const q = qtipRect(); if (q && e.x >= q.x && e.x <= q.x + q.w && e.y >= q.y && e.y <= q.y + q.h) return; qtip = null; }
      const sl = slotAt(e.x, e.y); tipPin = sl != null && tipPin !== sl ? sl : null; if (sl != null) { tipHover = sl; return; }
      const id = TL.HUD.hit(r, e.x, e.y); if (id) { downBtn = id; snd('button'); return; }
      if (vm.live && vm.suc && r._suc && inB(r._suc, e.x, e.y) && !SP.pick(hand, e.x, e.y)) { say(T.hud.sucTip[vm.suc].replace('%s', CFG.XAU_X), 2.6); snd('select'); return; }
      if (!canAct()) return; const s = SP.pick(hand, e.x, e.y);
      if (s && TU() && !TU().allowCard(s.id)) { TU().nudge(); return; }
      if (s) { s.selected = !s.selected; s.juice(0.6); snd('select'); hintList = null; refresh(); }
    } else if (e.type === 'up') {
      const id = TL.HUD.hit(r, e.x, e.y); if (downBtn && id === downBtn) act(downBtn); downBtn = null;
    }
  }
  const skipOK = () => (pay ? !pay.done : !ready && !(TL.Tutorial && TL.Tutorial.on()));
  function key_(e) {
    if (rcard) { if (rcard.t >= 1.2) closeRule(); return; }
    if ((e.key === 'enter' || e.key === 'space') && !dead && skipOK() && FX.skipTap()) return;
    if (pay) { if (pay.done && (e.key === 'enter' || e.key === 'space')) leave(); return; }
    if (e.key === 'esc') return Game().setScreen('settings');
    if (e.key === 's') { if (hand && !Game().overlay) xep(); return; }   // Xếp bài: the button moved into Menu, the key stays
    const m = { enter: 'danh', space: 'bo', h: 'goiy', d: 'doi' }[e.key]; if (m) act(m);
  }

  // ------------------------------------------------------------ draw
  function wrap(str, size, w) {
    const out = []; let line = '';
    str.split(' ').forEach(wd => { const t = line ? line + ' ' + wd : wd; if (line && A.textWidth(t, size) > w) { out.push(line); line = wd; } else line = t; });
    if (line) out.push(line); return out;
  }

  // ------------------------------------------------------------ Quẻ (one-use items, 2 slots)
  const queAt = (x, y) => { for (let i = 0; i < 2; i++) { const b = qr[i]; if (b && run.que[i] && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return i; } return null; };
  function queWhy(i) {   // one short line saying why this Quẻ cannot be used now, or null
    const id = run.que[i], M = T.msg; if (!id) return null;
    if (pay || dead || Game().overlay) return M.queBusy;
    if (id === 'que_loc' || id === 'que_sao') return FX.queue.busy() ? M.queBusy : null;
    if (!st || st.over) return M.queVan;
    if (vm.turn !== 0) return M.queTurn;
    if (!canAct()) return M.queBusy;
    if (id === 'que_doi') { const n = selIds().length; if (!n || n > CFG.QUE.DOI_MAX) return M.queSel; }
    if (id === 'que_soi' && st.reveal[0]) return M.queSoi;
    if (id === 'que_gap_doi' && run.flags.x2Next) return M.queX2;
    return null;
  }
  function useQueUI(i) {
    const id = run.que[i], w = queWhy(i);
    if (w) { say(w); snd('button'); return; }
    const sel = selIds(), res = TL.Run.useQue(run, st && !st.over ? st : null, i, sel);
    if (!res.ok) { say(res.msg); snd('button'); return; }
    const e = res.events[0], sp = queS[i], b = qr[i], c = ctr(b); queS[i] = null; qtip = null;
    if (sp) { swapFly.push(sp); sp.dissolve(M.dissolve.dur, () => {}); }
    snd('stamp', { vol: 0.8 });
    if (e.type === 'swap') doSwap(e);
    else if (id === 'que_soi') { soiOn = true; opp.forEach((s, k) => s.flip(A.card(s.id), k * 0.04)); snd('mult'); FX.popup(T.que.soi || T.hud.que, c.x, b.y, 'gold', { center: true }); }
    else if (id === 'que_gap_doi') { snd('mult', { pitch: 1.2 }); const t = top(r.theBox); FX.popup(T.hud.x2 + ' ' + T.hud.the, t.x, t.y, 'xthe', { center: true }); refresh(); }
    else if (id === 'que_them_van') { info = TL.Run.ban(run); vm.vanLeft = info.vanLeft; vm.vanMax = info.vanMax; FX.juice(J.van, 1.4); snd('coin'); FX.popup(T.que.gotVan, c.x, b.y, 'gold', { center: true }); }
    else if (id === 'que_loc') { FX.counter(cv, 'lixi', run.money, 0.5); snd('coin'); FX.popup(T.que.gotLixi.replace('%d', e.lixi), c.x, b.y, 'gold', { center: true }); }
    else if (id === 'que_sao') { snd('mult'); stampAt(T.que.gotSao.replace('%s', D.COMBO_NAME[e.sao]), 'gold'); refresh(); }
    saveRun();
  }
  function doSwap(e) {
    const d = ctr(r.deck);
    e.out.forEach((id, k) => { const i = hand.findIndex(s => s.id === id); if (i < 0) return; const s = hand.splice(i, 1)[0]; s.selected = false; s.hover = false; swapFly.push(s); s.moveTo(d.x, d.y, 0.35, 0, k * 0.05); FX.after(0.45 + k * 0.05, () => { s.dead = true; }); });
    const add = e.in.map(id => mk(A.back(), hs, id)); hand = hand.concat(add);
    const order = C.sortHand(hand.map(s => s.id), sortMode); hand.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    fanHand(0); add.forEach((s, k) => s.deal(d, 0.3 + k * 0.1, A.card(s.id))); snd('deal');
    leg = RU.legal(st, 0); hintList = null; refresh(); say(T.que.swapped, 1.5);
  }
  function drawQue(ctx) {
    SP.drawAll(ctx, queS.filter(Boolean));
  }
  function qtipRect() {
    const i = qtip; if (i == null || !run.que[i]) return null;
    const G = Game(), w = Math.min(K.tipW + 20, G.w - 16), sz = K.tipSize, d = D.QUE[run.que[i]], lh = sz + 4, lines = wrap(d.desc, sz, w - 16), why = queWhy(i), wl = why ? wrap(why, sz, w - 16) : [];
    const h = 12 + 18 + (lines.length + wl.length) * lh + 8 + 40, b = qr[i];
    const x = Math.max(8, Math.min(G.w - w - 8, b.x + b.w + 8)), y = Math.max(8, Math.min(G.h - h - 8, b.y));
    return { x: x, y: y, w: w, h: h, d: d, lines: lines, wl: wl, lh: lh, sz: sz, btn: { x: x + 8, y: y + h - 44, w: w - 16, h: 36 } };
  }
  function drawQueTip(ctx) {
    const q = qtipRect(); qbtn = q && q.btn; if (!q) return;
    A.panel(ctx, q, { fill: PAL.denSon, border: PAL.vangKim });
    A.text(ctx, q.d.name, q.x + 8, q.y + 6, { size: 15, color: PAL.vangKim });
    q.lines.forEach((l, k) => A.text(ctx, l, q.x + 8, q.y + 26 + k * q.lh, { size: q.sz, color: PAL.giayDo }));
    q.wl.forEach((l, k) => A.text(ctx, l, q.x + 8, q.y + 28 + (q.lines.length + k) * q.lh, { size: q.sz, color: PAL.vangKim }));
    A.button(ctx, q.btn, T.btn.dung, q.wl.length ? 'disabled' : qdown ? 'down' : 'idle');
  }
  function drawTip(ctx) {
    const i = tipPin != null ? tipPin : tipHover; if (i == null || !run.qn[i]) return;
    const q = D.QUY_NHAN[run.qn[i].id], G = Game(), w = Math.min(K.tipW, G.w - 16), sz = K.tipSize, lh = sz + 4;
    const d = wrap(q.desc, sz, w - 16), qu = q.quote ? wrap('“' + q.quote + '”', sz, w - 16) : [], h = 12 + 18 + (d.length + qu.length) * lh + 8, b = r.qnSlot[i];
    const x = Math.max(8, Math.min(G.w - w - 8, b.x + b.w / 2 - w / 2)), y = Math.min(G.h - h - 8, b.y + b.h + 20);
    A.panel(ctx, { x: x, y: y, w: w, h: h }, { fill: PAL.denSon, border: PAL.vangKim });
    A.text(ctx, q.name, x + 8, y + 6, { size: 15, color: PAL.vangKim });
    d.forEach((l, k) => A.text(ctx, l, x + 8, y + 26 + k * lh, { size: sz, color: PAL.giayDo }));
    qu.forEach((l, k) => A.text(ctx, l, x + 8, y + 28 + (d.length + k) * lh, { size: sz, color: PAL.laXanh }));
  }
  function drawRuleCard(ctx) {   // boss rule card: stays until tap, click or key (input ignored for the first 1.2 s)
    const G = Game(), t = rcard.t, ru = rcard.rule, red = FX.reducedMotion, sf = G.safe, land = G.w > G.h && G.h < 500;
    const ez = red ? 1 : Math.min(1, t / 0.3), ease = 1 - Math.pow(1 - ez, 3);
    ctx.save(); ctx.globalAlpha = 0.78 * ease; ctx.fillStyle = PAL.denSon; ctx.fillRect(0, 0, G.w, G.h); ctx.restore();
    const availW = G.w - sf.l - sf.r - 24, availH = G.h - sf.t - sf.b - 16, pad = land ? 14 : 18;
    const w = Math.min(availW, land ? 640 : 440), dpr = G.dpr || 1;
    const psz = Math.min(land ? availH - 2 * pad - 4 : w * 0.46, 200), sc = Math.max(1, Math.floor(psz * dpr / 48)) / dpr, pS = Math.round(48 * sc);
    const tw = land ? w - pS - 3 * pad : w - 2 * pad, nameS = land ? 26 : 28, quoteS = 15, longS = land ? 17 : 18;
    const quote = wrap('“' + ru.quote + '”', quoteS, tw), long = wrap(ru.long || ru.quote, longS, tw), hint = rcard.again ? T.hud.ruleClose : T.hud.ruleCard;
    const textH = 16 + 6 + nameS + 8 + quote.length * (quoteS + 5) + 10 + long.length * (longS + 6) + 8 + 16;
    const h = land ? Math.max(pS, textH) + 2 * pad : pad + pS + 12 + textH + pad - 4;
    const x = Math.round(sf.l + 12 + (availW - w) / 2), y = Math.round(sf.t + 8 + (availH - h) / 2 + (1 - ease) * 40);
    A.panel(ctx, { x: x, y: y, w: w, h: h }, { fill: PAL.nauCanhGian, border: PAL.vangKim, radius: 6 });
    ctx.save(); ctx.imageSmoothingEnabled = false;
    const px = land ? x + pad : Math.round(x + (w - pS) / 2), py = land ? Math.round(y + (h - pS) / 2) : y + pad;
    ctx.fillStyle = PAL.denSon; ctx.fillRect(px - 4, py - 4, pS + 8, pS + 8);
    ctx.drawImage(A.portrait(rcard.opp), px, py, pS, pS); ctx.restore();
    const cx = land ? x + 2 * pad + pS : x + w / 2, al = land ? 'left' : 'center', tx = land ? cx : cx;
    let ty = land ? Math.round(y + (h - textH) / 2) : py + pS + 12;
    A.text(ctx, T.hud.ruleKick, tx, ty, { size: 12, color: PAL.vangKim, align: al }); ty += 16 + 6;
    A.text(ctx, rcard.name, tx, ty, { size: nameS, color: PAL.vangKim, align: al }); ty += nameS + 8;
    quote.forEach(l => { A.text(ctx, l, tx, ty, { size: quoteS, color: PAL.laXanh, align: al }); ty += quoteS + 5; }); ty += 10;
    long.forEach(l => { A.text(ctx, l, tx, ty, { size: longS, color: PAL.giayDo, align: al }); ty += longS + 6; }); ty += 8;
    if (t >= 1.2) { ctx.save(); ctx.globalAlpha = red ? 1 : 0.55 + 0.45 * Math.abs(Math.sin(t * 3)); A.text(ctx, hint, tx, ty, { size: 14, color: PAL.vangKim, align: al }); ctx.restore(); }
  }
  function drawPay(ctx) {
    const G = Game(), b = payBox(); ctx.save(); ctx.globalAlpha = 0.6; ctx.fillStyle = PAL.denSon; ctx.fillRect(0, 0, G.w, G.h); ctx.restore();
    A.panel(ctx, b, { fill: PAL.nauCanhGian, border: PAL.vangKim });
    A.text(ctx, T.payout.title, b.x + b.w / 2, b.y + 12, { size: 26, color: PAL.vangKim, align: 'center' });
    pay.lines.forEach((l, i) => { if (!l.on) return; const y = b.y + 56 + i * 26; A.text(ctx, l.label, b.x + 16, y, { size: 16, color: PAL.giayDo }); A.text(ctx, '+' + Math.round(l.v), b.x + b.w - 16, y, { size: 16, color: PAL.vangKim, align: 'right' }); });
    if (pay.tOn) { const y = b.y + 64 + pay.lines.length * 26; A.text(ctx, T.payout.total, b.x + 16, y, { size: 18, color: PAL.giayDo }); A.text(ctx, Math.round(pay.tv) + ' ' + T.hud.lixi, b.x + b.w - 16, y, { size: 18, color: PAL.vangKim, align: 'right' }); }
    if (pay.done) A.button(ctx, payBtn(), run.phase === 'shop' ? T.payout.next : T.btn.ok, 'idle');
  }
  function update(dt) {
    if (!r) return; relayout(); applySort(false); if (rcard) rcard.t += dt; if (fin) { fin.t += dt; if (fin.slow > 0 && (fin.slow -= dt) <= 0) endFinale(); }
    [hand, opp, qnS.filter(Boolean), queS.filter(Boolean), swapFly].forEach(l => l.forEach(s => s.update(dt)));
    swapFly = swapFly.filter(s => !s.dead);
    groups.forEach(g => { g.list.forEach(s => s.update(dt)); g.list = g.list.filter(s => !s.dead); }); groups = groups.filter(g => g.list.length);
    sync();
  }
  function draw(ctx) {
    if (!r) return;
    TL.HUD.draw(ctx, vm, r); SP.drawAll(ctx, qnS.filter(Boolean)); drawQue(ctx); SP.drawAll(ctx, opp);
    groups.forEach(g => SP.drawAll(ctx, g.list)); SP.drawAll(ctx, hand);
    SP.drawAll(ctx, swapFly); TL.HUD.drawOver(ctx, vm, r); drawTip(ctx); drawQueTip(ctx); if (pay) drawPay(ctx); if (rcard) drawRuleCard(ctx);
  }
  function played() {   // bounding box of the cards on the table (just played), with room for their popups
    const l = groups.length ? groups[groups.length - 1].list.filter(s => !s.dead) : []; if (!l.length) return [];
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    l.forEach(s => { const z = s.size(); x0 = Math.min(x0, s.T.x - z.w / 2); x1 = Math.max(x1, s.T.x + z.w / 2); y0 = Math.min(y0, s.T.y - z.h / 2); y1 = Math.max(y1, s.T.y + z.h / 2); });
    return [{ x: x0, y: y0 - 34, w: x1 - x0, h: y1 - y0 + 34 }];
  }
  function tutRects() {   // named rects for the tutorial spotlight (CSS px)
    if (!r) return null;
    const ex = (b, t) => ({ x: b.x, y: b.y - t, w: b.w, h: b.h + t }), land = r.mode === 'landscape';
    return {
      goal: [land ? r.info.score : r.topBar], hand: [ex(r.hand, 24)], score: [ex(r.comboBox, 34), ex(r.pot, 40)].concat(played()), played: played(), btns2: [r.btn.bo, r.btn.danh],
      danh: [r.btn.danh], db: [r.dbBox], opp: [r.oppPlate], pot: [ex(r.pot, 0)], table: [r.tablePlay],
      card: id => { const sp = hand.find(x => x.id === id); if (!sp) return null; const z = sp.size(); return { x: sp.V.x - z.w / 2, y: sp.V.y - z.h / 2 - M.lift, w: z.w, h: z.h + M.lift }; },
    };
  }
  function exit() { dead = true; rcard = null; FX.queue.clear(); FX.reset(); if (TU()) TU().cancel(); }

  TL.Screens = TL.Screens || {};
  TL.Screens.table = { enter: enter, exit: exit, resize: () => { lk = ''; }, update: update, draw: draw, pointer: pointer, key: key_, tutRects: tutRects, _khi: lv => { const was = khi.lv; khi.lv = Math.max(0, Math.min(KHI().MAX, lv | 0)); setKhi(true, was); }, _que: () => ({ qr: qr, btn: qbtn, ready: !!ready && vm.turn === 0 && !FX.queue.busy(), hand: hand.map(x => ({ id: x.id, x: x.V.x, y: x.V.y })), msg: vm.msg, x2: vm.x2, vanLeft: vm.vanLeft, reveal: st && st.reveal }) };
})(globalThis.TL = globalThis.TL || {});
