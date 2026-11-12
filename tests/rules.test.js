/* tests/rules.test.js  node tests/rules.test.js : prints only failures and one summary line */
const path = require('path'); const J = f => require(path.join(__dirname, '..', 'js', f));
['config', 'data', 'content', 'cards', 'rules', 'ai'].forEach(J);
const TL = globalThis.TL, C = TL.Cards, R = TL.Rules, AI = TL.AI, CFG = TL.CFG;
let n = 0, bad = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log('FAIL: ' + m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + ' got ' + JSON.stringify(a) + ' want ' + JSON.stringify(b));
const RK = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
const c1 = s => RK.indexOf(s.slice(0, -1)) * 4 + 'scdh'.indexOf(s.slice(-1));   // "10d" -> id (s c d h = ♠ ♣ ♦ ♥)
const ids = s => s.split(' ').map(c1);
const cb = s => C.detect(ids(s));
const stub = (seat, c, ctx) => ({ diem: c.len, the: 1, total: c.len * 10, steps: [], xPot: ctx.chat ? CFG.CHAT_X : undefined });
function setup(h0, h1, turn, mods, table) {
  const s = R.newVan({ rng: TL.makeRng(1), mods: mods || {}, scoreFn: stub });
  s.hands = [ids(h0).sort((a, b) => a - b), ids(h1).sort((a, b) => a - b)]; s.turn = turn; s.log = [];
  if (table) s.table = { combo: cb(table[0]), seat: table[1] };
  return s;
}

// ---- detect: every type, rejects
['5s:rac', '5s 5c:doi', '5s 5c 5d:sam', '5s 5c 5d 5h:tuquy', '3s 4c 5d:sanh', '10s Jc Qd Kh Ac:sanh', '3s 3c 4s 4c 5s 5c:doithong',
  '9s 9c 10s 10c Js Jc Qs Qc:doithong'].forEach(x => { const [a, t] = x.split(':'); ok(cb(a) && cb(a).type === t, a + ' is ' + t); });
['3s 5c', '3s 3c 4d', '3s 4c', 'Ks As 2s', 'Qs Ks As 2c', '3s 3c 4s 4c', 'As Ac 2s 2c 3s 3c', 'Ks Kc As Ac 2s 2c', '3s 3s', '2s 2c 2d', '3s 3c 5s 5c 6s 6c'].forEach(a => {
  const c = cb(a); ok(a === '2s 2c 2d' ? c.type === 'sam' : c === null, a + ' rejected');
});
ok(C.detect([]) === null && C.detect([3, 3]) === null && C.detect([60]) === null, 'detect invalid ids');
eq(cb('3s 4c 5d').cards, ids('3s 4c 5d'), 'cards ascending'); ok(cb('5s 4c 3d').top === c1('5s'), 'top = highest id');
ok(cb('10s Jc Qd Kh Ac 2s') === null, 'heo rejected at the end of sanh');
eq(C.makeDeck().length, 52, 'deck'); eq(C.label(c1('10d')), '10♦', 'label'); ok(C.isHeo(c1('2s')) && !C.isHeo(c1('As')), 'isHeo');
eq(C.sortHand(ids('As 3h 3s 5c'), 'rank'), ids('3s 3h 5c As'), 'sort rank'); eq(C.sortHand(ids('As 3h 3s 5c'), 'suit'), ids('3s As 5c 3h'), 'sort suit');

