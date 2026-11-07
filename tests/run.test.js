/* tests/run.test.js  node tests/run.test.js : prints only failures and one summary line */
const path = require('path'); const J = f => require(path.join(__dirname, '..', 'js', f));
['config', 'data', 'cards', 'rules', 'ai', 'scoring', 'run'].forEach(J);
const TL = globalThis.TL, C = TL.Cards, R = TL.Rules, S = TL.Scoring, Run = TL.Run, CFG = TL.CFG, D = TL.DATA, Q = CFG.QN;
let n = 0, bad = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log('FAIL: ' + m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + ' got ' + JSON.stringify(a) + ' want ' + JSON.stringify(b));
const RK = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
const id1 = s => RK.indexOf(s.slice(0, -1)) * 4 + 'scdh'.indexOf(s.slice(-1));
const ids = s => s.split(' ').map(id1);
const cb = s => C.detect(ids(s));
const withQn = (run, ...q) => { q.forEach((x, i) => { run.qn[i] = { id: x, n: 0 }; }); return run; };
const sc = (run, s, seat, chat) => S.scorePlay(run, seat === undefined ? 0 : seat, cb(s), { chat: !!chat });
const B = CFG.BASE, P = CFG.CARD_PTS;
const pts = s => ids(s).reduce((a, x) => a + P[x >> 2], 0);

// ---- combos (level 1, no Quý nhân)
let r = Run.create(1);
[['5s', 'rac', 1, 0], ['5s 5c', 'doi', 2, 0], ['5s 5c 5d', 'sam', 3, 0], ['5s 5c 5d 5h', 'tuquy', 4, 0], ['3s 4c 5d', 'sanh', 3, 0], ['3s 4c 5d 6h 7s', 'sanh', 5, 0],
  ['3s 3c 4s 4c 5s 5c', 'doithong', 6, 0], ['3s 3c 4s 4c 5s 5c 6s 6c', 'doithong', 8, 0]].forEach(([s, t, len]) => {
  const x = sc(r, s, 0), b = B[t], units = t === 'sanh' ? len : t === 'doithong' ? len / 2 : 3, the = b.the + b.extra * Math.max(0, units - 3), d = b.diem + pts(s);
  eq([x.diem, x.the, x.total], [d, the, Math.floor(d * the)], 'combo ' + t + ' ' + s);
  eq(x.steps.map(z => z.kind), ['base'].concat(ids(s).map(() => 'card')), 'step order ' + s);
  ok(x.xPot === undefined, 'no xPot on non-chat ' + s);
});
eq(sc(r, '3s 4c 5d 6h 7s', 0).the, B.sanh.the + 2 * B.sanh.extra, 'sanh 5 the');
eq(sc(r, '3s 3c 4s 4c 5s 5c 6s 6c', 0).the, B.doithong.the + B.doithong.extra, 'doi thong 4 pairs the');
// opponent: no Sao, no Quý nhân
r = withQn(Run.create(1), 'ong_do'); r.sao.doi = 4;
eq(sc(r, '5s 5c', 1).steps.map(z => z.kind), ['base', 'card', 'card'], 'opp steps base+cards only');
eq(sc(r, '5s 5c', 1).the, B.doi.the, 'opp no bonus');

// ---- Sao
Object.values(D.SAO).forEach(s => {
  const run = Run.create(1); run.sao[s.combo] = 3;
  const hand = { rac: '5s', doi: '5s 5c', sam: '5s 5c 5d', sanh: '3s 4c 5d', doithong: '3s 3c 4s 4c 5s 5c', tuquy: '5s 5c 5d 5h' }[s.combo];
  const x = sc(run, hand, 0), base = sc(Run.create(1), hand, 0), g = CFG.SAO_GAIN[s.combo];
  eq([x.diem - base.diem, x.the - base.the], [2 * g.diem, 2 * g.the], 'sao ' + s.id);
  const st = x.steps[x.steps.length - 1]; ok(st.kind === 'sao' && st.ref === s.id && x.steps.findIndex(z => z.kind === 'sao') === 1 + ids(hand).length, 'sao step after cards ' + s.id);
  eq(S.preview(run, cb(hand)), { diem: x.diem, the: x.the, level: 3 }, 'preview level ' + s.id);
  ok(sc(run, hand, 0).steps.filter(z => z.kind === 'sao').length === 1, 'single sao step');
});
ok(!sc(Run.create(1), '5s', 0).steps.some(z => z.kind === 'sao'), 'no sao step at level 1');

