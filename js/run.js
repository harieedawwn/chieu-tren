/* js/run.js  (owner BALANCE) run state, bàn flow, payout, shop, save. Pure logic, no DOM. Needs config, data, rules, scoring.
 * API  (RunState is plain JSON, SPEC §4)
 *   TL.Run.create(seed) -> run            new run at chặng 1 bàn 1, phase 'ban'
 *   TL.Run.ban(run) -> BanInfo            current bàn (target, opp, luật nhà, mods, ván left)
 *   TL.Run.startVan(run, opts?) -> VanState      Rules.newVan with house mods + scoreFn bound to run; sets peek (Thầy bói)
 *   TL.Run.record(run, events)            stats, Điểm bàn += pot on vòng won by seat 0, opponent take, lastWinner
 *   TL.Run.endVan(run, vanEndEvent) -> 'next'|'cleared'|'lost'   vanUsed++, vanNo++, applies vanBonus, floors Điểm bàn at 0
 *   TL.Run.payout(run) -> {lines:[{label, amount}], total}   applies once (repeat call returns the same lines)
 *   TL.Run.shop(run) -> ShopItem[]        2 Quý nhân (rarity 70/25/5, never owned) + 2 Sao + 1 Quẻ + 1 Bao lì xì, seeded; ShopItem {kind:'qn'|'sao'|'que'|'pack', id, price, sold}
 *   TL.Run.buy(run, i) -> {ok, why?}      why: 'money'|'slots'|'sold'; buying a pack opens it (same as openPack)
 *   TL.Run.sell(run, slot) -> {ok}        sells a Quý nhân; TL.Run.sellQue(run, i) -> {ok}; TL.Run.reroll(run) -> {ok, why?}
 *   TL.Run.openPack(run, i) -> {ok, choices:[{kind:'qn'|'que', id} x3], why?}   pays, sets run.pack; TL.Run.choosePack(run, k) -> {ok, why?}  k 0-2 takes it (why 'slots' keeps the pack open), -1 skips
 *   TL.Run.useQue(run, van|null, i, selectedIds) -> {ok, events, msg}   uses Quẻ slot i (run.que); msg = Vietnamese reason when not ok; que_loc and que_sao work with van null
 *   TL.Run.nextBan(run) -> 'ok'|'won'     leaves the shop for the next bàn (or ends the run)
 *   TL.Run.continueEndless(run) -> 'ok'|false   after phase 'won': chặng 4, 5... forever (CFG.ENDLESS targets, random bosses); the run then ends only on a loss
 *   run.seen: string[] ids of Quý nhân, Quẻ, Sao and luật nhà shown, owned or played against; run.que: (id|null)[2]; run.bosses: house id per chặng; run.flags.x2Next
 *   TL.Run.save(run) -> string            TL.Run.load(str) -> run|null (bad or old save -> null)
 */
