/* tests/bau.test.js  node tests/bau.test.js : the 8 step-4 Quý nhân and the 5 Báu vật. Prints only failures and one summary line */
const path = require('path'); const J = f => require(path.join(__dirname, '..', 'js', f));
['config', 'data', 'content', 'cards', 'rules', 'ai', 'scoring', 'run'].forEach(J);
const TL = globalThis.TL, C = TL.Cards, S = TL.Scoring, Run = TL.Run, R = TL.Rules, CFG = TL.CFG, D = TL.DATA, Q4 = CFG.QN4, BA = CFG.BAU;
let n = 0, bad = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log('FAIL: ' + m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + ' got ' + JSON.stringify(a) + ' want ' + JSON.stringify(b));
const RK = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
const ids = s => s.split(' ').map(x => RK.indexOf(x.slice(0, -1)) * 4 + 'scdh'.indexOf(x.slice(-1)));
const cb = s => C.detect(ids(s));
const mk = (...q) => { const r = Run.create(7); q.forEach((x, i) => { r.qn[i] = { id: x, n: 0 }; }); return r; };
const gain = (r, s, ctx) => { const c = ctx || {}; c.chat = false; const b = S.scorePlay(Run.create(7), 0, cb(s), Object.assign({}, c)), x = S.scorePlay(r, 0, cb(s), Object.assign({}, c)); return { d: x.diem - b.diem, t: x.the - b.the, r: x.the / b.the, x: x, b: b }; };

