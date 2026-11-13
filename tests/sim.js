/* tests/sim.js  node tests/sim.js [runs=300] [seed=1] : full runs (random bosses), TL.AI level 3 as player, greedy shop (Quý nhân, Sao, Quẻ, Bao lì xì) and Quẻ use, winners continue into endless. Prints one compact table + balance targets. */
const path = require('path'); const J = f => require(path.join(__dirname, '..', 'js', f));
['config', 'data', 'content', 'cards', 'rules', 'ai', 'scoring', 'run', 'profile'].forEach(J);
const TL = globalThis.TL, R = TL.Rules, Run = TL.Run, Sc = TL.Scoring, CFG = TL.CFG;
const RUNS = +process.argv[2] || 300, SEED = +process.argv[3] || 1;
const CHIEU = +process.argv[4] || 1, TREE = process.argv[5] === 'full', START = process.argv[6] || 'mac_dinh', SEATS = +process.argv[7] === 4 ? 4 : 2;   // node tests/sim.js [runs] [seed] [chieu 1-6] [empty|full tree] [start id] [seats 2|4]
const FORCE_BAU = process.argv[8] === 'bau';   // 8th arg: every run starts with a random Báu vật (compare its win rate with the same config without it)
const prof = TL.Profile.empty(); if (TREE) { CFG.META.TREE.forEach(n => { prof.nodes[n.id] = true; }); prof.best = 6; }
const OPTS = Object.assign(TL.Profile.options(prof, { start: START, chieu: CHIEU }), { seats: SEATS });
const QN_PRICE = id => CFG.PRICE.QN[id] || 99;   // Báu vật (no table price) counts as dearest   // greedy: the dearest affordable Quý nhân (info-only ones are worth nothing to this bot)
const USELESS = ['thay_boi', 'co_hang_xom'];
const QUE_BUY = ['que_loc', 'que_sao', 'que_gap_doi', 'que_them_van', 'que_doi'];   // que_soi is skipped: the AI cannot use the opponent's hand
const ever = {};   // quy nhan id -> {n, won}
let doiUsed = 0, giaoN = 0, giaoWon = 0; const bauRuns = { n: 0, won: 0 };
const NB = 9, bans = Array.from({ length: NB }, () => ({ n: 0, clear: 0, vans: 0, actions: 0, vanN: 0 }));
let won = 0, endlessReach5 = 0; const lateBest = [];

function apply(run, st, evs) { evs.forEach(e => Sc.onEvent(run, e)); Run.record(run, evs); return evs; }

function playVan(run, plays) {
  const st = Run.startVan(run); let actions = 0, end = null;
  apply(run, st, st.log.slice());
  if (st.over) end = st.log.find(e => e.type === 'vanEnd');
  for (let g = 0; !st.over; g++) {
    if (g > 400) throw new Error('van did not terminate');
    const seat = st.turn, lvl = seat === 0 ? 3 : CFG.AI_BY_CHANG[Math.min(run.chang, 2)];
    if (seat === 0) { useQue(run, st); if (!st.table && run.doi > 0 && run.van.suc <= 2) { const lows = st.hands[0].slice().sort((a, b) => a - b).slice(0, CFG.QUE.DOI_MAX); if (Run.doiBai(run, st, lows).ok) doiUsed++; } }
    const ch = TL.AI.choose(R.view(st, seat), lvl);
    if (seat === 0 && ch.type === 'play' && run.que.includes('que_gap_doi') && !run.flags.x2Next) { const sc = TL.Scoring.scorePlay(run, 0, TL.Cards.detect(ch.cardIds), { chat: false }); if (sc.total >= 120) Run.useQue(run, st, run.que.indexOf('que_gap_doi'), []); }
    const evs = ch.type === 'play' ? R.play(st, seat, ch.cardIds) : R.pass(st, seat);
    if (!evs.length) throw new Error('illegal ai move');
    if (seat === 0 && ch.type === 'play') { const c = evs[0].combo; plays[c.type] = (plays[c.type] || 0) + 1; }
    apply(run, st, evs); actions++;
    const ve = evs.find(e => e.type === 'vanEnd'); if (ve) end = ve;
  }
  return { end: end, actions: actions };
}

