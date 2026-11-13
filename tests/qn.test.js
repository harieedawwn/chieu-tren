/* tests/qn.test.js  node tests/qn.test.js : one case per new Quý nhân, plus x2Next and slot order. Prints only failures and one summary line */
const path = require('path'); const J = f => require(path.join(__dirname, '..', 'js', f));
['config', 'data', 'content', 'cards', 'rules', 'ai', 'scoring', 'run'].forEach(J);
const TL = globalThis.TL, C = TL.Cards, S = TL.Scoring, Run = TL.Run, CFG = TL.CFG, Q2 = CFG.QN2, QE = CFG.QUE;
let n = 0, bad = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log('FAIL: ' + m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + ' got ' + JSON.stringify(a) + ' want ' + JSON.stringify(b));
const RK = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
const ids = s => s.split(' ').map(x => RK.indexOf(x.slice(0, -1)) * 4 + 'scdh'.indexOf(x.slice(-1)));
const cb = s => C.detect(ids(s));
const mk = (...q) => { const r = Run.create(7); q.forEach((x, i) => { r.qn[i] = { id: x, n: 0 }; }); return r; };
const gain = (r, s, seat) => { const b = S.scorePlay(Run.create(7), seat || 0, cb(s), { chat: false }), x = S.scorePlay(r, seat || 0, cb(s), { chat: false }); return { d: x.diem - b.diem, t: x.the - b.the, x: x, b: b }; };
const qnStep = (sc, id) => sc.steps.find(z => z.kind === 'qn' && z.ref === id);

// co_giao: sảnh +2 Nhân per card beyond 3
let g = gain(mk('co_giao'), '3s 4c 5d', 0); eq([g.d, g.t], [0, 0], 'co_giao sanh 3 no bonus'); ok(!qnStep(g.x, 'co_giao'), 'co_giao no step on 3');
g = gain(mk('co_giao'), '3s 4c 5d 6h 7s', 0); eq([g.d, g.t], [0, 2 * Q2.CO_GIAO_THE], 'co_giao sanh 5'); eq(qnStep(g.x, 'co_giao').slot, 0, 'co_giao slot');
eq(gain(mk('co_giao'), '5s 5c', 0).t, 0, 'co_giao ignores doi');
// anh_shipper: 5+ cards +30 Điểm
eq(gain(mk('anh_shipper'), '3s 4c 5d 6h', 0).d, Q2.SHIPPER_DIEM > 0 ? 0 : 0, 'shipper 4 cards: none (sanh 4)');
eq(gain(mk('anh_shipper'), '3s 4c 5d 6h 7s', 0).d, Q2.SHIPPER_DIEM, 'shipper 5 cards');
eq(gain(mk('anh_shipper'), '3s 3c 4s 4c 5s 5c', 0).d, Q2.SHIPPER_DIEM, 'shipper doi thong 6 cards');
eq(gain(mk('anh_shipper'), '5s 5c 5d 5h', 0).d, 0, 'shipper tu quy 4 cards none');
// chu_tho_may: doi thong +5 Nhân
eq(gain(mk('chu_tho_may'), '3s 3c 4s 4c 5s 5c', 0).t, Q2.THO_MAY_THE, 'tho may doi thong'); eq(gain(mk('chu_tho_may'), '5s 5c', 0).t, 0, 'tho may ignores doi');
// me_chong: ban trum x1.5
let r = mk('me_chong'); r.ban = 0; eq(gain(r, '5s 5c', 0).x.the, CFG.BASE.doi.the, 'me_chong: no effect on ban nho');
r.ban = 2; g = gain(r, '5s 5c', 0); eq(g.x.the, CFG.BASE.doi.the * Q2.ME_CHONG_X, 'me_chong x1.5 on ban trum'); eq(qnStep(g.x, 'me_chong').xThe, Q2.ME_CHONG_X, 'me_chong step xThe');
eq(g.x.total, Math.floor(g.x.diem * g.x.the), 'me_chong total');
// thang_em: rác rank <= 7 +15 Điểm
eq(gain(mk('thang_em'), '7s', 0).d, Q2.THANG_EM_DIEM, 'thang_em 7'); eq(gain(mk('thang_em'), '3s', 0).d, Q2.THANG_EM_DIEM, 'thang_em 3');
eq(gain(mk('thang_em'), '8s', 0).d, 0, 'thang_em 8 none'); eq(gain(mk('thang_em'), '3s 3c', 0).d, 0, 'thang_em ignores doi');
// ong_ke_toan: +1 Nhân per 5 lì xì, max +5
[[0, 0], [4, 0], [5, 1], [14, 2], [25, 5], [80, 5]].forEach(([m, t]) => { r = mk('ong_ke_toan'); r.money = m; eq(gain(r, '5s', 0).t, t, 'ke toan with ' + m); });
// chu_ba_gac: sám +4 Nhân
eq(gain(mk('chu_ba_gac'), '5s 5c 5d', 0).t, Q2.BA_GAC_THE, 'ba gac sam'); eq(gain(mk('chu_ba_gac'), '5s 5c', 0).t, 0, 'ba gac ignores doi');
// ba_mai: đôi J/Q/K x2 Nhân
['Js Jc', 'Qs Qc', 'Ks Kc'].forEach(s => { g = gain(mk('ba_mai'), s, 0); eq(g.x.the, CFG.BASE.doi.the * Q2.BA_MAI_X, 'ba mai ' + s); });
['10s 10c', 'As Ac', '2s 2c', 'Js'].forEach(s => eq(gain(mk('ba_mai'), s, 0).x.the, gain(mk(), s, 0).x.the, 'ba mai ignores ' + s));
// thang_chau: first play of each ván +4 Nhân
r = mk('thang_chau'); eq(gain(r, '5s', 0).t, Q2.THANG_CHAU_THE, 'thang_chau first play');
S.onEvent(r, { type: 'play', seat: 1, combo: cb('5s') }); eq(gain(r, '6s', 0).t, Q2.THANG_CHAU_THE, 'opponent play does not count');
S.onEvent(r, { type: 'play', seat: 0, combo: cb('5s') }); eq(gain(r, '6s', 0).t, 0, 'second play none');
r.van = { stack: 0, oppTake: 0 }; eq(gain(r, '6s', 0).t, Q2.THANG_CHAU_THE, 'new ván resets');
// opponent plays never get new effects
r = mk('co_giao', 'anh_shipper', 'chu_tho_may', 'me_chong', 'thang_em'); r.ban = 2; eq(S.scorePlay(r, 1, cb('3s 4c 5d 6h 7s'), { chat: false }).steps.map(z => z.kind), ['base', 'card', 'card', 'card', 'card', 'card'], 'opp unaffected');