// ---- Quý nhân
r = withQn(Run.create(1), 'chu_xe_om'); let x = sc(r, '3s 4c 5d 6h', 0);
eq(x.diem, B.sanh.diem + pts('3s 4c 5d 6h') + Q.XE_OM_DIEM * 4, 'xe om sanh diem'); ok(x.steps[x.steps.length - 1].slot === 0, 'xe om slot');
eq(sc(r, '5s 5c', 0).diem, B.doi.diem + pts('5s 5c'), 'xe om no effect on doi');
r = withQn(Run.create(1), 'ba_ban_xoi'); eq(sc(r, '5s', 0).the, B.rac.the + Q.BAN_XOI_THE, 'ba xoi rac'); eq(sc(r, '5s 5c', 0).the, B.doi.the, 'ba xoi not doi');
r = withQn(Run.create(1), 'ong_do'); eq(sc(r, '5s 5c', 0).the, B.doi.the + Q.ONG_DO_THE, 'ong do doi'); eq(sc(r, '5s', 0).the, B.rac.the, 'ong do not rac');
r = withQn(Run.create(1), 'thay_boi', 'co_hang_xom'); eq(sc(r, '5s 5c', 0).steps.length, 3, 'thay boi / co hang xom no score step');
// Thằng bạn thân stacking via onEvent
r = withQn(Run.create(1), 'thang_ban_than');
let st = S.onEvent(r, { type: 'pass', seat: 0 }); eq(r.van.stack, Q.BAN_THAN_THE, 'stack after 1 pass'); ok(st.length === 1 && st[0].kind === 'qn' && st[0].slot === 0 && st[0].the === Q.BAN_THAN_THE, 'stack step');
S.onEvent(r, { type: 'pass', seat: 0 }); eq(r.van.stack, 2 * Q.BAN_THAN_THE, 'stack after 2 passes');
S.onEvent(r, { type: 'pass', seat: 1 }); eq(r.van.stack, 2 * Q.BAN_THAN_THE, 'opponent pass does not stack');
eq(sc(r, '5s', 0).the, B.rac.the + 2 * Q.BAN_THAN_THE, 'scoring reads stack'); eq(sc(r, '5s', 1).the, B.rac.the, 'opp ignores stack');
S.onEvent(r, { type: 'play', seat: 1 }); eq(r.van.stack, 2 * Q.BAN_THAN_THE, 'opp play keeps stack');
S.onEvent(r, { type: 'play', seat: 0 }); eq(r.van.stack, 0, 'play resets stack'); eq(sc(r, '5s', 0).steps.length, 2, 'no stack step when 0');
ok(S.onEvent(withQn(Run.create(1), 'ong_do'), { type: 'pass', seat: 0 }).length === 0, 'pass without ban than: no step');
// Heo đất growth and break
r = withQn(Run.create(1), 'chu_xe_om', 'heo_dat');
st = S.onEvent(r, { type: 'vong', winner: 0, pot: 50, combo: cb('2s') }); eq(r.qn[1].n, Q.HEO_DAT_THE, 'heo dat +HEO_DAT_THE'); ok(st[0].slot === 1 && st[0].the === Q.HEO_DAT_THE, 'heo dat step');
S.onEvent(r, { type: 'vong', winner: 0, pot: 50, combo: cb('2s 2c') }); eq(r.qn[1].n, 2 * Q.HEO_DAT_THE, 'heo dat grows on doi heo');
S.onEvent(r, { type: 'vong', winner: 0, pot: 50, combo: cb('5s 5c') }); S.onEvent(r, { type: 'vong', winner: 1, pot: 50, combo: cb('2s') }); eq(r.qn[1].n, 2 * Q.HEO_DAT_THE, 'heo dat only heo vong by seat 0');
eq(sc(r, '5s', 0).the, B.rac.the + 2 * Q.HEO_DAT_THE, 'heo dat the = n'); ok(sc(r, '5s', 1).the === B.rac.the, 'opp no heo dat');
S.onEvent(r, { type: 'chat', seat: 0, victim: 1, target: cb('2s'), combo: cb('3s 3c 3d 3h'), xPot: 2, pot: 0 }); ok(r.qn[1], 'chat by player does not break');
S.onEvent(r, { type: 'chat', seat: 1, victim: 0, target: cb('5s 5c 5d 5h'), combo: cb('3s 3c 3d 3h'), xPot: 2, pot: 0 }); ok(r.qn[1], 'no heo in target: no break');
st = S.onEvent(r, { type: 'chat', seat: 1, victim: 0, target: cb('2s'), combo: cb('3s 3c 4s 4c 5s 5c'), xPot: 2, pot: 0 });
ok(r.qn[1] === null && r.qn[0] && st.length === 1 && st[0].dissolve === true && st[0].slot === 1 && st[0].label === D.TEXT.stamp.heoVo, 'heo dat breaks, others stay');
ok(S.onEvent(r, { type: 'chat', seat: 1, victim: 0, target: cb('2s'), combo: cb('3s 3c 4s 4c 5s 5c'), xPot: 2, pot: 0 }).length === 0, 'no heo dat, no step');
// Thầy bói / deal
st = S.onEvent(withQn(Run.create(1), 'ong_do', 'thay_boi'), { type: 'deal', hands: [[], []], leader: 0 }); ok(st.length === 1 && st[0].slot === 1 && st[0].ref === 'thay_boi', 'thay boi deal step');
ok(S.onEvent(Run.create(1), { type: 'deal', hands: [[], []], leader: 0 }).length === 0, 'deal without thay boi: none');
// Quý nhân slot order
r = withQn(Run.create(1), 'ong_do', 'chu_xe_om', 'ba_ban_xoi'); r.van.stack = 0;
r.qn[3] = { id: 'heo_dat', n: 3 }; r.qn[4] = { id: 'thang_ban_than', n: 0 }; r.van.stack = 6;
x = sc(r, '5s', 0); eq(x.steps.filter(z => z.kind === 'qn').map(z => z.slot), [2, 3, 4], 'qn steps in slot order'); eq(x.the, B.rac.the + Q.BAN_XOI_THE + 3 + 6, 'qn stack the');