// ---- beats
const B = (a, t, m) => C.beats(cb(a), t && cb(t), m);
ok(B('3s', null) === 'beat', 'lead any');
ok(B('5h', '5s') === 'beat' && B('5s', '5h') === false && B('5c', '5s') === 'beat', 'suit tiebreak rac');
ok(B('6s', '5h') === 'beat' && B('4h', '5s') === false, 'rank beats suit');
ok(B('5d 5h', '5s 5c') === 'beat' && B('5s 5c', '5d 5h') === false, 'suit tiebreak doi');
ok(B('4s 5s 6h', '4c 5c 6d') === 'beat' && B('4s 5s 6s', '4c 5c 6d') === false, 'sanh top suit decides');
ok(B('4s 5s 6s 7s', '4c 5c 6d') === false && B('4s 5s 6s', '3s 3c') === false && B('4s 4c', '3s') === false, 'type/len must match');
ok(B('4s 4c 4d', '3s 3c 3d') === 'beat' && B('3s 3c 3d 3h', '4s 4c 4d 4h') === false, 'sam and tuquy order');
const heo = '2s', dh = '2s 2c', d3 = '3s 3c 4s 4c 5s 5c', d4 = '3s 3c 4s 4c 5s 5c 6s 6c', q = '9s 9c 9d 9h', qh = 'Ks Kc Kd Kh';
const exp = [[d3, heo, 'chat'], [q, heo, 'chat'], [d4, heo, 'chat'], ['3s 4s 5s', heo, false], ['3s 3c', heo, false], [q, dh, 'chat'], [d4, dh, 'chat'], [d3, dh, false],
  [q, d3, 'chat'], [d4, d3, 'chat'], [qh, q, 'chat'], [q, qh, false], [d4, q, 'chat'], [d3, q, false], [d3, d4, false], ['3s 3c 4s 4c 5s 5c 6s 6h', d4, 'beat'],
  ['4s 4c 5s 5c 6s 6c', d3, 'beat'], [heo, '2c', false], ['2c', heo, 'beat'], [d3, 'As', false], [q, '3s 3c 3d', false]];
exp.forEach(([a, t, r]) => ok(B(a, t) === r, 'chat table ' + a + ' vs ' + t + ' -> ' + r));
exp.forEach(([a, t, r]) => ok(B(a, t, { noChat: true }) === (r === 'chat' ? false : r), 'noChat ' + a + ' vs ' + t));

// ---- legalPlays
{
  const h = ids('3s 3c 3d 4s 4c 5s 5c 5d 6s 7h'), L = C.legalPlays(h, null, {}), keys = L.map(c => c.cards.join());
  ok(new Set(keys).size === keys.length, 'no duplicate card sets');
  ok(L.some(c => c.type === 'sanh' && c.len === 5) && L.some(c => c.type === 'sanh' && c.len === 3) && L.some(c => c.type === 'sanh' && c.len === 4), 'all sanh lengths');
  ok(L.some(c => c.type === 'doithong' && c.len === 6) && !L.some(c => c.type === 'doithong' && c.len === 8), 'doi thong 3 pairs only');
  eq(L.filter(c => c.type === 'doi').length, 3 + 1 + 3, 'every pair combination');
  ok(L[0].type === 'rac' && L[0].top === c1('3s'), 'weakest first');
  const h2 = ids('2s 2c 4s 4c 4d 4h 5s'), L2 = C.legalPlays(h2, cb('2d'), {});
  ok(L2.length === 1 && L2[0].type === 'tuquy', 'only chat options beat a heo');
  ok(C.legalPlays(h2, cb('2s'), {}).slice(-1)[0].type === 'tuquy', 'chat last');
  eq(C.legalPlays(h2, cb('2s'), { noChat: true }).map(c => c.cards[0]), [c1('2c')], 'noChat removes chat');
  eq(C.legalPlays(ids('3s 4c'), cb('5s 5c'), {}), [], 'nothing beats');
}