function useQue(run, st) {   // simple triggers: doi on the first turn of a ván, them_van on the last ván when behind
  if (st.plays[0] === 0 && st.turn === 0) {
    const i = run.que.indexOf('que_doi');
    if (i >= 0) {
      const lows = TL.AI.plan(st.hands[0]).filter(g => g.type === 'rac').map(g => g.cards[0]).sort((a, b) => a - b).slice(0, CFG.QUE.DOI_MAX);
      if (lows.length >= 2) Run.useQue(run, st, i, lows);
    }
    const j = run.que.indexOf('que_them_van'), b = Run.ban(run);
    if (j >= 0 && b.vanLeft === 1 && run.diemBan < b.target * 0.8) Run.useQue(run, st, j, []);
  }
}

function useShopQue(run) { run.que.forEach((q, i) => { if (q === 'que_loc' || q === 'que_sao') Run.useQue(run, null, i, []); }); }

function shopPolicy(run, plays) {
  for (let guard = 0; guard < 30; guard++) {
    const items = Run.shop(run); let pick = -1, best = -1;
    items.forEach((x, i) => { if (x.kind === 'qn' && !x.sold && !USELESS.includes(x.id) && run.money >= x.price && run.qn.slice(0, run.qnMax).includes(null) && QN_PRICE(x.id) > best) { best = QN_PRICE(x.id); pick = i; } });
    if (pick < 0) { let bn = -1; items.forEach((x, i) => { if (x.kind === 'sao' && !x.sold && run.money >= x.price) { const n = plays[TL.DATA.SAO[x.id].combo] || 0; if (n > bn) { bn = n; pick = i; } } }); }
    if (pick < 0 && run.que.includes(null)) { items.forEach((x, i) => { if (pick < 0 && x.kind === 'que' && !x.sold && QUE_BUY.includes(x.id) && run.money >= x.price + 2) pick = i; }); }
    if (pick < 0) { items.forEach((x, i) => { if (pick < 0 && x.kind === 'pack' && !x.sold && run.money >= x.price + 3 && (run.qn.includes(null) || run.que.includes(null))) pick = i; }); }
    if (pick < 0) break;
    const it = items[pick], res = Run.buy(run, pick); if (!res.ok) break;
    if (it.kind === 'pack') {   // take the dearest Quý nhân, else a Quẻ we can use
      const ch = res.choices; let k = -1, bp = -1;
      ch.forEach((c, i) => { if (c.kind === 'qn' && !USELESS.includes(c.id) && QN_PRICE(c.id) > bp) { bp = QN_PRICE(c.id); k = i; } });
      if (k < 0) ch.forEach((c, i) => { if (k < 0 && c.kind === 'que' && QUE_BUY.includes(c.id)) k = i; });
      Run.choosePack(run, k);
    }
    useShopQue(run);
  }
  useShopQue(run);
}