// ---- chặt, with and without Dân chơi Chợ Lớn
r = Run.create(1); x = sc(r, '3s 3c 3d 3h', 0, true);
eq(x.xPot, CFG.CHAT_X, 'chat xPot'); eq(x.steps[x.steps.length - 1], { kind: 'chat', ref: 'chat', xPot: CFG.CHAT_X, label: D.TEXT.stamp.chat }, 'chat step last'); eq(x.total, Math.floor(x.diem * x.the), 'total excludes xPot');
r = withQn(Run.create(1), 'dan_cho_lon'); x = sc(r, '3s 3c 3d 3h', 0, true); eq(x.xPot, Q.CHO_LON_CHAT_X, 'cho lon xPot seat 0'); ok(x.steps[x.steps.length - 1].kind === 'chat', 'cho lon chat last');
eq(sc(r, '3s 3c 3d 3h', 1, true).xPot, CFG.CHAT_X, 'cho lon does not help opp'); eq(sc(r, '3s 3c 3d 3h', 0, false).xPot, undefined, 'no xPot without chat');
r = withQn(Run.create(1), 'ong_do', 'chu_xe_om'); x = sc(r, '3s 3c 3d 3h', 0, true); eq(x.steps.map(z => z.kind).pop(), 'chat', 'chat after qn');
// through rules: pot formula uses xPot
r = withQn(Run.create(1), 'dan_cho_lon'); let van = R.newVan({ rng: TL.makeRng(2), mods: {}, scoreFn: (s, c, ctx) => S.scorePlay(r, s, c, ctx) });
van.hands = [ids('3s 3c 3d 3h 9s'), ids('2s 5d')]; van.turn = 1; van.table = null; van.pot = 0; let ev = R.play(van, 1, ids('2s'));
const t1 = ev[0].score.total; ev = R.play(van, 0, ids('3s 3c 3d 3h')); const e = ev.find(z => z.type === 'chat');
eq(e.xPot, Q.CHO_LON_CHAT_X, 'rules chat xPot cho lon'); eq(e.pot, (t1 + ev[0].score.total) * Q.CHO_LON_CHAT_X, 'rules pot = (pot+total) x3');