// ---- rules: leader, view, flow
{
  const mod = { rng: TL.makeRng(5), scoreFn: stub, mods: {} };
  const s = R.newVan(mod);
  eq([s.hands[0].length, s.hands[1].length], [10, 10], 'hand size'); eq(s.log.map(e => e.type), ['deal', 'turn'], 'newVan log');
  const low = Math.min(...s.hands[0], ...s.hands[1]); ok(s.hands[s.leader].includes(low) && s.turn === s.leader, 'lowest id leads');
  ok(R.newVan({ rng: TL.makeRng(5), scoreFn: stub, leader: 1 - s.leader, mods: {} }).turn === 1 - s.leader, 'opts.leader');
  ok(R.newVan({ rng: TL.makeRng(5), scoreFn: stub, leader: 0, mods: { oppLeads: true } }).turn === 1, 'oppLeads');
  const a = R.newVan({ rng: TL.makeRng(9), scoreFn: stub }), b = R.newVan({ rng: TL.makeRng(9), scoreFn: stub });
  eq(a.hands, b.hands, 'same seed same deal');
  const v = R.view(s, 0), js = JSON.stringify(v);
  ok(!('hands' in v) && !('log' in v) && v.hand.length === 10 && v.oppCount === 10, 'view shape');
  ok(s.hands[1].every(x => !v.hand.includes(x)) && !js.includes('"hands"'), 'view hides opponent hand');
  eq(Object.keys(v).sort(), ['canPass', 'hand', 'lead', 'legal', 'mods', 'oppCount', 'played', 'plays', 'pot', 'seat', 'table', 'turn'], 'view keys');
  eq(R.view(s, 1 - s.turn).legal, [], 'no legal moves off-turn'); ok(R.winner(s) === null, 'winner null');
}
{ // play / pass flow, pot, chat formula, chat chong
  const s = setup('2s 5c 9d', '3s 3c 4s 4c 5s 5c 7d 8h 9h', 0);
  eq(R.play(s, 1, ids('3s')), [], 'wrong turn'); eq(R.play(s, 0, ids('4h')), [], 'card not in hand'); eq(R.pass(s, 0), [], 'leader cannot pass');
  eq(R.legal(s, 0).canPass, false, 'leader canPass false');
  const e = R.play(s, 0, ids('2s'));
  eq(e.map(x => x.type), ['play', 'turn'], 'play events'); ok(e[0].pot === 10 && s.pot === 10 && e[1].seat === 1 && !e[1].lead, 'pot after play');
  const before = JSON.stringify([s.hands, s.pot, s.table, s.turn]);
  eq(R.play(s, 1, ids('3s 3c')), [], 'doi cannot beat rac'); eq(R.play(s, 1, ids('3s 4s 5s')), [], 'non-combo / wrong'); eq(R.pass(s, 0), [], 'pass wrong turn');
  ok(before === JSON.stringify([s.hands, s.pot, s.table, s.turn]), 'illegal moves change nothing');
  const c = R.play(s, 1, ids('3s 3c 4s 4c 5s 5c'));
  eq(c.map(x => x.type), ['play', 'chat', 'turn'], 'chat events'); ok(c[0].pot === 70 && c[1].pot === 140 && c[1].xPot === CFG.CHAT_X && s.pot === 140, 'chat pot (10+60)x2');
  ok(c[1].victim === 0 && c[1].target.type === 'rac' && c[1].seat === 1, 'chat event fields');
  s.hands[0].push(...ids('Kh Kd Kc Ks')); s.hands[0].sort((a, b) => a - b);
  const c2 = R.play(s, 0, ids('Ks Kc Kd Kh'));
  ok(c2[1].type === 'chat' && c2[1].pot === (140 + 40) * 2 && c2[1].target.type === 'doithong', 'chat chong: tuquy on doi thong');
  s.hands[1].push(...ids('6s 6c 7s 7c')); s.hands[1].sort((a, b) => a - b);
  const c3 = R.play(s, 1, ids('3s 3c').concat([])); eq(c3, [], 'doi cannot beat tuquy');
  const p = R.pass(s, 1);
  eq(p.map(x => x.type), ['pass', 'vong', 'turn'], 'pass events'); ok(p[1].winner === 0 && p[1].pot === 360 && p[1].combo.type === 'tuquy', 'last player takes pot');
  ok(p[2].seat === 0 && p[2].lead && s.table === null && s.pot === 0 && s.turn === 0, 'winner leads next vong');
  eq(s.log.length, e.length + c.length + c2.length + p.length, 'events appended to log');
}
{ // end of van: empty hand, thoi heo, cong
  const s = setup('3s', '2s 2c 4d 5d', 0);
  const e = R.play(s, 0, ids('3s')), ve = e[e.length - 1];
  eq(e.map(x => x.type), ['play', 'vong', 'vanEnd'], 'van end events');
  ok(ve.winner === 0 && ve.left[0] === 0 && ve.left[1] === 4 && ve.heo[1] === 2 && ve.cong === true && ve.toiTrang === false, 'thoi heo + cong flags');
  ok(s.over && R.winner(s) === 0 && e[1].winner === 0 && e[1].pot === 10, 'winner takes the pot'); eq(R.play(s, 1, ids('4d')), [], 'no play after over');
  eq(R.legal(s, 1), { plays: [], canPass: false }, 'no legal after over');
  const t = setup('3s 4s', '5d 2h', 0); R.play(t, 0, ids('3s')); R.play(t, 1, ids('5d'));
  eq(R.play(t, 0, ids('4s')), [], '4s cannot beat 5d'); R.pass(t, 0); const g = R.play(t, 1, ids('2h')); const ve2 = g[g.length - 1];
  ok(ve2.type === 'vanEnd' && ve2.winner === 1 && ve2.cong === false && ve2.left[0] === 1 && ve2.heo[0] === 0, 'not cong when loser played');
}
{ // toi trang
  let seed = 0, s = null;
  while (!s) { const t = R.newVan({ rng: TL.makeRng(++seed), scoreFn: stub }); if (t.toiTrang !== null) s = t; }
  eq(s.log.map(e => e.type), ['deal', 'toiTrang', 'vanEnd'], 'toi trang events');
  const ve = s.log[2]; ok(s.over && s.winner === s.toiTrang && ve.toiTrang && ve.winner === s.winner && ve.pot === 0 && s.log[1].seat === s.winner, 'toi trang winner');
  eq(s.log[1].cards, [48, 49, 50, 51], 'toi trang cards'); eq(R.legal(s, s.turn).plays, [], 'no turns after toi trang');
}
{ // mods
  const mb = { mustBeat: true };
  let s = setup('3s 9c', '5d 6d 7d', 1, mb, ['4h', 0]);
  eq(R.pass(s, 1), [], 'mustBeat: cannot pass when a beat exists'); ok(R.legal(s, 1).canPass === false, 'mustBeat canPass false');
  s = setup('3s 9c', '3d 3c', 1, mb, ['4h', 0]); ok(R.legal(s, 1).canPass === true && R.pass(s, 1).length === 3, 'mustBeat: must pass with no beat');
  s = setup('3s 9c', '5d 6d 7d', 0, mb, ['4h', 1]); eq(R.pass(s, 0), [], 'mustBeat applies to seat 0 too');
  s = setup('3s 9c', '5d 6d 7d', 1, {}, ['4h', 0]); ok(R.pass(s, 1).length === 3, 'no mustBeat: free pass');
  s = setup('3s 9c', '5d 6d 7d', 1, {}, ['4h', 0]); ok(R.legal(s, 1).canPass, 'canPass');
  const nc = { noChat: true };
  s = setup('3s 3c 4s 4c 5s 5c 8d', '2h 9d', 0, nc, ['2s', 1]); eq(R.play(s, 0, ids('3s 3c 4s 4c 5s 5c')), [], 'noChat rejects play'); eq(R.legal(s, 0).plays, [], 'noChat legal empty');
  ok(R.legal(s, 0).canPass, 'noChat: must pass');
  s = setup('3s 3c 4s 4c 5s 5c 8d', '2h 9d', 0, {}, ['2s', 1]); ok(R.play(s, 0, ids('3s 3c 4s 4c 5s 5c')).length === 3, 'chat allowed without noChat');
}

