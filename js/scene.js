/* js/scene.js  (owner TABLE) the play screen, SPEC §5-§12. Needs everything before it in the script order.
 * API  TL.Screens.table = Screen {enter(args), exit(), resize(), update(dt), draw(ctx), pointer(e), key(e)}
 *   enter: uses Game.run (creates one from ?seed if absent). phase 'ban' -> bàn intro -> deal -> turns -> ván end -> next ván | payout.
 *   payout is drawn here (lines count in); then setScreen('shop', {paid:true}) if Screens.shop exists, else the next bàn.
 *   lost / won -> setScreen('end', {result, run}) if Screens.end exists, else a fresh run. ?auto: AI plays seat 0, sets Game.autoResult.
 * All logic is computed first (Rules/Scoring/Run); the result is played back through FX.queue; input is locked while it is busy.
 */
(function (TL) {
  'use strict';
  const CFG = TL.CFG, M = CFG.MOTION, D = TL.DATA, T = D.TEXT, C = TL.Cards, RU = TL.Rules, S = TL.Scoring, FX = TL.FX, SP = TL.Sprite, A = TL.Art, PAL = CFG.PAL;
  // timings (s, before the speed divisor) and look constants
  const K = { think: [0.4, 0.9], intro: 1.5, introHouse: 0.9, gap: 0.12, slamHold: M.play.hold, vongHold: 0.7, endHold: 0.9, payLine: 0.6, payEnd: 1.0, sweep: 0.45, tipW: 230, tipSize: 11 };
  const Game = () => TL.Game, snd = (n, o) => { try { TL.Audio && TL.Audio.play(n, o); } catch (e) {} };
  const key = c => c.cards.join(','), ctr = b => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 }), fmt = TL.fmt;

  let run, info, st, r, lk = '', hs = 1, ts = 1, os = 1, vm, cv, shownDB, hand, opp, qnS, groups, ghost, vongPlays, ready, leg, hintList, hintIdx, sortMode, selOk, selMsg, tmsg, tmsgTok = 0;
  let pay, tipHover, tipPin, downBtn, hovBtn, dead;

  // ------------------------------------------------------------ helpers
  function mk(tex, scale, id) { const s = SP.create({ tex: tex, x: 0, y: 0, scale: scale }); s.id = id; return s; }
  function say(m, sec) { tmsg = m; const t = ++tmsgTok; FX.after(sec || 2, () => { if (tmsgTok === t) { tmsg = null; refresh(); } }); refresh(); }
  const selIds = () => hand.filter(s => s.selected).map(s => s.id).sort((a, b) => a - b);
  const dbPt = () => { const p = r.panel || r.topBar; return { x: p.x + p.w / 2, y: p.y + (r.panel ? p.h * 0.2 : p.h / 2) }; };
  const dim = (s, a, b) => { s.scale = a; s.V.sx = s.V.sy = b / a; };       // new scale, springs in from the old size
  const canAct = () => ready && !dead && !pay && st && !st.over && !FX.queue.busy() && !Game().flags.auto && vm.turn === 0 && !Game().overlay;

  function buildVm() {
    const ch = D.CHANG[run.chang], hr = info.house ? D.HOUSE_RULES[info.house] : null;
    vm = { chang: { idx: run.chang, name: ch.name }, ban: { idx: run.ban, kind: info.kind, name: info.name }, target: info.target, diemBan: 0, pot: 0, combo: null, diem: 0, the: 0,
      vanLeft: info.vanLeft, vanMax: info.vanMax, lixi: run.money, oppId: info.opp, oppName: info.name, house: hr ? { name: hr.name, quote: hr.quote, short: hr.short } : null,
      oppCount: 0, oppHeo: null, oppReveal: [], deckLeft: 52, qn: [], turn: 0, canPlay: false, canPass: false, busy: true, sortMode: sortMode, msg: null, flames: false };
  }
  function qnCopy() { return run.qn.map((q, i) => ghost[i] || (q ? { id: q.id, n: q.n } : null)); }
  function sync() {
    vm.pot = Math.round(cv.pot); vm.diemBan = Math.round(cv.diemBan); vm.lixi = Math.round(cv.lixi); vm.diem = Math.round(cv.diem); vm.the = Math.round(cv.the * 10) / 10;
    vm.flames = !!st && cv.pot >= info.target; vm.qn = qnCopy(); vm.oppCount = opp.length; vm.sortMode = sortMode;
    vm.oppHeo = S.slotOf(run, 'co_hang_xom') >= 0 ? opp.filter(s => C.isHeo(s.id)).length : null;
    vm.oppReveal = st ? (st.reveal || []).filter(id => opp.some(s => s.id === id)) : [];
    vm.busy = !!FX.queue.busy() || !ready || !!pay || !st || st.over; vm.canPlay = selOk && canAct(); vm.canPass = !!(leg && leg.canPass) && canAct();
    vm.msg = tmsg || selMsg; vm.hoverBtn = hovBtn; vm.downBtn = downBtn;
  }
  function clearScore() { cv.diem = cv.the = 0; vm.combo = null; }

  // ------------------------------------------------------------ layout
  function relayout() {
    const G = Game(), k = G.w + 'x' + G.h + 'x' + G.dpr;
    if (k === lk && r) return;
    lk = k; r = TL.HUD.layout(G.w, G.h, G.safe);
    hs = TL.HUD.scaleFor(r.cardH, G.dpr); ts = TL.HUD.scaleFor(r.tableCardH, G.dpr); os = TL.HUD.scaleFor(r.oppCardH, G.dpr);
    hand.forEach(s => { s.scale = hs; }); opp.forEach(s => { s.scale = os; });
    groups.forEach(g => g.list.forEach(s => { s.scale = ts; }));
    qnS.forEach((s, i) => { if (s) placeQn(s, i); });
    fanHand(0); fanOpp(0); groups.forEach(g => SP.fan(g.list, tableRect(g.k), { overlap: 0.35, curve: 0 }));
  }
  function placeQn(s, i) { const b = r.qnSlot[i]; s.scale = TL.HUD.scaleFor(b.h, Game().dpr); s.sway = false; const c = ctr(b); s.T.x = s.V.x = c.x; s.T.y = s.V.y = c.y; s._sp.x.x = c.x; s._sp.y.x = c.y; }
  const fanHand = dur => SP.fan(hand, r.hand, { dur: dur });
  const fanOpp = dur => SP.fan(opp, r.oppHand, { overlap: 0.5, curve: 0.6, dur: dur });
  function tableRect(k) { const p = r.tablePlay, dx = ((k % 3) - 1) * p.w * 0.12, dy = (k % 2 ? 1 : -1) * p.h * 0.04; return { x: p.x + dx, y: p.y + dy, w: p.w, h: p.h }; }
  function buildQn() {
    qnS = run.qn.map((q, i) => { if (!q) return null; const s = mk(A.quyNhan(q.id), 1, q.id); placeQn(s, i); return s; });
  }

  // ------------------------------------------------------------ flow
  function enter() {
    const G = Game();
    if (!G.run) G.run = TL.Run.create(G.flags.seed != null ? G.flags.seed : undefined);
    run = G.run; dead = false; pay = null; sortMode = 'rank'; ghost = {}; tmsg = selMsg = null; tipHover = tipPin = null; downBtn = hovBtn = null; lk = '';
    hand = []; opp = []; qnS = []; groups = []; st = null; ready = false; leg = null; selOk = false; vongPlays = 0;
    cv = { pot: 0, diemBan: 0, diem: 0, the: 0, lixi: run.money }; shownDB = 0; info = TL.Run.ban(run); buildVm(); FX.reset(); relayout(); buildQn();
    if (run.phase === 'payout') return showPay();
    if (run.phase === 'shop') return leave();
    if (run.phase === 'won' || run.phase === 'lost') return toEnd(run.phase);
    startBan();
  }
  function startBan() {
    info = TL.Run.ban(run); cv.lixi = run.money; cv.diemBan = shownDB = run.diemBan; buildVm(); buildQn(); sweepAll(true); st = null; ready = false;
    if (TL.BG) TL.BG.setMood(info.kind === 'trum' ? 'boss' : 'ban');
    if (!Game().flags.auto) saveRun();
    if (run.vanUsed === 0) {
      FX.queue.add(() => { FX.stamp(T.kind[info.kind] + ' · ' + info.name, 'gold'); snd(info.kind === 'trum' ? 'gong' : 'stamp'); return K.intro; }, 0.2);
      if (info.rule) FX.queue.add(() => { FX.stamp(info.rule.name + ': ' + info.rule.quote, 'bad'); snd('stamp'); return K.introHouse; }, 0);
    }
    FX.queue.add(startVan, 0.1);
  }
  function startVan() {
    info = TL.Run.ban(run); vm.vanLeft = info.vanLeft; sweepAll(true); st = TL.Run.startVan(run); vongPlays = 0; cv.pot = 0; cv.diemBan = shownDB = run.diemBan; clearScore();
    leg = null; ready = false; vm.deckLeft = 52 - 2 * CFG.HAND_SIZE; process(st.log.slice());
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
      const m = TL.AI.choose(RU.view(st, seat), seat === 1 ? info.aiLevel : 3);
      let evs = m.type === 'play' ? RU.play(st, seat, m.cardIds) : RU.pass(st, seat);
      if (!evs.length) { const l = RU.legal(st, seat); evs = l.canPass ? RU.pass(st, seat) : RU.play(st, seat, l.plays[0].cards); }
      process(evs);
    }, d);
  }
  function act(id) {
    if (!canAct()) return;
    if (id === 'danh') {
      if (!selOk) return;
      const ids = selIds(); ready = false; const evs = RU.play(st, 0, ids); if (evs.length) process(evs); else { ready = true; say(T.msg.illegal); }
    } else if (id === 'bo') {
      if (!leg.canPass) { if (!st.table) return; say(T.msg.mustBeat); return; }
      ready = false; hand.forEach(s => { s.selected = false; }); process(RU.pass(st, 0));
    } else if (id === 'goiy') hint();
    else if (id === 'xep') xep();
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
    sortMode = sortMode === 'rank' ? 'suit' : 'rank'; const order = C.sortHand(hand.map(s => s.id), sortMode);
    hand.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)); fanHand(0.35); hand.forEach(s => s.juice(0.4)); snd('shuffle');
  }
  function refresh() {   // selection preview: combo name, level, Điểm × Thế only for a legal selection
    const ids = hand ? selIds() : []; selOk = false; selMsg = null;
    if (!ready || !leg) return;
    if (!ids.length) { clearScore(); return; }
    const c = C.detect(ids);
    if (!c) selMsg = T.msg.illegal;
    else if (!leg.plays.some(p => key(p) === key(c))) selMsg = st.table && st.mods.noChat && C.beats(c, st.table.combo, {}) === 'chat' ? T.msg.noChat : T.msg.cantBeat;
    else { const p = S.preview(run, c); selOk = true; vm.combo = { name: D.COMBO_NAME[c.type], level: p.level }; cv.diem = p.diem; cv.the = p.the; }
    if (!selOk) clearScore();
  }

  // ------------------------------------------------------------ event playback (SPEC §10)
  function playEv(e, steps) {
    const Q = FX.queue, P = { sp: {}, target: null, a: { diem: 0, the: 0 } };
    if (e.type === 'deal') Q.add(() => doDeal(e, steps), 0);
    else if (e.type === 'toiTrang') Q.add(() => { FX.stamp(T.stamp.toiTrang, 'gold'); snd('gong'); return K.endHold; }, 0.1);
    else if (e.type === 'turn') Q.add(() => {
      vm.turn = e.seat; clearScore(); hintList = null; tmsg = null;
      if (e.seat === 1 || Game().flags.auto) schedule(e.seat);
      else { leg = RU.legal(st, 0); ready = true; refresh(); }
    }, 0);
    else if (e.type === 'play') {
      Q.add(() => { flyCards(e, P); return M.play.fly; }, 0);
      e.score.steps.forEach((s, i, a) => Q.add(() => step(s, i, e, P), i ? FX.stepGap(a.length) : 0.05));
      Q.add(() => slam(e.score.total, e.pot, e.score.total >= M.bigScore), 0.1);
      Q.add(() => K.slamHold, 0);
    } else if (e.type === 'chat') Q.add(() => {
      FX.counter(cv, 'pot', e.pot, M.counter.dur); FX.popup('×' + e.xPot, ctr(r.pot).x, ctr(r.pot).y, 'xthe'); FX.shake(FX.shakeFor(e.pot)); snd('mult', { pitch: 1.3 }); return 0.5;
    }, 0.1);
    else if (e.type === 'pass') Q.add(() => {
      const p = e.seat === 0 ? ctr(r.hand) : ctr(r.oppSeat); FX.popup(T.stamp.boLuot, p.x, p.y - 20, 'gold'); snd('button'); steps.forEach(qnFx); return 0.4;
    }, 0);
    else if (e.type === 'vong') Q.add(() => vong(e, steps), 0.15);
    else if (e.type === 'vanEnd') vanEnd(e);
  }
  function qnFx(s) {
    const b = r.qnSlot[s.slot], c = ctr(b), sp = qnS[s.slot];
    if (sp) sp.juice(1);
    if (s.dissolve) {
      ghost[s.slot] = { id: s.ref, n: 0 }; FX.stamp(s.label, 'bad'); snd('dissolve');
      if (sp) sp.dissolve(M.dissolve.dur, () => { delete ghost[s.slot]; qnS[s.slot] = null; });
    } else if (s.label) FX.popup(s.label, c.x, c.y, s.xThe ? 'xthe' : s.the ? 'the' : 'gold');
  }
  function doDeal(e, steps) {
    const d = ctr(r.deck), n = e.hands[0].length, st0 = M.deal.stagger, G = Game();
    sortMode = 'rank'; snd('deal'); snd('shuffle');
    hand = C.sortHand(e.hands[0], sortMode).map(id => mk(A.back(), hs, id)); fanHand(0);
    opp = e.hands[1].map(id => mk(A.back(), os, id)); fanOpp(0);
    hand.forEach((s, i) => s.deal(d, i * 2 * st0, A.card(s.id)));
    opp.forEach((s, i) => s.deal(d, (i * 2 + 1) * st0, st.reveal.indexOf(s.id) >= 0 ? A.card(s.id) : null));
    steps.forEach(s => FX.after(n * 2 * st0 + M.deal.fly, () => { qnFx(s); snd('mult'); }));
    return n * 2 * st0 + M.deal.fly + (steps.length ? 0.5 : 0.15);
  }
  function flyCards(e, P) {
    const from = e.seat === 0 ? hand : opp, ids = e.combo.cards, k = vongPlays++;
    const list = ids.map(id => { const i = from.findIndex(s => s.id === id); return from.splice(i, 1)[0]; });
    P.target = groups.length ? groups[groups.length - 1].list : null;
    groups.push({ list: list, k: k });
    list.forEach(s => { P.sp[s.id] = s; s.selected = false; s.hover = false; dim(s, ts, s.scale); if (e.seat === 1 && s.tex !== A.card(s.id)) s.flip(A.card(s.id), 0.05); });
    SP.fan(list, tableRect(k), { overlap: 0.35, curve: 0, dur: M.play.fly });
    if (e.seat === 0) { fanHand(0.25); selOk = false; selMsg = null; } else fanOpp(0.25);
    ready = false; snd('place');
    vm.combo = { name: D.COMBO_NAME[e.combo.type], level: e.seat === 0 ? run.sao[e.combo.type] || 1 : 1 }; cv.diem = cv.the = 0;
  }
  function step(s, i, e, P) {
    const a = P.a, B = r.comboBox, bc = ctr(B), sp = s.kind === 'card' ? P.sp[s.ref] : null;
    const at = s.kind === 'qn' ? ctr(r.qnSlot[s.slot]) : sp ? { x: sp.V.x, y: sp.V.y - 12 } : s.kind === 'chat' ? ctr(r.tablePlay) : bc;
    if (s.kind === 'chat') {
      FX.stamp(T.stamp.chat, 'gold'); snd('chat'); FX.confetti(at.x, at.y, M.confetti.n); FX.shake(M.shake.max * 0.6); if (TL.BG) TL.BG.pulse(0.6);
      (P.target || []).forEach(t => { if (C.isHeo(t.id)) t.dissolve(M.dissolve.dur, () => {}); }); if (P.target) snd('dissolve');
      return 0.4;
    }
    if (sp) sp.juice(0.8);
    if (s.kind === 'qn') { qnFx(Object.assign({}, s, { label: null })); }
    if (s.kind === 'base') { FX.popup('+' + s.diem, bc.x - 24, bc.y, 'diem'); FX.popup('+' + s.the + ' ' + T.hud.the, bc.x + 24, bc.y - 14, 'the'); }
    else if (s.kind === 'card') FX.popup(s.label, at.x, at.y, 'diem');
    else FX.popup(s.label, at.x, at.y, s.xThe ? 'xthe' : s.the && !s.diem ? 'the' : 'diem');
    a.diem += s.diem || 0; a.the += s.the || 0; if (s.xThe) a.the *= s.xThe;
    FX.counter(cv, 'diem', a.diem, M.counter.dur * 0.6); FX.counter(cv, 'the', a.the, M.counter.dur * 0.6);
    snd(s.the || s.xThe ? 'mult' : 'tick', { pitch: FX.tickPitch(i) });
    return 0;
  }
  function slam(total, pot, big) {
    const p = ctr(r.pot); FX.popup('+' + fmt(total), p.x, p.y + 10, 'gold'); FX.counter(cv, 'pot', pot, M.counter.dur); FX.shake(FX.shakeFor(total)); snd('stamp', { vol: 0.7 }); if (big && TL.BG) TL.BG.pulse(1);
  }
  function vong(e, steps) {
    const w = e.winner, dest = w === 0 ? dbPt() : ctr(r.oppSeat), all = [];
    groups.forEach(g => g.list.forEach((s, i) => { all.push(s); s.moveTo(dest.x, dest.y, 0.4, (i - 1) * 6, i * 0.03); }));
    FX.after(K.sweep, () => { all.forEach(s => { s.dead = true; }); });
    FX.popup((w === 0 ? '+' : '') + fmt(e.pot), dest.x, dest.y, w === 0 ? 'gold' : 'bad'); snd('vong'); steps.forEach(s => { qnFx(s); });
    FX.counter(cv, 'pot', 0, M.counter.dur); if (w === 0) { shownDB += e.pot; FX.counter(cv, 'diemBan', shownDB, M.counter.dur * 1.5); snd('coin'); }
    vongPlays = 0; return K.vongHold;
  }
  function vanEnd(e) {
    const Q = FX.queue, win = e.winner === 0, b = e._bonus, a = { diem: 0, the: 0 };
    Q.add(() => { ready = false; snd(win ? 'venhat' : 'thua'); if (!e.toiTrang) FX.stamp(win ? T.stamp.veNhat : T.stamp.thua, win ? 'good' : 'bad'); return 0.7; }, 0.2);
    b.steps.forEach((s, i) => Q.add(() => {
      const B = r.comboBox, bc = ctr(B), tb = ctr(r.theBox), db = ctr(r.diemBox);
      if (!(win && s.ref === 'veNhat' && !e.toiTrang)) FX.stamp(s.label, win ? 'good' : 'bad');
      vm.combo = { name: T.stamp[win ? 'veNhat' : 'thua'], level: 1 };
      if (s.ref === 'veNhat' || s.ref === 'thoi' && s.diem != null) { a.diem = s.diem; a.the = 1; FX.popup((s.diem < 0 ? '' : '+') + s.diem, db.x, db.y, s.diem < 0 ? 'bad' : 'diem'); }
      else { a.the = s.xThe; FX.popup('×' + Math.round(s.xThe * 10) / 10, tb.x, tb.y, 'xthe'); }
      FX.counter(cv, 'diem', a.diem, M.counter.dur * 0.6); FX.counter(cv, 'the', a.the, M.counter.dur * 0.6); snd(s.xThe ? 'mult' : 'tick', { pitch: FX.tickPitch(i) });
      return 0.5;
    }, K.gap * 3));
    Q.add(() => {
      shownDB = run.diemBan; const p = dbPt(); FX.popup((b.total >= 0 ? '+' : '') + fmt(b.total), p.x, p.y, b.total >= 0 ? 'gold' : 'bad');
      FX.counter(cv, 'diemBan', shownDB, M.counter.dur * 1.5); FX.shake(FX.shakeFor(Math.abs(b.total))); snd(b.total >= 0 ? 'coin' : 'thua', { vol: 0.7 }); vm.vanLeft = TL.Run.ban(run).vanLeft; return K.endHold;
    }, 0.2);
    Q.add(() => endOfVan(e._res), 0);
  }
  function endOfVan(res) {
    if (!Game().flags.auto) saveRun();
    if (res === 'next') { sweepAll(false); clearScore(); FX.queue.add(startVan, K.sweep); }
    else if (res === 'cleared') { snd('gong'); FX.stamp(T.stamp.quaBan, 'gold'); FX.confetti(r.table.x + r.table.w / 2, r.table.y, 50); sweepAll(false); FX.queue.add(showPay, 1.0); }
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
    cv.lixi = money; clearScore(); st = null; ready = false;
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
    if (TL.Run.nextBan(run) === 'won') toEnd('won'); else startBan();
  }
  function toEnd(result) {
    const G = Game(); dead = true; try { localStorage.removeItem(CFG.STORAGE.save); } catch (e) {}
    if (G.flags.auto) { G.autoResult = { result: result, stats: run.stats }; try { console.log('autoResult ' + JSON.stringify(G.autoResult)); } catch (e) {} return; }
    if (TL.Screens && TL.Screens.end) return G.setScreen('end', { result: result, run: run });
    FX.stamp(result === 'won' ? T.end.win : T.end.lose, result === 'won' ? 'gold' : 'bad');
    FX.queue.add(() => { G.run = TL.Run.create(); run = G.run; dead = false; cv.lixi = run.money; startBan(); }, 1.6);
  }

  // ------------------------------------------------------------ input
  function slotAt(x, y) { for (let i = 0; i < r.qnSlot.length; i++) { const b = r.qnSlot[i]; if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h && run.qn[i]) return i; } return null; }
  function payBtn() { const w = Math.min(Game().w - 24, 340), h = 44; return { x: (Game().w - w) / 2 + 20, y: payBox().y + payBox().h - h - 14, w: w - 40, h: h }; }
  function payBox() { const w = Math.min(Game().w - 24, 340), h = 120 + (pay ? pay.lines.length : 0) * 26 + 60; return { x: (Game().w - w) / 2, y: Math.max(8, (Game().h - h) / 2), w: w, h: h }; }
  function pointer(e) {
    if (!r) return;
    const inB = (b, x, y) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
    if (pay) { if (e.type === 'down' && pay.done && inB(payBtn(), e.x, e.y)) leave(); return; }
    if (e.type === 'move') { tipHover = slotAt(e.x, e.y); const id = TL.HUD.hit(r, e.x, e.y); hovBtn = id; SP.hover(hand, canAct() ? e.x : null, e.y); return; }
    if (e.type === 'down') {
      const sl = slotAt(e.x, e.y); tipPin = sl != null && tipPin !== sl ? sl : null; if (sl != null) { tipHover = sl; return; }
      const id = TL.HUD.hit(r, e.x, e.y); if (id) { downBtn = id; snd('button'); return; }
      if (!canAct()) return; const s = SP.pick(hand, e.x, e.y);
      if (s) { s.selected = !s.selected; s.juice(0.6); snd('select'); hintList = null; refresh(); }
    } else if (e.type === 'up') {
      const id = TL.HUD.hit(r, e.x, e.y); if (downBtn && id === downBtn) act(downBtn); downBtn = null;
    }
  }
  function key_(e) {
    if (pay) { if (pay.done && (e.key === 'enter' || e.key === 'space')) leave(); return; }
    if (e.key === 'esc') return Game().setScreen('settings');
    const m = { enter: 'danh', space: 'bo', h: 'goiy', s: 'xep' }[e.key]; if (m) act(m);
  }

  // ------------------------------------------------------------ draw
  function wrap(str, size, w) {
    const out = []; let line = '';
    str.split(' ').forEach(wd => { const t = line ? line + ' ' + wd : wd; if (line && A.textWidth(t, size) > w) { out.push(line); line = wd; } else line = t; });
    if (line) out.push(line); return out;
  }
  function drawTip(ctx) {
    const i = tipPin != null ? tipPin : tipHover; if (i == null || !run.qn[i]) return;
    const q = D.QUY_NHAN[run.qn[i].id], G = Game(), w = Math.min(K.tipW, G.w - 16), sz = K.tipSize, lh = sz + 4;
    const d = wrap(q.desc, sz, w - 16), qu = wrap('“' + q.quote + '”', sz, w - 16), h = 12 + 18 + (d.length + qu.length) * lh + 8, b = r.qnSlot[i];
    const x = Math.max(8, Math.min(G.w - w - 8, b.x + b.w / 2 - w / 2)), y = Math.min(G.h - h - 8, b.y + b.h + 20);
    A.panel(ctx, { x: x, y: y, w: w, h: h }, { fill: PAL.denSon, border: PAL.vangKim });
    A.text(ctx, q.name, x + 8, y + 6, { size: 15, color: PAL.vangKim });
    d.forEach((l, k) => A.text(ctx, l, x + 8, y + 26 + k * lh, { size: sz, color: PAL.giayDo }));
    qu.forEach((l, k) => A.text(ctx, l, x + 8, y + 28 + (d.length + k) * lh, { size: sz, color: PAL.laXanh }));
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
    if (!r) return; relayout();
    [hand, opp, qnS.filter(Boolean)].forEach(l => l.forEach(s => s.update(dt)));
    groups.forEach(g => { g.list.forEach(s => s.update(dt)); g.list = g.list.filter(s => !s.dead); }); groups = groups.filter(g => g.list.length);
    sync();
  }
  function draw(ctx) {
    if (!r) return;
    TL.HUD.draw(ctx, vm, r); SP.drawAll(ctx, qnS.filter(Boolean)); SP.drawAll(ctx, opp);
    groups.forEach(g => SP.drawAll(ctx, g.list)); SP.drawAll(ctx, hand);
    TL.HUD.drawOver(ctx, vm, r); drawTip(ctx); if (pay) drawPay(ctx);
  }
  function exit() { dead = true; FX.queue.clear(); FX.reset(); }

  TL.Screens = TL.Screens || {};
  TL.Screens.table = { enter: enter, exit: exit, resize: () => { lk = ''; }, update: update, draw: draw, pointer: pointer, key: key_ };
})(globalThis.TL = globalThis.TL || {});