// ---- vanBonus
const VE = o => Object.assign({ type: 'vanEnd', winner: 0, left: [0, 5], heo: [0, 0], cong: false, toiTrang: false, pot: 0 }, o);
r = Run.create(1);
eq(S.vanBonus(r, VE({})).total, 5 * CFG.LEFT_PTS, 'bonus plain'); eq(S.vanBonus(r, VE({ heo: [0, 2] })).total, 5 * CFG.LEFT_PTS * CFG.THOI_X ** 2, 'bonus thoi x2 heo');
eq(S.vanBonus(r, VE({ cong: true })).total, 5 * CFG.LEFT_PTS * CFG.CONG_X, 'bonus cong');
eq(S.vanBonus(r, VE({ left: [0, 10], toiTrang: true })).total, 10 * CFG.LEFT_PTS * CFG.TOI_TRANG_X, 'bonus toi trang');
eq(S.vanBonus(r, VE({ heo: [0, 1], cong: true, toiTrang: true })).total, 5 * CFG.LEFT_PTS * CFG.THOI_X * CFG.CONG_X * CFG.TOI_TRANG_X, 'bonus all');
eq(S.vanBonus(r, VE({ heo: [0, 1], cong: true })).steps.map(z => z.ref), ['veNhat', 'thoi', 'cong'], 'bonus step refs');
eq(S.vanBonus(r, VE({ winner: 1, heo: [2, 0], left: [4, 0] })).total, -2 * CFG.THOI_PENALTY, 'opp wins penalty'); eq(S.vanBonus(r, VE({ winner: 1 })).total, 0, 'opp wins no heo = 0');

// ---- create / ban / startVan
r = Run.create(42); eq([r.phase, r.chang, r.ban, r.money, r.vanUsed, r.diemBan], ['ban', 0, 0, CFG.START_MONEY, 0, 0], 'create'); eq(r.qn.length, 5, '5 slots');
let bi = Run.ban(r); eq([bi.name, bi.kind, bi.target, bi.vanMax, bi.vanLeft, bi.aiLevel, bi.last, bi.house], ['Thím Út', 'nho', CFG.TARGETS[0][0], 3, 3, 1, false, null], 'ban info');
r.chang = 2; r.ban = 2; bi = Run.ban(r); eq([bi.last, bi.house, bi.mods, bi.rule.name], [true, 'ong_sau', { mustBeat: true }, 'Ông Sáu'], 'boss ban info');
[[0, 'ba_noi', { oppLeads: true }], [1, 'chu_ba', { noChat: true }]].forEach(([c, h, m]) => { r.chang = c; r.ban = 2; eq(Run.ban(r).mods, m, 'mods ' + h); });
r = Run.create(42); r.chang = 0; r.ban = 2; van = Run.startVan(r); eq(van.turn, 1, 'oppLeads from boss rules'); eq(van.mods, { oppLeads: true }, 'van mods');
r = Run.create(42); const v1 = Run.startVan(r), v1b = Run.startVan(Run.create(42)); eq(v1.hands, v1b.hands, 'same seed same deal'); eq(v1.reveal, [], 'no reveal without thay boi');
ok(v1.hands[0].length === CFG.HAND_SIZE, 'hand size');
r.vanNo = 1; ok(JSON.stringify(Run.startVan(r).hands) !== JSON.stringify(v1.hands), 'ván seed differs by vanNo');
r = withQn(Run.create(42), 'thay_boi'); van = Run.startVan(r); eq(van.reveal.length, Q.THAY_BOI_REVEAL, 'reveal count'); ok(van.reveal.every(c => van.hands[1].includes(c)), 'reveal from opp hand');
// scoreFn bound to run
r = withQn(Run.create(42), 'ong_do'); van = Run.startVan(r); van.hands = [ids('5s 5c 9d'), ids('4s 6d')]; van.turn = 0; van.table = null;
ev = R.play(van, 0, ids('5s 5c')); eq(ev[0].score.the, B.doi.the + Q.ONG_DO_THE, 'startVan scoreFn uses run');
r = Run.create(42); van = Run.startVan(r); r.van.stack = 0; r.qn[0] = { id: 'thang_ban_than', n: 0 }; ok(typeof van.scoreFn === 'function', 'scoreFn present');