// ba_ve_so: 1/4 chance +2 lì xì per hũ won
r = mk('ba_ve_so'); let hits = 0, N = 4000;
for (let i = 0; i < N; i++) { r.vanNo = i >> 3; r.van = { stack: 0, oppTake: 0 }; for (let k = 0; k < 8; k++) { const m = r.money, st = S.onEvent(r, { type: 'vong', winner: 0, pot: 10, combo: cb('5s') }); if (r.money > m) { hits++; eq([r.money - m, st[0].kind, st[0].ref, st[0].slot], [Q2.VE_SO_LIXI, 'bonus', 'lixi', 0], 've so step'); } if (k === 7) break; } }
ok(Math.abs(hits / (N * 8) - Q2.VE_SO_CHANCE) < 0.02, 've so rate ' + (hits / (N * 8)).toFixed(3));
r = mk('ba_ve_so'); const m0 = r.money; S.onEvent(r, { type: 'vong', winner: 1, pot: 10, combo: cb('5s') }); eq(r.money, m0, 've so: opponent hũ does nothing');
{ const a = mk('ba_ve_so'), b = mk('ba_ve_so'); const x = [], y = []; for (let i = 0; i < 20; i++) { x.push(S.onEvent(a, { type: 'vong', winner: 0, pot: 1, combo: cb('5s') }).length); y.push(S.onEvent(b, { type: 'vong', winner: 0, pot: 1, combo: cb('5s') }).length); } eq(x, y, 've so deterministic'); }
// ong_cau_ca: hũ >= half target -> +3 lì xì
r = mk('ong_cau_ca'); const tg = Run.ban(r).target, m1 = r.money;
eq(S.onEvent(r, { type: 'vong', winner: 0, pot: Math.ceil(tg * Q2.CAU_CA_FRAC) - 1, combo: cb('5s') }), [], 'cau ca below half'); eq(r.money, m1, 'cau ca below: money same');
let st = S.onEvent(r, { type: 'vong', winner: 0, pot: Math.ceil(tg * Q2.CAU_CA_FRAC), combo: cb('5s') });
eq([r.money - m1, st.length, st[0].kind, st[0].label.slice(0, 2)], [Q2.CAU_CA_LIXI, 1, 'bonus', '+3'], 'cau ca at half'); ok(/lì xì/.test(st[0].label), 'cau ca label in Vietnamese');
r = mk('ong_cau_ca'); S.onEvent(r, { type: 'vong', winner: 1, pot: tg, combo: cb('5s') }); eq(r.money, CFG.START_MONEY, 'cau ca: opponent hũ none');
// chi_ban_hoa: ván won, +1 lì xì per heo played
r = mk('chi_ban_hoa'); S.onEvent(r, { type: 'play', seat: 0, combo: cb('2s') }); S.onEvent(r, { type: 'play', seat: 0, combo: cb('2c 2d') }); S.onEvent(r, { type: 'play', seat: 1, combo: cb('2h') }); S.onEvent(r, { type: 'play', seat: 0, combo: cb('5s') });
const m2 = r.money; st = S.onEvent(r, { type: 'vanEnd', winner: 0, left: [0, 3], heo: [0, 0], cong: false, toiTrang: false, pot: 0 });
eq([r.money - m2, st.length, st[0].ref, st[0].lixi], [3 * Q2.BAN_HOA_LIXI, 1, 'lixi', 3], 'chi ban hoa pays per heo played');
r = mk('chi_ban_hoa'); S.onEvent(r, { type: 'play', seat: 0, combo: cb('2s') }); const m3 = r.money; eq(S.onEvent(r, { type: 'vanEnd', winner: 1, left: [1, 0], heo: [0, 0], cong: false, toiTrang: false, pot: 0 }), [], 'chi ban hoa: lost ván nothing'); eq(r.money, m3, 'lost ván money same');
r = mk('chi_ban_hoa'); eq(S.onEvent(r, { type: 'vanEnd', winner: 0, left: [0, 3], heo: [0, 0], cong: false, toiTrang: false, pot: 0 }), [], 'no heo played: nothing');