(function (TL) {
  'use strict';
  const CFG = TL.CFG, D = TL.DATA, T = D.TEXT, S = TL.Scoring;
  const SAO_IDS = Object.keys(D.SAO), QN_IDS = Object.keys(D.QUY_NHAN), QUE_IDS = Object.keys(D.QUE), TYPES = ['rac', 'doi', 'sam', 'sanh', 'doithong', 'tuquy'];
  const PHASES = ['ban', 'payout', 'shop', 'won', 'lost'];

  function rand(run) { run.rn = (run.rn || 0) + 1; return TL.makeRng(((run.seed ^ 0xA5F00D) + Math.imul(run.rn, 2654435761)) >>> 0)(); }
  function see(run, id) { if (id && !run.seen.includes(id)) run.seen.push(id); }
  function drawBoss(run, chang) {   // house rule for a chặng's bàn trùm: first 3 chặng never repeat, endless picks any except the previous
    const used = run.bosses.slice(0, chang), pool = D.BOSS_IDS.filter(id => chang < 6 ? !used.includes(id) : id !== run.bosses[chang - 1]);
    run.bosses[chang] = pool[Math.floor(rand(run) * pool.length)];
  }

  function create(seed) {
    seed = (seed === undefined ? Date.now() : seed) >>> 0;
    const sao = {}; TYPES.forEach(t => { sao[t] = 1; });
    const run = {
      v: CFG.SAVE_VERSION, seed: seed, vanNo: 0, phase: 'ban', chang: 0, ban: 0, money: CFG.START_MONEY,
      qn: Array.from({ length: CFG.SHOP.QN_SLOTS }, () => null), sao: sao, diemBan: 0, vanUsed: 0, lastWinner: null,
      van: { stack: 0, oppTake: 0 }, flags: { x2Next: false }, que: Array.from({ length: CFG.SHOP.QUE_SLOTS }, () => null), seen: [], bosses: [], rn: 0, endless: false, vanExtra: 0, pack: null, shop: { items: [], rerolls: 0, n: 0 }, paid: false, lastPayout: null,
      stats: { vans: 0, wins: 0, chat: 0, bestPlay: 0, bestPot: 0, toiTrang: 0, earned: 0 },
    };
    for (let c = 0; c < 3; c++) drawBoss(run, c);
    return run;
  }

  function ban(run) {
    const c = D.CHANG[run.chang % 3], b = c.ban[run.ban], boss = run.ban === 2;
    if (boss && !run.bosses[run.chang]) drawBoss(run, run.chang);
    const hid = boss ? run.bosses[run.chang] : null, h = hid ? D.HOUSE_RULES[hid] : null;
    const e = run.chang < 3 ? 1 : Math.pow(CFG.ENDLESS.TARGET_X, run.chang - 2);
    const target = Math.round((run.chang < 3 ? CFG.TARGETS[run.chang][run.ban] : CFG.TARGETS[2][run.ban] * e) / 10) * 10;
    const vanMax = (h && h.mods.twoVans ? CFG.HOUSE2.TWO_VANS : CFG.VAN_PER_BAN) + (run.vanExtra || 0);
    return {
      chang: run.chang, changName: run.chang < 3 ? c.name : T.end.endlessChang.replace('%d', run.chang + 1), ban: run.ban, kind: b.kind, name: h ? h.name : b.name, opp: h ? h.id : b.id, tag: h ? T.hud.house : b.tag, house: hid,
      rule: h ? { id: h.id, name: h.name, quote: h.quote, short: h.short, long: h.long } : null, mods: h ? Object.assign({}, h.mods) : {},
      target: target, aiLevel: CFG.AI_BY_CHANG[Math.min(run.chang, 2)], vanMax: vanMax,
      vanUsed: run.vanUsed, vanLeft: vanMax - run.vanUsed, diem: run.diemBan, last: run.chang === 2 && run.ban === 2 && !run.endless,
    };
  }

  function startVan(run, opts) {
    const b = ban(run), rng = TL.makeRng((run.seed + 7919 * run.vanNo) >>> 0);
    if (b.house) see(run, b.house);
    run.qn.forEach(q => q && see(run, q.id));
    run.van = { stack: 0, oppTake: 0 };
    const st = TL.Rules.newVan({
      rng: rng, handSize: CFG.HAND_SIZE, hands: opts && opts.hands, leader: run.vanUsed > 0 && run.lastWinner !== null ? run.lastWinner : undefined, mods: b.mods,
      scoreFn: (seat, combo, ctx) => S.scorePlay(run, seat, combo, ctx),
    });
    st.peek = S.slotOf(run, 'thay_boi') >= 0 ? st.hands[1].slice(-CFG.QN.THAY_BOI_REVEAL) : [];
    return st;
  }

  function record(run, events) {
    events.forEach(function (e) {
      if (e.type === 'play' && e.seat === 0) run.stats.bestPlay = Math.max(run.stats.bestPlay, e.score.total);
      else if (e.type === 'chat' && e.seat === 0) run.stats.chat++;
      else if (e.type === 'vong') {
        if (e.winner === 0) { run.diemBan += e.pot; run.stats.bestPot = Math.max(run.stats.bestPot, e.pot); } else run.van.oppTake = (run.van.oppTake || 0) + e.pot;
      } else if (e.type === 'vanEnd') {
        run.lastWinner = e.winner; run.stats.vans++;
        if (e.winner === 0) run.stats.wins++;
        if (e.toiTrang && e.winner === 0) run.stats.toiTrang++;
      }
    });
  }

  function endVan(run, ev) {
    run.diemBan = Math.max(0, run.diemBan + TL.Scoring.vanBonus(run, ev).total);
    run.vanUsed++; run.vanNo++;
    if (run.diemBan >= ban(run).target) { run.phase = 'payout'; run.paid = false; return 'cleared'; }
    if (run.vanUsed >= ban(run).vanMax) { run.phase = 'lost'; return 'lost'; }
    return 'next';
  }

  const isLast = run => run.chang === 2 && run.ban === 2 && !run.endless;

  function payout(run) {
    if (run.paid && run.lastPayout) return run.lastPayout;
    const b = ban(run), lines = [], unused = b.vanLeft, interest = Math.min(CFG.INTEREST_MAX, Math.floor(run.money / CFG.INTEREST_PER));
    lines.push({ label: T.kind[b.kind], amount: CFG.PAYOUT[b.kind] });
    if (unused > 0 && CFG.UNUSED_VAN_PTS > 0) lines.push({ label: T.payout.unused.replace('%d', unused), amount: CFG.UNUSED_VAN_PTS * unused });
    if (interest > 0) lines.push({ label: T.payout.interest, amount: interest });
    const total = lines.reduce((a, l) => a + l.amount, 0);
    run.money += total; run.stats.earned = (run.stats.earned || 0) + total; run.paid = true; run.lastPayout = { lines: lines, total: total };
    if (!isLast(run)) { run.phase = 'shop'; run.shop = { items: [], rerolls: 0, n: 0 }; }
    return run.lastPayout;
  }

  // rarity-weighted pick: choose a rarity (weights CFG.RARITY_W over the non-empty ones), then uniformly inside it
  function pickRare(rng, pool, map) {
    const by = { thuong: [], hiem: [], quy: [] }; pool.forEach(id => by[map[id].rarity].push(id));
    const live = D.RARITY_ORDER.filter(r => by[r].length), tot = live.reduce((a, r) => a + CFG.RARITY_W[r], 0);
    let x = rng() * tot, r = live[live.length - 1];
    for (const k of live) { if (x < CFG.RARITY_W[k]) { r = k; break; } x -= CFG.RARITY_W[k]; }
    return by[r][Math.floor(rng() * by[r].length)];
  }
  const ownedQn = run => run.qn.filter(Boolean).map(s => s.id);

  function roll(run) {
    const rng = TL.makeRng((run.seed ^ 0x9E3779B9) + 104729 * (run.vanNo + 1) + 15485863 * run.shop.n); run.shop.n++;
    const owned = ownedQn(run), qs = [];
    while (qs.length < CFG.SHOP.QN_COUNT) {
      const pool = QN_IDS.filter(id => !owned.includes(id) && !qs.includes(id)); if (!pool.length) break;
      qs.push(pickRare(rng, pool, D.QUY_NHAN));
    }
    const sp = SAO_IDS.slice(), ss = [];
    while (ss.length < CFG.SHOP.SAO_COUNT && sp.length) ss.push(sp.splice(Math.floor(rng() * sp.length), 1)[0]);
    const qe = []; while (qe.length < CFG.SHOP.QUE_COUNT) qe.push(pickRare(rng, QUE_IDS.filter(id => !qe.includes(id)), D.QUE));
    const items = qs.map(id => ({ kind: 'qn', id: id, price: CFG.PRICE.QN[id], sold: false }))
      .concat(ss.map(id => ({ kind: 'sao', id: id, price: CFG.PRICE.SAO, sold: false })))
      .concat(qe.map(id => ({ kind: 'que', id: id, price: CFG.PRICE.QUE[id], sold: false })));
    for (let k = 0; k < CFG.SHOP.PACK_COUNT; k++) items.push({ kind: 'pack', id: D.PACK.id, price: CFG.PRICE.PACK, sold: false });
    run.shop.items = items;
    items.forEach(it => see(run, it.id));
  }

  function shop(run) { if (!run.shop.items.length) roll(run); return run.shop.items; }

  function give(run, kind, id) {   // put a bought / chosen item in its slot; false when the slots are full
    if (kind === 'qn') { const f = run.qn.indexOf(null); if (f < 0) return false; run.qn[f] = { id: id, n: 0 }; }
    else if (kind === 'que') { const f = run.que.indexOf(null); if (f < 0) return false; run.que[f] = id; }
    else if (kind === 'sao') { const t = D.SAO[id].combo; run.sao[t] = (run.sao[t] || 1) + 1; }
    see(run, id);
    return true;
  }

  function buy(run, i) {
    const it = shop(run)[i];
    if (!it || it.sold) return { ok: false, why: 'sold' };
    if (it.kind === 'pack') return openPack(run, i);
    if (it.kind === 'qn' && run.qn.indexOf(null) < 0) return { ok: false, why: 'slots' };
    if (it.kind === 'que' && run.que.indexOf(null) < 0) return { ok: false, why: 'slots' };
    if (run.money < it.price) return { ok: false, why: 'money' };
    run.money -= it.price; it.sold = true; give(run, it.kind, it.id);
    return { ok: true };
  }

  function openPack(run, i) {
    const it = shop(run)[i];
    if (!it || it.sold || it.kind !== 'pack' || run.pack) return { ok: false, why: 'sold' };
    if (run.money < it.price) return { ok: false, why: 'money' };
    const rng = TL.makeRng((run.seed ^ 0x1B873593) + 7561 * (run.vanNo + 1) + 15485863 * run.shop.n + 31 * i + (run.rn = (run.rn || 0) + 1));
    const qFree = run.qn.indexOf(null) >= 0, eFree = run.que.indexOf(null) >= 0;
    if (!qFree && !eFree) return { ok: false, why: 'slots' };   // choices only offer kinds that still have a free slot
    run.money -= it.price; it.sold = true;
    const owned = ownedQn(run), ch = [], pool = () => (qFree ? QN_IDS.filter(id => !owned.includes(id) && !ch.some(c => c.id === id)).map(id => ['qn', id]) : []).concat(eFree ? QUE_IDS.filter(id => !ch.some(c => c.id === id)).map(id => ['que', id]) : []);
    while (ch.length < CFG.SHOP.PACK_CHOICES) {
      const p = pool(), map = {}; p.forEach(x => { map[x[1]] = x[0] === 'qn' ? D.QUY_NHAN[x[1]] : D.QUE[x[1]]; });
      const id = pickRare(rng, p.map(x => x[1]), map); ch.push({ kind: map[id].kind, id: id });
    }
    run.pack = { choices: ch }; ch.forEach(c => see(run, c.id));
    return { ok: true, choices: ch.map(c => Object.assign({}, c)) };
  }

  function choosePack(run, k) {
    if (!run.pack) return { ok: false, why: 'none' };
    if (k === -1) { run.pack = null; return { ok: true }; }
    const c = run.pack.choices[k];
    if (!c) return { ok: false, why: 'none' };
    if (!give(run, c.kind, c.id)) return { ok: false, why: 'slots' };
    run.pack = null; return { ok: true };
  }

  function sell(run, slot) {
    const s = run.qn[slot];
    if (!s) return { ok: false };
    run.money += Math.floor(CFG.PRICE.QN[s.id] * CFG.SHOP.SELL_RATIO); run.qn[slot] = null;
    return { ok: true };
  }

  function sellQue(run, i) {
    const id = run.que[i];
    if (!id) return { ok: false };
    run.money += Math.floor(CFG.PRICE.QUE[id] * CFG.SHOP.SELL_RATIO); run.que[i] = null;
    return { ok: true };
  }

  function reroll(run) {
    const cost = CFG.SHOP.REROLL_BASE + CFG.SHOP.REROLL_STEP * run.shop.rerolls;
    if (run.money < cost) return { ok: false, why: 'money' };
    run.money -= cost; run.shop.rerolls++; roll(run);
    return { ok: true };
  }

  function useQue(run, van, i, sel) {
    const id = run.que[i], M = T.msg, fail = msg => ({ ok: false, events: [], msg: msg });
    if (!id) return fail(M.pickCards);
    const live = van && !van.over;
    let events = [];
    if (id === 'que_loc') { run.money += CFG.QUE.LOC_LIXI; events = [{ type: 'que', id: id, lixi: CFG.QUE.LOC_LIXI }]; }
    else if (id === 'que_sao') {
      const types = Object.keys(run.sao), t = types[Math.floor(rand(run) * types.length)];
      run.sao[t] = (run.sao[t] || 1) + CFG.QUE.SAO_LEVELS; events = [{ type: 'que', id: id, sao: t }];
    } else if (!live) return fail(M.queVan);
    else if (id === 'que_doi') {
      if (van.turn !== 0) return fail(M.queTurn);
      if (!Array.isArray(sel) || !sel.length || sel.length > CFG.QUE.DOI_MAX) return fail(M.queSel);
      events = TL.Rules.swap(van, 0, sel, TL.makeRng((run.seed ^ 0x2545F491) + Math.imul(++run.rn, 40503) + van.log.length));
      if (!events.length) return fail(van.hands[0].length && sel.every(x => van.hands[0].includes(x)) ? M.queNoCard : M.queSel);
    } else if (id === 'que_them_van') { run.vanExtra = (run.vanExtra || 0) + CFG.QUE.THEM_VAN; events = [{ type: 'que', id: id, van: CFG.QUE.THEM_VAN }]; }
    else if (id === 'que_soi') { if (van.reveal[0]) return fail(M.queSoi); van.reveal[0] = true; events = [{ type: 'que', id: id }]; }
    else if (id === 'que_gap_doi') { if (run.flags.x2Next) return fail(M.queX2); run.flags.x2Next = true; events = [{ type: 'que', id: id }]; }
    else return fail(M.queVan);
    run.que[i] = null;
    return { ok: true, events: events, msg: '' };
  }

  function continueEndless(run) {
    if (run.phase !== 'won') return false;
    run.endless = true; run.chang++; run.ban = 0; drawBoss(run, run.chang);
    run.diemBan = 0; run.vanUsed = 0; run.vanExtra = 0; run.lastWinner = null; run.van = { stack: 0, oppTake: 0 };
    run.shop = { items: [], rerolls: 0, n: 0 }; run.paid = false; run.lastPayout = null; run.phase = 'ban';
    return 'ok';
  }

  function nextBan(run) {
    if (isLast(run)) { run.phase = 'won'; return 'won'; }
    if (run.ban === 2) { run.chang++; run.ban = 0; } else run.ban++;
    run.diemBan = 0; run.vanUsed = 0; run.vanExtra = 0; run.lastWinner = null; run.van = { stack: 0, oppTake: 0 };
    run.shop = { items: [], rerolls: 0, n: 0 }; run.paid = false; run.lastPayout = null; run.phase = 'ban';
    return 'ok';
  }

  const save = run => JSON.stringify(run);

  function load(str) {
    try {
      const r = JSON.parse(str);
      if (!r || typeof r !== 'object' || (r.v !== CFG.SAVE_VERSION && r.v !== 1) || !PHASES.includes(r.phase)) return null;
      if (r.v === 1) {   // v1 -> v2: new fields get defaults
        r.v = CFG.SAVE_VERSION; r.que = r.que || Array.from({ length: CFG.SHOP.QUE_SLOTS }, () => null); r.seen = r.seen || []; r.rn = r.rn || 0; r.endless = !!r.endless; r.vanExtra = r.vanExtra || 0; r.pack = r.pack || null;
        r.flags = r.flags || { x2Next: false }; r.bosses = r.bosses || []; if (typeof r.seed === 'number') for (let c = 0; c < 3; c++) if (!r.bosses[c]) drawBoss(r, c);
      }
      if (!Number.isInteger(r.chang) || r.chang < 0 || (r.chang > 2 && !r.endless) || !Number.isInteger(r.ban) || r.ban < 0 || r.ban > 2) return null;
      if (!Array.isArray(r.qn) || r.qn.length !== CFG.SHOP.QN_SLOTS || !r.sao || !r.van || !r.shop || !r.stats || typeof r.money !== 'number') return null;
      if (!Array.isArray(r.que) || r.que.length !== CFG.SHOP.QUE_SLOTS || r.que.some(q => q && !D.QUE[q]) || !Array.isArray(r.seen) || !Array.isArray(r.bosses) || !r.flags) return null;
      if (r.qn.some(s => s && !D.QUY_NHAN[s.id]) || TYPES.some(t => !(r.sao[t] >= 1))) return null;
      return r;
    } catch (e) { return null; }
  }

  TL.Run = { create: create, ban: ban, startVan: startVan, record: record, endVan: endVan, payout: payout, shop: shop, buy: buy, sell: sell, sellQue: sellQue, openPack: openPack, choosePack: choosePack, useQue: useQue, continueEndless: continueEndless, reroll: reroll, nextBan: nextBan, save: save, load: load };
})(globalThis.TL = globalThis.TL || {});