// data
ok(D.BAU_IDS.length === 5 && D.BAU_IDS.every(id => D.QUY_NHAN[id].rarity === 'bau' && D.QUY_NHAN[id].price >= 12 && D.QUY_NHAN[id].price <= 15), 'bau data');
// ong_thay_tuong
let r = mk('ong_thay_tuong'); r.van.xau = true; let x = S.scorePlay(r, 0, cb('5s'), {}), y = S.scorePlay(Object.assign(Run.create(7), { van: { xau: true } }), 0, cb('5s'), {});
eq([x.the, y.the], [CFG.BASE.rac.the * Q4.THAY_TUONG_X, CFG.BASE.rac.the * CFG.XAU_X], 'thay tuong xau');
// co_ba_sai_gon
eq(gain(mk('co_ba_sai_gon'), '3s 4c 5d 6h').r, 1, 'sai gon sanh 4 none'); eq(gain(mk('co_ba_sai_gon'), '3s 4c 5d 6h 7s').r, Q4.SAI_GON_X, 'sai gon sanh 5');
// chu_ban_pho: streak
r = mk('chu_ban_pho'); S.onEvent(r, { type: 'vong', winner: 0, pot: 10, combo: cb('5s') }); S.onEvent(r, { type: 'vong', winner: 0, pot: 10, combo: cb('5s') });
eq(gain(r, '5s').t, 2 * Q4.BAN_PHO_THE, 'ban pho stacks'); S.onEvent(r, { type: 'vong', winner: 1, pot: 10, combo: cb('5s') }); eq(gain(r, '5s').t, 0, 'ban pho resets');
// anh_bo_doi
r = mk('anh_bo_doi'); const m0 = r.money; S.onEvent(r, { type: 'chat', victim: 0, target: cb('2s'), seat: 1 });
eq(r.money - m0, Q4.BO_DOI_LIXI, 'bo doi lixi'); eq(gain(r, '5s').t, Q4.BO_DOI_THE, 'bo doi nhan'); S.onEvent(r, { type: 'play', seat: 0, combo: cb('5s') }); eq(gain(r, '5s').t, 0, 'bo doi cleared');
r = mk('anh_bo_doi'); S.onEvent(r, { type: 'chat', victim: 0, target: cb('5s 5c'), seat: 1 }); eq(r.money, Run.create(7).money, 'bo doi needs heo');
// ba_ngoai at payout
r = mk('ba_ngoai'); r.phase = 'payout'; r.doi = 2; const p = Run.payout(r); ok(p.lines.some(l => l.amount === 2 * Q4.BA_NGOAI_LIXI && /ngoại/.test(l.label)), 'ba ngoai payout');
// cau_ut
eq(gain(mk('cau_ut'), '5s', { last: true }).r, Q4.CAU_UT_X, 'cau ut last rac'); eq(gain(mk('cau_ut'), '5s', { last: false }).r, 1, 'cau ut not last'); eq(gain(mk('cau_ut'), '5s 5c', { last: true }).r, 1, 'cau ut doi');
// chi_hang_ca
eq(gain(mk('chi_hang_ca'), '6s', { target: cb('5s') }).d, Q4.CHI_HANG_DIEM, 'hang ca +1'); eq(gain(mk('chi_hang_ca'), '7s', { target: cb('5s') }).d, 0, 'hang ca +2'); eq(gain(mk('chi_hang_ca'), '6s').d, 0, 'hang ca lead');
// ong_giao
const ev = { winner: 0, left: [0, 5], heo: [0, 0], cong: true, toiTrang: false };
eq(S.vanBonus(mk('ong_giao'), ev).the, CFG.CONG_X * Q4.ONG_GIAO_X, 'ong giao cong'); eq(S.vanBonus(Run.create(7), ev).the, CFG.CONG_X, 'cong base');
// than_tai
r = mk('than_tai'); r.money = 40; r.phase = 'payout'; let pp = Run.payout(r); eq(pp.lines.find(l => l.label === D.TEXT.payout.interest).amount, 10, 'than tai interest uncapped');
r = Run.create(7); r.shop = { items: [], rerolls: 0, n: 0 }; r.money = 100; const m1 = r.money; Run.reroll(r); const c1 = m1 - r.money; r = mk('than_tai'); r.money = 100; r.shop = { items: [], rerolls: 0, n: 0 }; Run.reroll(r); eq(100 - r.money, c1 * BA.THAN_TAI_REROLL_X, 'than tai reroll x2');
// ong_dia
r = mk('ong_dia'); S.onEvent(r, { type: 'vanEnd', winner: 0, heo: [0, 2], left: [0, 3] }); eq(gain(r, '5s').t, 2 * BA.ONG_DIA_THE, 'ong dia forever'); S.onEvent(r, { type: 'vanEnd', winner: 1, heo: [1, 0], left: [3, 0] }); eq(gain(r, '5s').t, 2 * BA.ONG_DIA_THE, 'ong dia kept');
// tao_quan
r = mk('tao_quan'); r.chang = 0; r.ban = 2; r.phase = 'payout'; Run.payout(r); ok(Object.values(r.sao).every(v => v === 1 + BA.TAO_QUAN_LEVELS), 'tao quan trum'); r = mk('tao_quan'); r.phase = 'payout'; Run.payout(r); ok(Object.values(r.sao).every(v => v === 1), 'tao quan nho');
// vua_bai
eq(gain(mk('vua_bai'), '5s').r, BA.VUA_BAI_X, 'vua bai x2');
r = mk('vua_bai'); const van = Run.startVan(r, { hands: [ids('3s 4s 5s 6s 7s 8s 9s 10s Js Qs'), ids('3c 4c 5c 6c 7c 8c 9c 10c Jc Qc')] });
eq(van.mods.passMax, BA.VUA_BAI_PASSES, 'vua bai passMax');
// ca_chep
r = mk('ca_chep'); S.onEvent(r, { type: 'vong', winner: 0, pot: 5, combo: cb('3s 4c 5d') }); S.onEvent(r, { type: 'vong', winner: 0, pot: 5, combo: cb('5s 5c') }); S.onEvent(r, { type: 'vong', winner: 0, pot: 5, combo: cb('3s 4c 5d') });
eq(gain(r, '5s').r, Math.round(Math.pow(BA.CA_CHEP_X, 2) * 100) / 100, 'ca chep compounds on sanh only');
// shop: bau never before chang 2, max one per shop, max 2 owned, not in packs
let seenBau = 0, early = 0, multi = 0;
for (let sd = 1; sd <= 600; sd++) {
  r = Run.create(sd); r.shop = { items: [], rerolls: 0, n: 0 }; let it = Run.shop(r); early += it.filter(i => i.kind === 'qn' && D.QUY_NHAN[i.id].rarity === 'bau').length;
  r = Run.create(sd); r.chang = 1; r.shop = { items: [], rerolls: 0, n: 0 }; it = Run.shop(r); const b = it.filter(i => i.kind === 'qn' && D.QUY_NHAN[i.id].rarity === 'bau'); seenBau += b.length; if (b.length > 1) multi++;
  if (b.length) ok(b[0].price >= 12 && b[0].price <= 15, 'bau price');
}
eq(early, 0, 'no bau in chang 1'); eq(multi, 0, 'one bau per shop'); ok(seenBau > 5 && seenBau < 120, 'bau rate ~5%/slot got ' + seenBau + '/600');
r = Run.create(3); r.chang = 1; r.money = 99; r.qn[0] = { id: 'vua_bai', n: 0 }; r.qn[1] = { id: 'ca_chep', n: 0 };
r.shop = { items: [{ kind: 'qn', id: 'ong_dia', price: 12, sold: false }], rerolls: 0, n: 0 }; eq(Run.buy(r, 0).ok, false, 'third bau refused');
for (let sd = 1; sd <= 80; sd++) { r = Run.create(sd); r.money = 99; r.shop = { items: [], rerolls: 0, n: 0 }; const o = Run.openPack(Run.shop(r) && (r.shop.items.findIndex(i => i.kind === 'pack') >= 0 ? r : r), r.shop.items.findIndex(i => i.kind === 'pack')); if (o.ok) ok(o.choices.every(c => c.kind !== 'qn' || D.QUY_NHAN[c.id].rarity !== 'bau'), 'no bau in pack'); }
console.log(bad ? bad + ' FAILED of ' + n + ' checks' : 'ok: ' + n + ' checks passed'); process.exit(bad ? 1 : 0);