// ---- x2Next (que_gap_doi)
r = Run.create(7); r.flags = { x2Next: true };
g = gain(r, '5s 5c', 0); const last = g.x.steps[g.x.steps.length - 1];
eq([last.kind, last.ref, last.xThe], ['bonus', 'x2', QE.GAP_DOI_X], 'x2 own step, last'); eq(g.x.the, CFG.BASE.doi.the * QE.GAP_DOI_X, 'x2 doubles Nhân');
eq(S.preview(r, cb('5s 5c')).the, CFG.BASE.doi.the * 2, 'preview shows x2');
eq(S.scorePlay(r, 1, cb('5s 5c'), { chat: false }).the, CFG.BASE.doi.the, 'opponent play unaffected');
S.onEvent(r, { type: 'play', seat: 1, combo: cb('5s') }); ok(r.flags.x2Next === true, 'opponent play does not clear x2');
S.onEvent(r, { type: 'play', seat: 0, combo: cb('5s') }); ok(r.flags.x2Next === false, 'own play clears x2'); eq(gain(r, '5s 5c', 0).x.the, CFG.BASE.doi.the, 'x2 gone after one play');
// x2 comes after Quý nhân bonuses (multiplies them)
r = mk('ong_do'); r.flags = { x2Next: true }; eq(gain(r, '5s 5c', 0).x.the, (CFG.BASE.doi.the + CFG.QN.ONG_DO_THE) * 2, 'x2 multiplies after quy nhan');
// slot order: additive then multiplier vs multiplier then additive
r = mk('ba_mai', 'ong_do'); eq(gain(r, 'Js Jc', 0).x.the, CFG.BASE.doi.the * 2 + CFG.QN.ONG_DO_THE, 'slot order: x before +');
r = mk('ong_do', 'ba_mai'); eq(gain(r, 'Js Jc', 0).x.the, (CFG.BASE.doi.the + CFG.QN.ONG_DO_THE) * 2, 'slot order: + before x');
// all 20 Quý nhân have rarity/price/desc
const D = TL.DATA; eq(Object.keys(D.QUY_NHAN).length, 33, '28 quy nhan + 5 bau vat'); Object.values(D.QUY_NHAN).forEach(q => ok(['thuong', 'hiem', 'quy', 'bau'].includes(q.rarity) && q.price > 0 && q.desc && q.name && q.kind === 'qn' && (!q.quote || q.quote.split(' ').length <= 6), 'content ' + q.id));

console.log(bad ? bad + ' FAILED of ' + n + ' checks' : 'ok: ' + n + ' checks passed');
process.exit(bad ? 1 : 0);