// ---- record
r = Run.create(1);
Run.record(r, [{ type: 'play', seat: 0, combo: cb('5s'), score: { total: 40 }, pot: 40 }, { type: 'play', seat: 1, combo: cb('6s'), score: { total: 900 }, pot: 940 }]); eq(r.stats.bestPlay, 40, 'bestPlay seat 0 only');
Run.record(r, [{ type: 'vong', winner: 1, pot: 300, combo: cb('6s') }]); eq([r.diemBan, r.van.oppTake, r.stats.bestPot], [0, 300, 0], 'opponent take not banked');
Run.record(r, [{ type: 'vong', winner: 0, pot: 120, combo: cb('7s') }, { type: 'chat', seat: 0, victim: 1, target: cb('2s'), combo: cb('3s 3c 3d 3h'), xPot: 2, pot: 0 }]); eq([r.diemBan, r.stats.bestPot, r.stats.chat], [120, 120, 1], 'player vong banked, chat counted');
Run.record(r, [{ type: 'chat', seat: 1, victim: 0, target: cb('2s'), combo: cb('3s 3c 3d 3h'), xPot: 2, pot: 0 }]); eq(r.stats.chat, 1, 'opp chat not counted');
Run.record(r, [{ type: 'vong', winner: 0, pot: 80, combo: cb('7s') }]); eq([r.diemBan, r.stats.bestPot], [200, 120], 'bestPot max');
Run.record(r, [VE({ winner: 0 })]); eq([r.lastWinner, r.stats.vans, r.stats.wins], [0, 1, 1], 'vanEnd stats');
Run.record(r, [VE({ winner: 1 })]); eq([r.lastWinner, r.stats.vans, r.stats.wins], [1, 2, 1], 'vanEnd loss stats');
Run.record(r, [VE({ winner: 0, toiTrang: true })]); eq(r.stats.toiTrang, 1, 'toi trang stat');
r = Run.create(1); r.lastWinner = 1; r.vanUsed = 1; van = Run.startVan(r); eq(van.turn, 1, 'next ván led by previous winner');
r = Run.create(1); r.lastWinner = 0; r.vanUsed = 1; r.chang = 0; r.ban = 0; ok(Run.startVan(r).leader === 0, 'leader 0 carried');

