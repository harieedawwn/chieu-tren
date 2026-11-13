/* tests/seats4.test.js  node tests/seats4.test.js : Sòng Giao thừa / Sòng bốn seat selection in Run.ban + startVan */
const path = require('path'); const J = f => require(path.join(__dirname, '..', 'js', f));
['config', 'data', 'content', 'cards', 'rules', 'ai', 'scoring', 'run'].forEach(J);
const TL = globalThis.TL, Run = TL.Run;
let n = 0, bad = 0; const ok = (c, m) => { n++; if (!c) { bad++; console.log('FAIL: ' + m); } };
let r = Run.create(3);
for (let c = 0; c < 3; c++) for (let b = 0; b < 3; b++) {
  r.chang = c; r.ban = b; const i = Run.ban(r), want = c === 2 && b === 2 ? 4 : 2;
  ok(i.seats === want, 'seats chặng ' + (c + 1) + ' bàn ' + (b + 1) + ' = ' + want + ' got ' + i.seats);
  if (want === 4) { ok(i.giaoThua && i.kin.length === 2 && i.kin[0] !== i.kin[1] && !i.kin.includes(i.opp), 'giao thua kin distinct from boss'); const st = Run.startVan(r); ok(st.hands.length === 4 && st.hands[0].length === TL.CFG.HAND_SIZE_4, 'giao thua deals 4x10'); }
  else ok(!i.giaoThua && i.kin.length === 0 && Run.startVan(r).hands.length === 2, 'normal bàn stays 1v1');
}
r = Run.create(4, { seats: 4 }); r.chang = 0; r.ban = 0; let i = Run.ban(r);
ok(i.seats === 4 && !i.giaoThua && i.kin.length === 2 && !i.kin.includes(i.opp), 'solo: every bàn 4 seats, not labelled giao thua'); ok(Run.startVan(r).hands.length === 4, 'solo deals 4');
r = Run.create(5); r.chang = 3; r.ban = 2; r.endless = true; ok(Run.ban(r).seats === 2, 'endless trùm stays 1v1');
console.log(bad ? bad + ' of ' + n + ' failed' : 'seats4: ' + n + ' checks OK');