// ---- AI behaviour
const mkView = (hand, table, o) => {
  o = o || {}; const t = table ? { combo: cb(table), seat: 1 } : null;
  const legal = C.legalPlays(ids(hand), t && t.combo, o.mods || {});
  return { seat: 0, hand: ids(hand), oppCount: o.opp || 6, table: t, pot: o.pot || 0, turn: 0, lead: !t, played: o.played || [], plays: [0, 0], mods: o.mods || {},
    legal: legal, canPass: !!t && !(o.mods && o.mods.mustBeat && legal.length) };
};
const mid = () => 0.5;
{
  let m = AI.choose(mkView('3s 3c 9d Jh Kc', null), 3, mid); eq(m, { type: 'play', cardIds: ids('3s 3c') }, 'leads weakest group');
  m = AI.choose(mkView('7s 7c 7d 7h 4d Jc', null), 3, mid); eq(m, { type: 'play', cardIds: ids('4d') }, 'does not lead a bomb');
  m = AI.choose(mkView('3s 4c 5d 9h 9s Kd', null), 3, mid); ok(m.type === 'play' && m.cardIds.length === 3 && cb('3s 4c 5d').cards.join() === m.cardIds.join(), 'plans sanh first');
  eq(AI.plan(ids('3s 4c 5d 6h 9h 9s Kd')).map(c => c.type).sort(), ['doi', 'rac', 'sanh'], 'plan groups');
  m = AI.choose(mkView('Kc 2s 4c 9d Jh', null, { opp: 8 }), 2, mid); ok(m.type === 'play', 'leads something');
  m = AI.choose(mkView('9h', '5d'), 3, mid); eq(m, { type: 'play', cardIds: ids('9h') }, 'always finishes');
  m = AI.choose(mkView('2s 4c 5d 9h Jc', 'Ad', { opp: 6 }), 3, mid); eq(m, { type: 'pass' }, 'holds heo on a low pot');
  m = AI.choose(mkView('2s 4c 5d 9h Jc', 'Ad', { opp: 3 }), 3, mid); eq(m, { type: 'play', cardIds: ids('2s') }, 'plays heo when opp has <= 3 cards');
  m = AI.choose(mkView('2s 4c 5d 9h Jc', 'Ad', { opp: 6, pot: 500 }), 3, mid); eq(m, { type: 'play', cardIds: ids('2s') }, 'plays heo when pot is big');
  m = AI.choose(mkView('4c 4d 4s 4h 5d 9h Jc', '2s', { opp: 6 }), 3, mid); eq(m, { type: 'pass' }, 'holds bomb on a low pot');
  m = AI.choose(mkView('4c 4d 4s 4h 5d 9h Jc', '2s', { opp: 6, pot: 500 }), 3, mid); eq(m, { type: 'play', cardIds: ids('4s 4c 4d 4h') }, 'bombs a heo when pot is worth it');
  m = AI.choose(mkView('6c Kd 9h Jc 3s', '5d', { opp: 6 }), 3, mid); ok(m.type === 'play', 'follows');
  ok(m.type === 'play' && C.legalPlays(ids('6c Kd 9h Jc 3s'), cb('5d'), {}).some(c => c.cards.join() === m.cardIds.join()), 'follow is legal');
  m = AI.choose(mkView('3s 5d', '9h', { opp: 6 }), 1, mid); eq(m, { type: 'pass' }, 'no beat -> pass');
  m = AI.choose(mkView('3s 5d', '9h', { opp: 6, mods: { mustBeat: true } }), 1, mid); eq(m, { type: 'pass' }, 'no beat with mustBeat -> pass');
  const v = mkView('Ks 5d', '9h', { mods: { mustBeat: true } }); m = AI.choose(v, 1, () => 0); ok(m.type === 'play', 'mustBeat never passes');
  eq(AI.choose(v, 2), AI.choose(v, 2), 'default rng deterministic');
}