// ---- endVan: next / cleared / lost / floor
const T0 = CFG.TARGETS[0][0];
r = Run.create(1); r.diemBan = 10; eq([Run.endVan(r, VE({ winner: 0, left: [0, 1] })), r.vanUsed, r.vanNo, r.diemBan, r.phase], ['next', 1, 1, 20, 'ban'], 'endVan next + bonus');
r = Run.create(1); r.diemBan = T0 - 10; eq([Run.endVan(r, VE({ winner: 0, left: [0, 1] })), r.phase], ['cleared', 'payout'], 'endVan cleared by bonus');
r = Run.create(1); r.diemBan = T0; eq(Run.endVan(r, VE({ winner: 1, heo: [0, 0] })), 'cleared', 'cleared at exactly target');
r = Run.create(1); r.vanUsed = 2; r.diemBan = 5; eq([Run.endVan(r, VE({ winner: 1 })), r.phase], ['lost', 'lost'], 'endVan lost on last ván');
r = Run.create(1); r.vanUsed = 2; r.diemBan = T0 - 1; eq(Run.endVan(r, VE({ winner: 0, left: [0, 1] })), 'cleared', 'last ván can still clear');
r = Run.create(1); r.diemBan = 20; Run.endVan(r, VE({ winner: 1, heo: [3, 0] })); eq(r.diemBan, 0, 'Điểm bàn floors at 0');
r = Run.create(1); eq(Run.endVan(r, VE({ winner: 0, left: [0, 0] })), 'next', 'no bonus on 0 left');

// ---- payout and interest
const payoutCase = (money, kind, vanUsed) => { const run = Run.create(1); run.money = money; run.chang = 0; run.ban = ['nho', 'lon', 'trum'].indexOf(kind); run.vanUsed = vanUsed; run.phase = 'payout'; return [run, Run.payout(run)]; };
let p; [r, p] = payoutCase(4, 'nho', 1);
eq(p.lines.map(l => l.amount), [CFG.PAYOUT.nho, CFG.UNUSED_VAN_PTS * 2], 'payout lines (no interest under INTEREST_PER)'); eq(p.total, CFG.PAYOUT.nho + 2 * CFG.UNUSED_VAN_PTS, 'payout total'); eq(r.money, 4 + p.total, 'money after payout');
eq(p.lines[0].label, D.TEXT.kind.nho, 'base label TEXT.kind'); eq(p.lines[1].label, D.TEXT.payout.unused.replace('%d', 2), 'unused label'); eq([r.phase, r.paid], ['shop', true], 'phase shop after payout');
const m0 = r.money; const p2 = Run.payout(r); eq(r.money, m0, 'payout applies once'); eq(p2.total, p.total, 'repeat payout same lines');
[r, p] = payoutCase(CFG.INTEREST_PER * 3 + 1, 'lon', 3); eq(p.lines.map(l => l.label), [D.TEXT.kind.lon, D.TEXT.payout.interest], 'lines with interest, no unused'); eq(p.lines[1].amount, 3, 'interest floor(held/per)');
[r, p] = payoutCase(CFG.INTEREST_PER * 99, 'trum', 3); eq(p.lines[1].amount, CFG.INTEREST_MAX, 'interest capped'); eq(p.lines[0].amount, CFG.PAYOUT.trum, 'trum payout');
[r, p] = payoutCase(CFG.INTEREST_PER - 1, 'nho', 3); eq(p.lines.length, 1, 'no interest below INTEREST_PER');
r = Run.create(1); r.chang = 2; r.ban = 2; r.phase = 'payout'; Run.payout(r); eq(r.phase, 'payout', 'last bàn payout stays'); eq(Run.nextBan(r), 'won', 'nextBan won'); eq(r.phase, 'won', 'phase won');

