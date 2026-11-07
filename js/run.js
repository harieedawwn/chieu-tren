/* js/run.js  (owner BALANCE) run state, bàn flow, payout, shop, save. Pure logic, no DOM. Needs config, data, rules, scoring.
 * API  (RunState is plain JSON, SPEC §4)
 *   TL.Run.create(seed) -> run            new run at chặng 1 bàn 1, phase 'ban'
 *   TL.Run.ban(run) -> BanInfo            current bàn (target, opp, luật nhà, mods, ván left)
 *   TL.Run.startVan(run) -> VanState      Rules.newVan with house mods + scoreFn bound to run; sets reveal (Thầy bói)
 *   TL.Run.record(run, events)            stats, Điểm bàn += pot on vòng won by seat 0, opponent take, lastWinner
 *   TL.Run.endVan(run, vanEndEvent) -> 'next'|'cleared'|'lost'   vanUsed++, vanNo++, applies vanBonus, floors Điểm bàn at 0
 *   TL.Run.payout(run) -> {lines:[{label, amount}], total}   applies once (repeat call returns the same lines)
 *   TL.Run.shop(run) -> ShopItem[]        2 Quý nhân + 2 Sao, seeded
 *   TL.Run.buy(run, i) -> {ok, why?}      why: 'money'|'slots'|'sold'
 *   TL.Run.sell(run, slot) -> {ok}        TL.Run.reroll(run) -> {ok, why?}
 *   TL.Run.nextBan(run) -> 'ok'|'won'     leaves the shop for the next bàn (or ends the run)
 *   TL.Run.save(run) -> string            TL.Run.load(str) -> run|null (bad or old save -> null)
 */