// ---- AI vs AI, 500 seeded vans
{
  let worst = 0, fails = 0, vans = 0, tt = 0;
  const modsL = [{}, { oppLeads: true }, { noChat: true }, { mustBeat: true }];
  for (let seed = 1; seed <= 500 && fails < 5; seed++) {
    const mods = modsL[seed % 4], lv = [1 + seed % 3, 1 + (seed >> 2) % 3], rng = TL.makeRng(seed * 7919);
    const s = R.newVan({ rng: TL.makeRng(seed), mods: mods, scoreFn: stub, leader: seed & 1 });
    let acts = 0;
    while (!s.over && acts < 60) {
      const seat = s.turn, v = R.view(s, seat), m = TL.AI.choose(v, lv[seat], rng);
      ok(!('hands' in v) && !('log' in v), 'AI got only a view');
      const legalOk = m.type === 'pass' ? v.canPass : v.legal.some(c => c.cards.join() === m.cardIds.join());
      if (!legalOk) { ok(false, 'illegal AI move seed ' + seed + ' ' + JSON.stringify(m)); fails++; break; }
      const e = m.type === 'pass' ? R.pass(s, seat) : R.play(s, seat, m.cardIds);
      if (!e.length) { ok(false, 'engine rejected AI move seed ' + seed); fails++; break; }
      acts++;
    }
    worst = Math.max(worst, acts); vans++; if (s.toiTrang !== null) tt++;
    ok(s.over && (s.winner === 0 || s.winner === 1) && acts < 60, 'van finished with winner under 60 actions seed ' + seed + ' acts ' + acts);
  }
  ok(vans === 500 || fails > 0, 'ran 500 vans');
}
console.log(bad ? bad + ' FAILED of ' + n + ' checks' : 'ok: ' + n + ' checks passed');
process.exitCode = bad ? 1 : 0;