// ---- shop
r = Run.create(7); r.phase = 'payout'; r.money = 50; Run.payout(r); let items = Run.shop(r);
eq(items.map(i => i.kind), ['qn', 'qn', 'sao', 'sao'], 'shop kinds'); ok(items[0].id !== items[1].id && items[2].id !== items[3].id, 'distinct'); ok(items.every(i => !i.sold), 'unsold');
ok(items.filter(i => i.kind === 'sao').every(i => i.price === CFG.PRICE.SAO) && items.filter(i => i.kind === 'qn').every(i => i.price === CFG.PRICE.QN[i.id]), 'prices');
const r7 = Run.create(7); r7.phase = 'payout'; r7.money = 50; Run.payout(r7); eq(Run.shop(r7), items, 'shop reproducible by seed');
let mm = r.money; let b = Run.buy(r, 0); eq([b.ok, r.money, r.qn[0] && r.qn[0].id, items[0].sold], [true, mm - items[0].price, items[0].id, true], 'buy qn'); eq(r.qn[0].n, 0, 'new qn counter 0');
eq(Run.buy(r, 0), { ok: false, why: 'sold' }, 'buy sold'); mm = r.money; b = Run.buy(r, 2); const t = D.SAO[items[2].id].combo; eq([b.ok, r.sao[t], r.money], [true, 2, mm - CFG.PRICE.SAO], 'buy sao raises level');
eq(Run.buy(r, 9), { ok: false, why: 'sold' }, 'buy bad index');
r.money = 0; eq(Run.buy(r, 1), { ok: false, why: 'money' }, 'buy no money'); eq(r.qn[1], null, 'nothing bought on failure');
r.money = 99; r.qn = r.qn.map((s, i) => s || { id: 'ong_do', n: 0 }); eq(Run.buy(r, 1), { ok: false, why: 'slots' }, 'buy no slots'); eq(r.money, 99, 'no charge on slots');
const sao3 = r.shop.items[3]; mm = r.money; ok(Run.buy(r, 3).ok, 'sao buy ok when slots full'); eq(r.money, mm - CFG.PRICE.SAO, 'sao charged');
// sell
r.qn[2] = { id: 'dan_cho_lon', n: 0 }; mm = r.money; eq(Run.sell(r, 2), { ok: true }, 'sell ok'); eq([r.money, r.qn[2]], [mm + Math.floor(CFG.PRICE.QN.dan_cho_lon * CFG.SHOP.SELL_RATIO), null], 'sell value'); eq(Run.sell(r, 2), { ok: false }, 'sell empty slot');
// reroll
r = Run.create(7); r.phase = 'payout'; r.money = 100; Run.payout(r); Run.shop(r); const before = JSON.stringify(r.shop.items); mm = r.money;
eq(Run.reroll(r).ok, true, 'reroll 1'); eq(r.money, mm - CFG.SHOP.REROLL_BASE, 'reroll cost 1'); mm = r.money; Run.reroll(r); eq(r.money, mm - (CFG.SHOP.REROLL_BASE + CFG.SHOP.REROLL_STEP), 'reroll cost 2');
eq(r.shop.rerolls, 2, 'rerolls count'); eq(r.shop.items.length, 4, 'reroll keeps 4 items'); ok(r.shop.items.every(i => !i.sold), 'reroll fresh items');
r.money = 0; eq(Run.reroll(r), { ok: false, why: 'money' }, 'reroll poor');
r = Run.create(7); r.qn[0] = { id: 'ong_do', n: 0 }; r.qn[1] = { id: 'heo_dat', n: 0 }; for (let i = 0; i < 20; i++) { r.shop = { items: [], rerolls: 0, n: i }; Run.shop(r); ok(!r.shop.items.some(z => z.kind === 'qn' && (z.id === 'ong_do' || z.id === 'heo_dat')), 'owned not offered'); }
// nextBan
r = Run.create(7); r.phase = 'payout'; Run.payout(r); r.diemBan = 999; r.vanUsed = 2; r.lastWinner = 1; r.qn[0] = { id: 'heo_dat', n: 4 }; r.money = 9;
eq(Run.nextBan(r), 'ok', 'nextBan ok'); eq([r.chang, r.ban, r.diemBan, r.vanUsed, r.lastWinner, r.phase, r.paid, r.shop.items.length], [0, 1, 0, 0, null, 'ban', false, 0], 'nextBan resets bàn'); eq([r.qn[0].n, r.money], [4, 9], 'run state persists');
r.ban = 2; Run.nextBan(r); eq([r.chang, r.ban], [1, 0], 'nextBan rolls to next chặng');

