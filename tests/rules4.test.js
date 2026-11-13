/* tests/rules4.test.js  node tests/rules4.test.js : 4-seat engine (D8): bỏ-ra-vòng, chặt, thưởng cuối, AI view, Run integration. Prints only failures and one summary line */
const path = require('path'); const J = f => require(path.join(__dirname, '..', 'js', f));
['config', 'data', 'content', 'cards', 'rules', 'ai', 'scoring', 'run'].forEach(J);
const TL = globalThis.TL, C = TL.Cards, R = TL.Rules, AI = TL.AI, Run = TL.Run, S = TL.Scoring, CFG = TL.CFG;
let n = 0, bad = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log('FAIL: ' + m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + ' got ' + JSON.stringify(a) + ' want ' + JSON.stringify(b));
const RK = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
const id1 = s => RK.indexOf(s.slice(0, -1)) * 4 + 'scdh'.indexOf(s.slice(-1));
const ids = s => s.split(' ').map(id1);
const van = (hs, mods, o) => R.newVan(Object.assign({ rng: TL.makeRng(1), seats: 4, hands: hs.map(ids), mods: mods || {}, leader: 0 }, o || {}));
const sf = (seat, c) => ({ diem: 10, the: 1, total: 10, steps: [] });

// ---- deal and 2-seat default untouched
let v = R.newVan({ rng: TL.makeRng(5), seats: 4 });
eq(v.hands.map(h => h.length), [10, 10, 10, 10], '4 seats x HAND_SIZE_4');
eq(new Set([].concat(...v.hands)).size, 40, '40 distinct cards');
ok(v.seats === 4 && v.passed.length === 4 && v.passes.length === 4, 'state arrays sized 4');
eq(R.newVan({ rng: TL.makeRng(5) }).hands.map(h => h.length), [10, 10], '2 seats default');

// ---- bỏ ra khỏi vòng: seat 0 leads, 1 and 2 pass, 3 plays, 0 passes -> 3 takes hu, leads
v = van(['3s 9s 9c', '4s 5s 6s', '7s 8s 10s', 'Js Qs Ks'], null, { scoreFn: sf });
ok(R.play(v, 0, ids('3s')).length > 0, '0 leads 3s');
eq(v.turn, 1, 'turn goes to 1');
ok(R.pass(v, 0).length === 0, 'seat 0 cannot pass out of turn');
R.pass(v, 1); eq(v.turn, 2, 'after pass turn 2'); R.pass(v, 2); eq(v.turn, 3, 'turn 3');
let ev = R.play(v, 3, ids('Js')); ok(ev.length > 0, '3 beats');
eq(v.turn, 0, 'seat 0 next (1 and 2 stay out)');
ev = R.pass(v, 0); eq(ev.map(e => e.type), ['pass', 'vong', 'turn'], 'last other passes: vong ends');
eq([ev[1].winner, ev[2].seat, ev[2].lead, v.pot, v.table], [3, 3, true, 0, null], 'seat 3 takes pot and leads, table clear');
eq(v.passed, [false, false, false, false], 'passed reset');
// skip seats that have passed inside a vòng
v = van(['3s 4s Ks', '5s 5c 6s', '7s 8s 10s', 'Js Qs Ks'], null, { scoreFn: sf });
R.play(v, 0, ids('3s')); R.pass(v, 1);
R.play(v, 2, ids('7s')); R.play(v, 3, ids('Js'));
eq(v.turn, 0, 'seat 1 skipped, 0 plays again'); R.play(v, 0, ids('Ks')); eq(v.turn, 2, 'seat 1 still skipped');
ok(R.pass(v, 1).length === 0, 'passed seat cannot act'); ok(R.legal(v, 1).plays.length === 0, 'no legal for passed seat');

// ---- chặt in 4 seats (heo chặt by tứ quý) multiplies the pot
v = van(['3s 9s', '2s 4s', '5s 5c 5d 5h 6s', '7s 8s'], null, { scoreFn: sf });
R.play(v, 0, ids('3s')); R.play(v, 1, ids('2s'));
ev = R.play(v, 2, ids('5s 5c 5d 5h'));
ok(ev.some(e => e.type === 'chat' && e.victim === 1 && e.xPot === CFG.CHAT_X), 'tu quy chat heo from seat 2');
eq(v.pot, (10 + 10 + 10) * CFG.CHAT_X, 'pot multiplied');

// ---- end: seat 2 goes out, collects from every seat
v = van(['3s 9s', '4s 2s 2c', '8s', 'Ks Kc 2d'], null, { scoreFn: sf });
R.play(v, 0, ids('3s')); R.pass(v, 1); ev = R.play(v, 2, ids('8s'));
const ve = ev.find(e => e.type === 'vanEnd');
ok(ve && ve.winner === 2, 'seat 2 out first');
eq(ve.left, [1, 3, 0, 3], 'left per seat'); eq(ve.heo, [0, 2, 0, 1], 'heo per seat'); eq(ve.congN, 2, 'seats 1 and 3 never played'); ok(ve.cong, 'cong flag');
ok(ev.some(e => e.type === 'vong' && e.winner === 2), 'out player takes the hu');
ok(R.legal(v, 0).plays.length === 0 && v.over, 'ván over');

