/* tests/rules2.test.js  node tests/rules2.test.js : new mods (sameSuitStraight, noHeoFinish), Rules.swap, reveal. Prints only failures and one summary line */
const path = require('path'); const J = f => require(path.join(__dirname, '..', 'js', f));
['config', 'data', 'content', 'cards', 'rules', 'ai'].forEach(J);
const TL = globalThis.TL, C = TL.Cards, R = TL.Rules;
let n = 0, bad = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log('FAIL: ' + m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + ' got ' + JSON.stringify(a) + ' want ' + JSON.stringify(b));
const RK = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
const id1 = s => RK.indexOf(s.slice(0, -1)) * 4 + 'scdh'.indexOf(s.slice(-1));
const ids = s => s.split(' ').map(id1);
const van = (h0, h1, mods, o) => R.newVan(Object.assign({ rng: TL.makeRng(1), hands: [ids(h0), ids(h1)], mods: mods || {}, leader: 0 }, o || {}));

// ---- sameSuitStraight
const SS = { sameSuitStraight: true };
ok(C.detect(ids('3s 4c 5d')) && C.detect(ids('3s 4c 5d')).type === 'sanh', 'mixed sanh ok by default');
ok(C.detect(ids('3s 4c 5d'), SS) === null, 'mixed sanh rejected with mod');
ok(C.detect(ids('3s 4s 5s'), SS).type === 'sanh', 'same-suit sanh ok');
ok(C.detect(ids('3s 3c 4s 4c 5s 5c'), SS).type === 'doithong', 'doi thong unaffected');
ok(C.detect(ids('5s 5c'), SS).type === 'doi', 'doi unaffected');
let lp = C.legalPlays(ids('3s 4s 5s 6c 7s'), null, SS).filter(c => c.type === 'sanh').map(c => c.cards.join());
eq(lp, [ids('3s 4s 5s').join()], 'legalPlays only same-suit sanh');
let v = van('3s 4c 5d 9s 9c', '6s 6c 7d 8d 8h 10s 10c 10d', SS);
eq(R.play(v, 0, ids('3s 4c 5d')), [], 'play mixed sanh illegal');
ok(R.play(v, 0, ids('9s 9c')).length > 0, 'other plays fine');

// ---- noHeoFinish
const NH = { noHeoFinish: true };
v = van('2s', '3s 4s', NH);
eq(v.turn, 0, 'leader 0'); eq(R.legal(v, 0).plays.map(c => c.cards), [ids('2s')], 'lone heo may lead out (otherwise the ván never ends)');
v = van('2s 3c', '4s 5s', NH, { leader: 0 });
eq(R.play(v, 0, ids('2s 3c')), [], 'cannot go out with a heo inside a combo'); // not a combo anyway
v = van('2s 2c', '4s 5s 6s', NH);
eq(R.legal(v, 0).plays.some(c => c.type === 'doi'), false, 'doi heo that empties the hand is not offered');
ok(R.legal(v, 0).plays.length === 2, 'two single heo offered');
eq(R.play(v, 0, ids('2s 2c')), [], 'play empties hand with heo -> illegal');
ok(R.play(v, 0, ids('2s')).length > 0, 'single heo while a card remains is legal');
v = van('3s 2c', '4s 5s 6s', NH, { leader: 1 });
v.table = { combo: C.detect(ids('4d')), seat: 1 }; v.turn = 0; v.vongPlays = [{ seat: 1, combo: v.table.combo }];
eq(R.legal(v, 0).plays.map(c => c.cards.join()), [ids('2c').join()], 'beat with heo while holding another card');
v = van('2c', '4s 5s 6s', NH, { leader: 1 });
v.table = { combo: C.detect(ids('4d')), seat: 1 }; v.turn = 0;
eq(R.legal(v, 0).plays, [], 'last card heo: no play on a table'); ok(R.legal(v, 0).canPass, 'must pass');
ok(R.play(v, 0, ids('2c')).length === 0, 'play illegal');
// 4 of a kind of heo as last combo
v = van('2s 2c 2d 2h', '3s 4s 5s 6s 7s 8s', NH, { leader: 0 });   // toi trang resolves, not relevant
ok(v.over && v.toiTrang === 0, 'toi trang unaffected');

// ---- AI legality over 300 seeded vans per mod
function playOut(seed, mods, lv0, lv1) {
  const rng = TL.makeRng(seed), s = R.newVan({ rng: rng, mods: mods }); let g = 0, finishHeoBreach = 0, suitBreach = 0;
  while (!s.over) {
    if (++g > 500) return { hang: true };
    const seat = s.turn, vw = R.view(s, seat), ch = TL.AI.choose(vw, seat === 0 ? lv0 : lv1);
    const legalKeys = vw.legal.map(c => c.cards.join());
    if (ch.type === 'play') {
      if (!legalKeys.includes(ch.cardIds.slice().sort((a, b) => a - b).join())) return { illegal: true };
      const lead = s.table === null, hlen = s.hands[seat].length;
      const evs = R.play(s, seat, ch.cardIds); if (!evs.length) return { illegal: true };
      const cmb = evs[0].combo;
      if (mods.noHeoFinish && cmb.len === hlen && cmb.cards.some(C.isHeo) && !lead) finishHeoBreach++;
      if (mods.sameSuitStraight && cmb.type === 'sanh' && new Set(cmb.cards.map(x => x & 3)).size > 1) suitBreach++;
    } else if (!R.pass(s, seat).length) return { illegal: true };
  }
  return { finishHeoBreach: finishHeoBreach, suitBreach: suitBreach, winner: s.winner };
}
[['sameSuitStraight', SS], ['noHeoFinish', NH], ['both', Object.assign({}, SS, NH)]].forEach(([name, mods]) => {
  let hang = 0, ill = 0, br = 0;
  for (let i = 1; i <= 300; i++) { const r = playOut(i * 7 + 3, mods, 1 + (i % 3), 3 - (i % 3)); if (r.hang) hang++; else if (r.illegal) ill++; else br += r.finishHeoBreach + r.suitBreach; }
  eq([hang, ill, br], [0, 0, 0], 'AI legality ' + name);
});