// ---- save / load
r = Run.create(5); r.phase = 'payout'; r.money = 40; Run.payout(r); Run.shop(r); Run.buy(r, 0); Run.buy(r, 2); r.qn[3] = { id: 'heo_dat', n: 3 }; r.stats.bestPot = 1234;
const s = Run.save(r); eq(typeof s, 'string', 'save string'); eq(Run.load(s), r, 'round-trip equal'); eq(Run.save(Run.load(s)), s, 'round-trip stable');
r = Run.create(5); Run.startVan(r); eq(Run.load(Run.save(r)), r, 'fresh run round-trip');
ok(Run.load('') === null && Run.load('{') === null && Run.load('null') === null && Run.load('[]') === null && Run.load('{"v":1}') === null, 'corrupt save ignored');
const old = JSON.parse(Run.save(Run.create(1))); old.v = CFG.SAVE_VERSION + 1; ok(Run.load(JSON.stringify(old)) === null, 'wrong version ignored');
const badQ = JSON.parse(Run.save(Run.create(1))); badQ.qn[0] = { id: 'nope', n: 0 }; ok(Run.load(JSON.stringify(badQ)) === null, 'unknown quy nhan ignored');
const bp = JSON.parse(Run.save(Run.create(1))); bp.phase = 'x'; ok(Run.load(JSON.stringify(bp)) === null, 'bad phase ignored');
// resume replays same ván seed
r = Run.create(11); const a = Run.startVan(r).hands; const r2 = Run.load(Run.save(r)); eq(Run.startVan(r2).hands, a, 'resume replays same ván');

// ---- full flow: win path and loss path (driven through real rules)
const driver = (run, win) => {
  for (let g = 0; g < 30; g++) {
    if (run.phase === 'lost' || run.phase === 'won') return run.phase;
    if (run.phase === 'shop') { run.shop.items.length || Run.shop(run); }
    if (run.phase === 'payout' || run.phase === 'shop') { if (!run.paid) Run.payout(run); if (Run.nextBan(run) === 'won') return 'won'; continue; }
    let res = 'next';
    while (res === 'next') {
      const stt = Run.startVan(run); stt.log.forEach(e => S.onEvent(run, e)); Run.record(run, stt.log);
      let ve = stt.log.find(z => z.type === 'vanEnd');
      for (let k = 0; k < 400 && !stt.over; k++) {
        const seat = stt.turn, v = R.view(stt, seat), ch = seat === 0 ? TL.AI.choose(v, 3) : TL.AI.choose(v, 1);
        const evs = ch.type === 'play' ? R.play(stt, seat, ch.cardIds) : R.pass(stt, seat);
        evs.forEach(z => S.onEvent(run, z)); Run.record(run, evs); ve = evs.find(z => z.type === 'vanEnd') || ve;
      }
      if (win) run.diemBan += 1e9;
      res = Run.endVan(run, ve);
    }
    if (res === 'lost') return 'lost';
  }
  return 'stuck';
};
eq(driver(Run.create(3), true), 'won', 'win path: 9 bàn cleared -> won'); r = Run.create(3); driver(r, true); ok(r.chang === 2 && r.ban === 2 && r.stats.vans === 9, 'win path reached last bàn, 9 ván');
// loss: impossible target
const saveT = JSON.stringify(CFG.TARGETS); CFG.TARGETS[0][0] = 1e12; r = Run.create(3); eq(driver(r, false), 'lost', 'loss path'); eq([r.vanUsed, r.phase, r.stats.vans], [3, 'lost', 3], 'loss after VAN_PER_BAN ván'); CFG.TARGETS.splice(0, 3, ...JSON.parse(saveT));
// tới trắng ván through Run
r = Run.create(3); van = Run.startVan(r); van.hands = [ids('2s 2c 2d 2h 3s 4s 5s 6s 7s 8s'), ids('3c 4c 5c 6c 7c 8c 9c 10c Jc Qc')];
const te = { type: 'vanEnd', winner: 0, left: [0, 10], heo: [4, 0], cong: true, toiTrang: true, pot: 0 }; Run.record(r, [te]); eq(S.vanBonus(r, te).total, 10 * CFG.LEFT_PTS * CFG.CONG_X * CFG.TOI_TRANG_X, 'toi trang bonus incl cong');

console.log((bad ? bad + ' FAILED of ' : 'all ') + n + ' checks' + (bad ? '' : ' passed'));
process.exit(bad ? 1 : 0);