(function (TL) {
  'use strict';
  const CFG = TL.CFG, D = TL.DATA, T = D.TEXT, S = TL.Scoring;
  const SAO_IDS = Object.keys(D.SAO), QN_IDS = Object.keys(D.QUY_NHAN), TYPES = ['rac', 'doi', 'sam', 'sanh', 'doithong', 'tuquy'];
  const PHASES = ['ban', 'payout', 'shop', 'won', 'lost'];

  function create(seed) {
    seed = (seed === undefined ? Date.now() : seed) >>> 0;
    const sao = {}; TYPES.forEach(t => { sao[t] = 1; });
    return {
      v: CFG.SAVE_VERSION, seed: seed, vanNo: 0, phase: 'ban', chang: 0, ban: 0, money: CFG.START_MONEY,
      qn: Array.from({ length: CFG.SHOP.QN_SLOTS }, () => null), sao: sao, diemBan: 0, vanUsed: 0, lastWinner: null,
      van: { stack: 0, oppTake: 0 }, shop: { items: [], rerolls: 0, n: 0 }, paid: false, lastPayout: null,
      stats: { vans: 0, wins: 0, chat: 0, bestPlay: 0, bestPot: 0, toiTrang: 0, earned: 0 },
    };
  }

  function ban(run) {
    const c = D.CHANG[run.chang], b = c.ban[run.ban], h = b.house ? D.HOUSE_RULES[b.house] : null;
    return {
      chang: run.chang, ban: run.ban, kind: b.kind, name: b.name, opp: b.id, tag: b.tag, house: h ? h.id : null,
      rule: h ? { name: h.name, quote: h.quote } : null, mods: h ? Object.assign({}, h.mods) : {},
      target: CFG.TARGETS[run.chang][run.ban], aiLevel: CFG.AI_BY_CHANG[run.chang], vanMax: CFG.VAN_PER_BAN,
      vanUsed: run.vanUsed, vanLeft: CFG.VAN_PER_BAN - run.vanUsed, diem: run.diemBan, last: run.chang === 2 && run.ban === 2,
    };
  }

  function startVan(run) {
    const b = ban(run), rng = TL.makeRng((run.seed + 7919 * run.vanNo) >>> 0);
    run.van = { stack: 0, oppTake: 0 };
    const st = TL.Rules.newVan({
      rng: rng, handSize: CFG.HAND_SIZE, leader: run.vanUsed > 0 && run.lastWinner !== null ? run.lastWinner : undefined, mods: b.mods,
      scoreFn: (seat, combo, ctx) => S.scorePlay(run, seat, combo, ctx),
    });
    st.reveal = S.slotOf(run, 'thay_boi') >= 0 ? st.hands[1].slice(-CFG.QN.THAY_BOI_REVEAL) : [];
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
    if (run.vanUsed >= CFG.VAN_PER_BAN) { run.phase = 'lost'; return 'lost'; }
    return 'next';
  }

  const isLast = run => run.chang === 2 && run.ban === 2;

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

  function roll(run) {
    const rng = TL.makeRng((run.seed ^ 0x9E3779B9) + 104729 * (run.vanNo + 1) + 15485863 * run.shop.n); run.shop.n++;
    const pick = (pool, k) => { const p = pool.slice(), o = []; while (o.length < k && p.length) o.push(p.splice(Math.floor(rng() * p.length), 1)[0]); return o; };
    const owned = run.qn.filter(Boolean).map(s => s.id);
    const qs = pick(QN_IDS.filter(id => !owned.includes(id)), CFG.SHOP.QN_COUNT).map(id => ({ kind: 'qn', id: id, price: CFG.PRICE.QN[id], sold: false }));
    const ss = pick(SAO_IDS, CFG.SHOP.SAO_COUNT).map(id => ({ kind: 'sao', id: id, price: CFG.PRICE.SAO, sold: false }));
    run.shop.items = qs.concat(ss);
  }

  function shop(run) { if (!run.shop.items.length) roll(run); return run.shop.items; }

  function buy(run, i) {
    const it = shop(run)[i];
    if (!it || it.sold) return { ok: false, why: 'sold' };
    const free = run.qn.indexOf(null);
    if (it.kind === 'qn' && free < 0) return { ok: false, why: 'slots' };
    if (run.money < it.price) return { ok: false, why: 'money' };
    run.money -= it.price; it.sold = true;
    if (it.kind === 'qn') run.qn[free] = { id: it.id, n: 0 }; else { const t = D.SAO[it.id].combo; run.sao[t] = (run.sao[t] || 1) + 1; }
    return { ok: true };
  }

  function sell(run, slot) {
    const s = run.qn[slot];
    if (!s) return { ok: false };
    run.money += Math.floor(CFG.PRICE.QN[s.id] * CFG.SHOP.SELL_RATIO); run.qn[slot] = null;
    return { ok: true };
  }

  function reroll(run) {
    const cost = CFG.SHOP.REROLL_BASE + CFG.SHOP.REROLL_STEP * run.shop.rerolls;
    if (run.money < cost) return { ok: false, why: 'money' };
    run.money -= cost; run.shop.rerolls++; roll(run);
    return { ok: true };
  }

  function nextBan(run) {
    if (isLast(run)) { run.phase = 'won'; return 'won'; }
    if (run.ban === 2) { run.chang++; run.ban = 0; } else run.ban++;
    run.diemBan = 0; run.vanUsed = 0; run.lastWinner = null; run.van = { stack: 0, oppTake: 0 };
    run.shop = { items: [], rerolls: 0, n: 0 }; run.paid = false; run.lastPayout = null; run.phase = 'ban';
    return 'ok';
  }

  const save = run => JSON.stringify(run);

  function load(str) {
    try {
      const r = JSON.parse(str);
      if (!r || typeof r !== 'object' || r.v !== CFG.SAVE_VERSION || !PHASES.includes(r.phase)) return null;
      if (!Number.isInteger(r.chang) || r.chang < 0 || r.chang > 2 || !Number.isInteger(r.ban) || r.ban < 0 || r.ban > 2) return null;
      if (!Array.isArray(r.qn) || r.qn.length !== CFG.SHOP.QN_SLOTS || !r.sao || !r.van || !r.shop || !r.stats || typeof r.money !== 'number') return null;
      if (r.qn.some(s => s && !D.QUY_NHAN[s.id]) || TYPES.some(t => !(r.sao[t] >= 1))) return null;
      return r;
    } catch (e) { return null; }
  }

  TL.Run = { create: create, ban: ban, startVan: startVan, record: record, endVan: endVan, payout: payout, shop: shop, buy: buy, sell: sell, reroll: reroll, nextBan: nextBan, save: save, load: load };
})(globalThis.TL = globalThis.TL || {});