// ---- swap
v = van('3s 4s 5s 6s 7s 8s 9s 10s', 'Js Qs Ks As', {}, { rng: TL.makeRng(5) });
v = R.newVan({ rng: TL.makeRng(11), hands: undefined, mods: {} }); v.turn = 0; v.over = false;
const h0 = v.hands[0].slice(), h1 = v.hands[1].slice(), pick = h0.slice(0, 3);
eq(R.swap(v, 1, [h1[0]], TL.makeRng(1)), [], 'swap: not your turn');
eq(R.swap(v, 0, [], TL.makeRng(1)), [], 'swap: zero cards');
eq(R.swap(v, 0, h0.slice(0, 4), TL.makeRng(1)), [], 'swap: four cards');
eq(R.swap(v, 0, [h1[0]], TL.makeRng(1)), [], 'swap: card not in own hand');
eq(R.swap(v, 0, [h0[0], h0[0]], TL.makeRng(1)), [], 'swap: duplicate id');
eq(R.swap(v, 0, 'x', TL.makeRng(1)), [], 'swap: bad arg');
eq(v.hands[0], h0, 'illegal swaps changed nothing');
const logLen = v.log.length, ev = R.swap(v, 0, pick, TL.makeRng(2));
eq(ev.length, 1, 'swap: one event'); eq(ev[0].type, 'swap', 'event type'); eq(ev[0].out, pick, 'out ids'); eq(ev[0].in.length, 3, 'in count');
ok(v.log.length === logLen + 1, 'swap logged');
ok(ev[0].in.every(x => !h0.includes(x) && !h1.includes(x)), 'incoming cards were unused');
eq(v.hands[0].length, h0.length, 'hand size kept'); eq(v.hands[0], v.hands[0].slice().sort((a, b) => a - b), 'hand sorted');
ok(pick.every(x => !v.hands[0].includes(x)) && ev[0].in.every(x => v.hands[0].includes(x)), 'hand updated');
eq(v.hands[1], h1, 'opponent hand untouched');
const e1 = R.swap(van('3s 4s', '5s 6s', {}), 0, [id1('3s')], TL.makeRng(9)); ok(e1.length === 1 && e1[0].in.length === 1, 'swap 1 card');
let o = van('3s 4s', '5s 6s'); o.over = true; eq(R.swap(o, 0, [id1('3s')], TL.makeRng(1)), [], 'swap after the ván is over');
o = van('3s 4s', '5s 6s'); o.played = Array.from({ length: 52 }, (_, i) => i).filter(i => ![id1('3s'), id1('4s'), id1('5s'), id1('6s')].includes(i)); eq(R.swap(o, 0, [id1('3s')], TL.makeRng(1)), [], 'swap with no unused cards');
{ // deterministic by rng
  const a = van('3s 4s 5s', '6s 7s'), b = van('3s 4s 5s', '6s 7s');
  eq(R.swap(a, 0, ids('3s 4s'), TL.makeRng(77))[0].in, R.swap(b, 0, ids('3s 4s'), TL.makeRng(77))[0].in, 'swap deterministic by rng');
  // out cards can come back later but not in the same call
  ok(R.swap(van('3s 4s 5s', '6s 7s'), 0, ids('3s 4s 5s'), TL.makeRng(3))[0].in.every(x => !ids('3s 4s 5s').includes(x)), 'swap never returns the same cards');
}

// ---- reveal
v = van('3s 4s 5s 9c', '6s 7s 8s 9s', {}); ok(v.reveal[0] === false && v.reveal[1] === false, 'reveal starts false');
ok(R.view(v, 0).oppHand === undefined, 'no oppHand by default');
v.reveal[0] = true;
eq(R.view(v, 0).oppHand, v.hands[1], 'view shows opponent hand when revealed'); ok(R.view(v, 1).oppHand === undefined, 'other seat sees nothing');
R.play(v, 0, ids('3s')); eq(R.view(v, 0).oppHand, v.hands[1], 'stays while the hũ is open');
R.play(v, 1, ids('6s')); ok(R.view(v, 0).oppHand !== undefined, 'still open after opponent play');
R.pass(v, 0);
eq(v.reveal, [false, false], 'cleared when the hũ is taken (pass)'); ok(R.view(v, 0).oppHand === undefined, 'view hides again');
v = van('3s', '6s 7s', {}); v.reveal[0] = true; R.play(v, 0, ids('3s')); eq(v.reveal, [false, false], 'cleared on van end');

console.log(bad ? bad + ' FAILED of ' + n + ' checks' : 'ok: ' + n + ' checks passed');
process.exit(bad ? 1 : 0);