// ---- toi trang in any seat
v = van(['3s 9s', '4s 5s', '6s 7s', '2s 2c 2d 2h'], null, { scoreFn: sf });
ok(v.over && v.winner === 3 && v.toiTrang === 3, 'quad 2 in seat 3 wins at once');

// ---- vanBonus: player win sums the other seats
const run = Run.create(1);
let b = S.vanBonus(run, { winner: 0, left: [0, 2, 3, 1], heo: [0, 1, 0, 1], congN: 2, cong: true, toiTrang: false });
eq(b.diem, 6 * CFG.LEFT_PTS, 'win diem sums left of 3 AI'); eq(b.the, Math.pow(CFG.THOI_X, 2) * Math.pow(CFG.CONG_X, 2), 'the: heo and cong per seat');
b = S.vanBonus(run, { winner: 1, left: [3, 0, 2, 2], heo: [2, 0, 0, 0], congN: 0, cong: false, toiTrang: false });
eq(b.total, -CFG.THOI_PENALTY * 2, 'AI win: player thoi penalty');
b = S.vanBonus(run, { winner: 0, left: [0, 4], heo: [0, 1], cong: true, toiTrang: false });
eq(b.the, CFG.THOI_X * CFG.CONG_X, '1v1 bonus unchanged');

// ---- view and AI
v = van(['3s 4s 9c', '5s 5c 6s 7s', '7d 8s 10s', 'Js Qs Ks'], null, { scoreFn: sf });
R.play(v, 0, ids('3s')); R.pass(v, 1);
let vw = R.view(v, 2);
eq([vw.seats, vw.counts, vw.passed, vw.oppCount], [4, [2, 4, 3, 3], [false, true, false, false], 2], 'view carries counts and passed');
ok(!vw.oppHand && !vw.oppHands, 'no hands leak');
v.reveal[2] = true; ok(R.view(v, 2).oppHands.length === 3, 'revealed -> oppHands of 3 seats');

// ---- 1000 seeded 4-seat vans, all AI levels, always end validly
let ends = 0, evTotal = 0;
for (let seed = 1; seed <= 1000; seed++) {
  const st = R.newVan({ rng: TL.makeRng(seed), seats: 4, scoreFn: sf }), lv = [1, 2, 3];
  const before = [].concat(...st.hands).sort((a, b) => a - b).join();
  let guard = 0;
  while (!st.over && guard++ < 600) {
    const seat = st.turn, view = R.view(st, seat), mv = AI.choose(view, lv[(seed + seat) % 3]);
    const e = mv.type === 'pass' ? R.pass(st, seat) : R.play(st, seat, mv.cardIds);
    if (!e.length) { ok(false, 'AI illegal move seed ' + seed + ' seat ' + seat + ' ' + JSON.stringify(mv)); break; }
    evTotal += e.length;
  }
  if (!st.over) { ok(false, 'van did not end seed ' + seed); continue; }
  ends++;
  const z = st.hands.map(h => h.length).filter(x => x === 0).length;
  if (z !== (st.toiTrang !== null ? 0 : 1)) ok(false, 'exactly one seat out seed ' + seed + ' got ' + z);
  const after = [].concat(...st.hands, st.played).sort((a, b) => a - b).join();
  if (after !== before) ok(false, 'cards conserved seed ' + seed);
  const last = st.log[st.log.length - 1];
  if (last.type !== 'vanEnd' || last.winner !== st.winner) ok(false, 'last event vanEnd seed ' + seed);
}
ok(ends === 1000, '1000 4-seat vans ended: ' + ends);

// ---- Run integration: Run.create({seats:4}) -> startVan 4 seats; 2-seat run unchanged
const r4 = Run.create(7, { seats: 4 });
eq([r4.seats, Run.ban(r4).seats], [4, 4], 'run seats 4');
const sv = Run.startVan(r4);
eq(sv.hands.map(h => h.length), [10, 10, 10, 10], 'startVan deals 4 hands');
eq(Run.ban(Run.create(7)).seats, 2, 'default run is 2 seats');
eq(Run.startVan(Run.create(7)).hands.length, 2, 'default startVan 2 hands');
// play a whole 4-seat ván through Run (scoring, record, endVan); player plays its first legal move
const rr = Run.create(11, { seats: 4 }), vs = Run.startVan(rr);
let g = 0;
while (!vs.over && g++ < 800) {
  const seat = vs.turn, view = R.view(vs, seat);
  const mv = seat === 0 ? (view.legal.length ? { type: 'play', cardIds: view.legal[0].cards } : { type: 'pass' }) : AI.choose(view, 1);
  const e = mv.type === 'pass' ? R.pass(vs, seat) : R.play(vs, seat, mv.cardIds);
  if (!e.length) { ok(false, 'run van illegal move'); break; }
  e.forEach(x => S.onEvent(rr, x)); Run.record(rr, e);
}
ok(vs.over, 'run 4-seat van finished');
const res = Run.endVan(rr, vs.log[vs.log.length - 1]);
ok(['next', 'cleared', 'lost'].includes(res), 'endVan returns a result');
ok(rr.diemBan >= 0, 'diemBan floored');
ok(Run.load(Run.save(r4)) !== null && Run.load(Run.save(r4)).seats === 4, 'save/load keeps seats');

console.log(bad ? bad + ' of ' + n + ' FAILED' : 'rules4: ' + n + ' checks OK');
process.exit(bad ? 1 : 0);