const lastBest = [];
for (let r = 0; r < RUNS; r++) {
  const run = Run.create((SEED * 100003 + r * 7919) >>> 0, OPTS), plays = {}; let guard = 0, wonThis = false;
  const owned = new Set();
  if (FORCE_BAU) { const bp = TL.DATA.BAU_IDS, k = (r * 2654435761 >>> 0) % bp.length, f = run.qn.slice(0, run.qnMax).indexOf(null); run.qn[f] = { id: bp[k], n: 0 }; }
  for (;;) {
    if (++guard > 400) throw new Error('run did not terminate');
    const idx = run.chang * 3 + run.ban, b = idx < 9 ? bans[idx] : { n: 0, clear: 0, vans: 0, actions: 0 }; b.n++;
    let res = 'next'; if (idx === 8) giaoN++;
    while (res === 'next') { const o = playVan(run, plays); b.vans++; b.actions += o.actions; run.qn.forEach(q => q && owned.add(q.id)); res = Run.endVan(run, o.end); }
    if (res === 'lost') break;
    b.clear++; if (idx === 8) giaoWon++;
    Run.payout(run);
    run.flags.x2Next = false;
    if (run.endless || idx < 8) shopPolicy(run, plays);
    run.qn.forEach(q => q && owned.add(q.id));
    if (Run.nextBan(run) === 'won') { if (!wonThis) { won++; wonThis = true; } Run.continueEndless(run); }
    if (run.chang >= 4 && wonThis && !run.reached5) { run.reached5 = true; endlessReach5++; }
  }
  if (run.phase !== 'lost') throw new Error('bad end phase');
  const hasBau = [...owned].some(id => TL.DATA.QUY_NHAN[id].rarity === 'bau'); if (hasBau) { bauRuns.n++; if (wonThis) bauRuns.won++; }
  owned.forEach(id => { const e = ever[id] || (ever[id] = { n: 0, won: 0 }); e.n++; if (wonThis) e.won++; });
  lastBest.push(run.stats.bestPot); if (run.chang >= 2) lateBest.push(run.stats.bestPot);
}
const pct = x => (100 * x).toFixed(0).padStart(3) + '%';
console.log('ban  reached clear  vans/ban actions/van');
let prevClear = null, flags = [];
bans.forEach((b, i) => {
  const rate = b.n ? b.clear / b.n : 0;
  console.log(('c' + (1 + (i / 3 | 0)) + 'b' + (1 + i % 3)).padEnd(5), String(b.n).padStart(6), pct(rate), (b.vans / (b.n || 1)).toFixed(2).padStart(9), (b.actions / (b.vans || 1)).toFixed(1).padStart(11));
  if (i > 0 && b.n && rate < 0.5) flags.push('c' + (1 + (i / 3 | 0)) + 'b' + (1 + i % 3) + '<50%');
});
const sorted = lastBest.slice().sort((a, b) => a - b), q = f => sorted[Math.min(sorted.length - 1, Math.floor(f * sorted.length))];
const ls = lateBest.slice().sort((a, b) => a - b), lq = f => ls.length ? ls[Math.min(ls.length - 1, Math.floor(f * ls.length))] : 0;
const w = won / RUNS, c1 = bans[3].n / RUNS;
const totA = bans.reduce((a, b) => a + b.actions, 0) / bans.reduce((a, b) => a + b.vans, 0);
console.log('runs ' + RUNS + ' seed ' + SEED + ' | won ' + pct(w) + ' | c1b1 ' + pct(c1) + ' | actions/van ' + totA.toFixed(1) + ' | bestPot(all) p50 ' + TL.fmt(q(0.5)) + ' p90 ' + TL.fmt(q(0.9)) + ' max ' + TL.fmt(sorted[sorted.length - 1]) + ' | late(c3 reached) p50 ' + TL.fmt(lq(0.5)) + ' p90 ' + TL.fmt(lq(0.9)));
const avgW = won / RUNS, qnRows = Object.keys(ever).filter(id => ever[id].n >= 20).map(id => ({ id: id, n: ever[id].n, w: ever[id].won / ever[id].n })).sort((a, b) => b.w - a.w);
const worst = qnRows[0], over = qnRows.filter(r => r.w > 2 * avgW);
console.log('quy nhan win rate (owned >= 20 runs), avg ' + pct(avgW) + ': ' + qnRows.slice(0, 5).map(r => r.id + ' ' + pct(r.w) + '/' + r.n).join(', ') + ' ... ' + qnRows.slice(-2).map(r => r.id + ' ' + pct(r.w) + '/' + r.n).join(', '));
const e5 = won ? endlessReach5 / won : 0;
console.log('endless: reached chang 5 in ' + pct(e5) + ' of won runs (target 10-30%) ' + (e5 >= .1 && e5 <= .3 ? 'OK' : 'MISS') + ' | no qn >2x avg: ' + (over.length ? 'MISS ' + over.map(r => r.id).join(',') : 'OK'));
console.log('targets: won 25-40% ' + (w >= .25 && w <= .4 ? 'OK' : 'MISS') + ', chang1 cleared ' + pct(c1) + ' >=85% ' + (c1 >= .85 ? 'OK' : 'MISS') + ', ban<50% ' + (flags.length ? flags.join(',') : 'none') + ', all runs terminated OK');

const ci = (a, n) => n ? 100 * a / n : 0;
console.log('config: chieu ' + CHIEU + ' tree ' + (TREE ? 'full' : 'empty') + ' start ' + START + ' seats ' + SEATS + ' | doi used/run ' + (doiUsed / RUNS).toFixed(2) + ' | giao thua (c3b3) reached ' + giaoN + ' cleared ' + pct(giaoN ? giaoWon / giaoN : 0) + ' (target 45-65%) | bau runs ' + bauRuns.n + ' win ' + pct(bauRuns.n ? bauRuns.won / bauRuns.n : 0) + ' = ' + (w && bauRuns.n ? (bauRuns.won / bauRuns.n / w).toFixed(2) : '-') + 'x avg (target <=1.6)');
