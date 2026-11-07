/* tests/sim.js  node tests/sim.js [runs=300] [seed=1] : full runs, TL.AI level 3 as player, simple shop policy. Prints one compact table. */
const path = require('path'); const J = f => require(path.join(__dirname, '..', 'js', f));
['config', 'data', 'cards', 'rules', 'ai', 'scoring', 'run'].forEach(J);
const TL = globalThis.TL, R = TL.Rules, Run = TL.Run, Sc = TL.Scoring, CFG = TL.CFG;
const RUNS = +process.argv[2] || 300, SEED = +process.argv[3] || 1;
const QN_PRIO = ['ong_do', 'ba_ban_xoi', 'heo_dat', 'thang_ban_than', 'dan_cho_lon', 'chu_xe_om', 'thay_boi', 'co_hang_xom'];
const NB = 9, bans = Array.from({ length: NB }, () => ({ n: 0, clear: 0, vans: 0, actions: 0, vanN: 0 }));
let won = 0; const lateBest = [];

function apply(run, st, evs) { evs.forEach(e => Sc.onEvent(run, e)); Run.record(run, evs); return evs; }

function playVan(run, plays) {
  const st = Run.startVan(run); let actions = 0, end = null;
  apply(run, st, st.log.slice());
  if (st.over) end = st.log.find(e => e.type === 'vanEnd');
  for (let g = 0; !st.over; g++) {
    if (g > 400) throw new Error('van did not terminate');
    const seat = st.turn, lvl = seat === 0 ? 3 : CFG.AI_BY_CHANG[run.chang];
    const ch = TL.AI.choose(R.view(st, seat), lvl);
    const evs = ch.type === 'play' ? R.play(st, seat, ch.cardIds) : R.pass(st, seat);
    if (!evs.length) throw new Error('illegal ai move');
    if (seat === 0 && ch.type === 'play') { const c = evs[0].combo; plays[c.type] = (plays[c.type] || 0) + 1; }
    apply(run, st, evs); actions++;
    const ve = evs.find(e => e.type === 'vanEnd'); if (ve) end = ve;
  }
  return { end: end, actions: actions };
}

function shopPolicy(run, plays) {
  for (let guard = 0; guard < 20; guard++) {
    const items = Run.shop(run); let pick = -1;
    for (const id of QN_PRIO) { const i = items.findIndex(x => x.kind === 'qn' && x.id === id && !x.sold); if (i >= 0 && run.money >= items[i].price && run.qn.includes(null)) { pick = i; break; } }
    if (pick < 0) {
      let bestN = -1;
      items.forEach((x, i) => { if (x.kind === 'sao' && !x.sold && run.money >= x.price) { const n = plays[TL.DATA.SAO[x.id].combo] || 0; if (n > bestN) { bestN = n; pick = i; } } });
    }
    if (pick < 0 || !Run.buy(run, pick).ok) break;
  }
}

const lastBest = [];
for (let r = 0; r < RUNS; r++) {
  const run = Run.create((SEED * 100003 + r * 7919) >>> 0), plays = {}; let guard = 0;
  for (;;) {
    if (++guard > 20) throw new Error('run did not terminate');
    const b = bans[run.chang * 3 + run.ban]; b.n++;
    let res = 'next';
    while (res === 'next') { const o = playVan(run, plays); b.vans++; b.actions += o.actions; res = Run.endVan(run, o.end); }
    if (res === 'lost') break;
    b.clear++;
    Run.payout(run);
    if (run.chang * 3 + run.ban < 8) shopPolicy(run, plays);
    if (Run.nextBan(run) === 'won') { won++; break; }
  }
  if (run.phase !== 'lost' && run.phase !== 'won') throw new Error('bad end phase');
  lastBest.push(run.stats.bestPot); if (run.chang === 2) lateBest.push(run.stats.bestPot);
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
console.log('targets: won 25-40% ' + (w >= .25 && w <= .4 ? 'OK' : 'MISS') + ', chang1 cleared ' + pct(c1) + ' >=85% ' + (c1 >= .85 ? 'OK' : 'MISS') + ', ban<50% ' + (flags.length ? flags.join(',') : 'none') + ', all runs terminated OK');
