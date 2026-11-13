/* tests/doi.test.js  node tests/doi.test.js : Luot doi (Run.doiBai), Suc bai (AI.strength), Bai xau x1.5. Prints only failures and one summary line */
const path = require('path'); const J = f => require(path.join(__dirname, '..', 'js', f));
['config', 'data', 'content', 'cards', 'rules', 'ai', 'scoring', 'run'].forEach(J);
const TL = globalThis.TL, C = TL.Cards, S = TL.Scoring, Run = TL.Run, CFG = TL.CFG, AI = TL.AI;
let n = 0, bad = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log('FAIL: ' + m); } };
const RK = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
const ids = s => s.split(' ').map(x => RK.indexOf(x.slice(0, -1)) * 4 + 'scdh'.indexOf(x.slice(-1)));

// ---- Suc bai
ok(AI.strength(ids('3s 3c 4s 4c 5s 5c 9d 9h 2s 2c 2d 2h Kd')) === 3, 'tu quy heo + doi thong + doi = 3 sao');
ok(AI.strength(ids('3s 5c 7d 9h Js Qc Ad 4h 6s 8c 10d Kh')) >= 1, 'strength in range');
const rng = TL.makeRng(11), cnt = [0, 0, 0, 0];
for (let t = 0; t < 600; t++) { const d = [...Array(52).keys()]; for (let i = 51; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; } cnt[AI.strength(d.slice(0, 13))]++; }
ok(cnt[1] > 0 && cnt[1] > 60 && cnt[1] < 300 && cnt[3] > 20 && cnt[3] < 250 && cnt[2] > cnt[1], 'star spread sane ' + cnt.join());

// ---- Luot doi
let run = Run.create(5);
ok(run.doi === CFG.DOI_PER_BAN, 'run.doi starts at DOI_PER_BAN');
let van = Run.startVan(run);
ok(run.van.suc >= 1 && run.van.suc <= 3 && run.van.xau === (run.van.suc === 1), 'suc / xau set at deal');
if (van.turn !== 0) van.turn = 0;
let r = Run.doiBai(run, van, []);
ok(!r.ok && run.doi === 2, 'empty selection refused, no cost');
r = Run.doiBai(run, van, van.hands[0].slice(0, 4));
ok(!r.ok && run.doi === 2, 'more than 3 refused');
van.table = { combo: C.detect([van.hands[0][0]]), seat: 1 };
r = Run.doiBai(run, van, [van.hands[0][0]]);
ok(!r.ok && run.doi === 2, 'not allowed when not leading a hu');
van.table = null;
const sel = van.hands[0].slice(0, 3);
r = Run.doiBai(run, van, sel);
ok(r.ok && r.events[0].type === 'swap' && run.doi === 1, 'swap works and costs 1');
ok(sel.every(x => !van.hands[0].includes(x)) && van.hands[0].length === CFG.HAND_SIZE, 'cards replaced, hand size kept');
ok(run.van.xau === (run.van.suc === 1) && run.van.suc === AI.strength(van.hands[0]), 'suc re-read after swap');
r = Run.doiBai(run, van, [van.hands[0][0]]); ok(r.ok && run.doi === 0, 'second swap');
r = Run.doiBai(run, van, [van.hands[0][0]]); ok(!r.ok && run.doi === 0, 'third swap refused (out of Luot doi)');
// payout: unused Luot doi pays
run = Run.create(6); run.phase = 'payout'; run.paid = false; run.doi = 2;
let p = Run.payout(run);
ok(p.lines.some(l => /Không đổi bài/.test(l.label) && l.amount === 2 * CFG.DOI_UNUSED_LIXI), 'unused swaps pay lixi');
run = Run.create(6); run.phase = 'payout'; run.paid = false; run.doi = 0; p = Run.payout(run);
ok(!p.lines.some(l => /Không đổi bài/.test(l.label)), 'no line when all swaps used');
// reset on the next bàn
run = Run.create(7); run.doi = 0; run.phase = 'shop'; Run.nextBan(run); ok(run.doi === CFG.DOI_PER_BAN, 'doi resets on the next bàn');

// ---- Bai xau x1.5
run = Run.create(8); Run.startVan(run);
const combo = C.detect(ids('9s 9c'));
run.van.xau = false; const a = S.scorePlay(run, 0, combo, { chat: false });
run.van.xau = true; const b = S.scorePlay(run, 0, combo, { chat: false });
ok(Math.abs(b.the - a.the * CFG.XAU_X) < 1e-9 && b.steps.some(s => s.ref === 'xau' && s.xThe === CFG.XAU_X), 'Bai xau multiplies Nhan by XAU_X as its own step');
const o = S.scorePlay(run, 1, combo, { chat: false }); ok(!o.steps.some(s => s.ref === 'xau'), 'opponent plays are not affected');

console.log(bad ? bad + ' FAILED of ' + n : 'doi.test.js: all ' + n + ' passed');
process.exit(bad ? 1 : 0);
