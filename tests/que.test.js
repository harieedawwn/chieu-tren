/* tests/que.test.js  node tests/que.test.js : Quẻ, shop mix, rarity, Bao lì xì, bosses, endless, seen, save/load. Prints only failures and one summary line */
const path = require('path'); const J = f => require(path.join(__dirname, '..', 'js', f));
['config', 'data', 'content', 'cards', 'rules', 'ai', 'scoring', 'run'].forEach(J);
const TL = globalThis.TL, Run = TL.Run, R = TL.Rules, CFG = TL.CFG, D = TL.DATA, S = TL.Scoring;
let n = 0, bad = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log('FAIL: ' + m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + ' got ' + JSON.stringify(a) + ' want ' + JSON.stringify(b));
const fresh = (seed, que) => { const r = Run.create(seed || 3); (que || []).forEach((q, i) => { r.que[i] = q; }); return r; };

// ---- bosses
const seen6 = new Set();
for (let s = 1; s <= 200; s++) { const r = Run.create(s); ok(r.bosses.length === 3 && new Set(r.bosses).size === 3 && r.bosses.every(b => D.BOSS_IDS.includes(b)), 'bosses distinct ' + s); r.bosses.forEach(b => seen6.add(b)); }
eq(seen6.size, 6, 'all 6 bosses appear across runs');
eq(Run.create(5).bosses, Run.create(5).bosses, 'bosses deterministic by seed');
let r = Run.create(9); r.bosses = ['di_ut', 'co_hai', 'bac_chin']; r.ban = 2; r.chang = 0; let bi = Run.ban(r);
eq([bi.house, bi.name, bi.opp, bi.vanMax, bi.mods], ['di_ut', 'Dì Út', 'di_ut', CFG.HOUSE2.TWO_VANS, { twoVans: true }], 'twoVans: 2 ván');
r.chang = 1; bi = Run.ban(r); eq([bi.house, bi.mods, bi.vanMax], ['co_hai', { sameSuitStraight: true }, 3], 'co_hai mods');
r.chang = 2; bi = Run.ban(r); eq([bi.house, bi.mods], ['bac_chin', { noHeoFinish: true }], 'bac_chin mods');
r.chang = 0; const st = Run.startVan(r); eq(st.mods, { twoVans: true }, 'van gets twoVans mod'); ok(r.seen.includes('di_ut'), 'boss marked seen');
r.vanUsed = 0; r.diemBan = 0; const e0 = { type: 'vanEnd', winner: 1, left: [0, 1], heo: [0, 0], cong: false, toiTrang: false, pot: 0 };
eq(Run.endVan(r, e0), 'next', 'twoVans: first ván next'); eq(Run.endVan(r, e0), 'lost', 'twoVans: lost after 2 ván');

// ---- Quẻ slots + useQue
r = fresh(3, ['que_loc']); let m0 = r.money, u = Run.useQue(r, null, 0, []);
eq([u.ok, r.money - m0, r.que[0]], [true, CFG.QUE.LOC_LIXI, null], 'loc works in shop, consumed');
eq(Run.useQue(r, null, 0, []).ok, false, 'empty slot');
r = fresh(3, ['que_sao']); const lv = JSON.stringify(r.sao); u = Run.useQue(r, null, 0, []);
const tot = o => Object.values(o).reduce((a, b) => a + b, 0);
ok(u.ok && tot(r.sao) === tot(JSON.parse(lv)) + CFG.QUE.SAO_LEVELS && r.que[0] === null && u.events[0].sao in r.sao, 'sao +1 level to a kiểu bài');
const lvls = new Set(); for (let k = 0; k < 60; k++) { const q = fresh(k + 1, ['que_sao']); Run.useQue(q, null, 0, []); Object.keys(q.sao).forEach(t => q.sao[t] > 1 && lvls.add(t)); } ok(lvls.size >= 5, 'sao random over kiểu bài');
r = fresh(3, ['que_them_van', 'que_soi']); eq(Run.useQue(r, null, 0, []).ok, false, 'them van needs ván'); ok(Run.useQue(r, null, 0, []).msg.length > 3 && r.que[0] === 'que_them_van', 'message and not consumed');
let van = Run.startVan(r); const base = Run.ban(r).vanMax;
u = Run.useQue(r, van, 0, []); eq([u.ok, Run.ban(r).vanMax, r.que[0]], [true, base + 1, null], 'them van +1');
eq(Run.endVan(r, { type: 'vanEnd', winner: 1, left: [0, 1], heo: [0, 0], cong: false, toiTrang: false, pot: 0 }), 'next', 'extra ván keeps the bàn alive');
r.vanUsed = 2; r.diemBan = 0; eq(Run.endVan(r, { type: 'vanEnd', winner: 1, left: [0, 1], heo: [0, 0], cong: false, toiTrang: false, pot: 0 }), 'next', 'ván 4 playable with Thêm ván');
u = Run.useQue(r, van, 1, []); eq([u.ok, van.reveal], [true, [true, false]], 'soi sets reveal[0]'); ok(R.view(van, 0).oppHand, 'view shows hand');
r.que[1] = 'que_soi'; eq(Run.useQue(r, van, 1, []).ok, false, 'soi twice refused');
r = fresh(3, ['que_gap_doi', 'que_gap_doi']); van = Run.startVan(r); u = Run.useQue(r, van, 0, []); eq([u.ok, r.flags.x2Next], [true, true], 'gap doi sets flag');
eq(Run.useQue(r, van, 1, []).ok, false, 'gap doi twice refused'); eq(r.que, [null, 'que_gap_doi'], 'second not consumed');
const sc0 = S.scorePlay(Run.create(3), 0, TL.Cards.detect([0, 1]), { chat: false }), sc1 = S.scorePlay(r, 0, TL.Cards.detect([0, 1]), { chat: false }); eq(sc1.the, sc0.the * 2, 'next play x2');
r.que[0] = 'que_gap_doi'; r.flags.x2Next = false; eq(Run.useQue(r, null, 0, []).ok, false, 'gap doi needs ván');
// que_doi
r = fresh(11, ['que_doi', 'que_doi']); van = Run.startVan(r); while (van.turn !== 0) { const v = R.view(van, 1); const c = TL.AI.choose(v, 1); c.type === 'play' ? R.play(van, 1, c.cardIds) : R.pass(van, 1); if (van.over) break; }
const h = van.hands[0].slice();
if (van.turn === 0 && !van.over) {
  eq(Run.useQue(r, van, 0, []).ok, false, 'doi: nothing selected'); eq(Run.useQue(r, van, 0, h.slice(0, 4)).ok, false, 'doi: 4 cards');
  u = Run.useQue(r, van, 0, h.slice(0, 3)); ok(u.ok && u.events[0].type === 'swap' && u.events[0].in.length === 3 && van.hands[0].length === h.length && r.que[0] === null, 'doi swaps 3');
  van.turn = 1; eq(Run.useQue(r, van, 1, [van.hands[0][0]]).ok, false, 'doi only on your turn'); eq(r.que[1], 'que_doi', 'not consumed off-turn');
}
// ---- shop mix + owned + rarity
r = fresh(4); r.phase = 'payout'; r.money = 99; Run.payout(r);
let it = Run.shop(r); eq(it.map(i => i.kind), ['qn', 'qn', 'sao', 'sao', 'que', 'pack'], 'shop: 2 qn 2 sao 1 que 1 pack'); ok(it.every(i => i.price > 0 && !i.sold), 'prices');
const cnt = { thuong: 0, hiem: 0, quy: 0 }; let total = 0, ownedHit = 0;
for (let k = 0; k < 2000; k++) { const q = fresh(k + 100); q.qn[0] = { id: 'ong_do', n: 0 }; q.qn[1] = { id: 'dan_cho_lon', n: 0 }; q.vanNo = k; q.shop = { items: [], rerolls: 0, n: k }; Run.shop(q);
  const qs = q.shop.items.filter(z => z.kind === 'qn'); if (qs[0].id === qs[1].id) bad++; qs.forEach(z => { cnt[D.QUY_NHAN[z.id].rarity]++; total++; if (z.id === 'ong_do' || z.id === 'dan_cho_lon') ownedHit++; }); }
eq(ownedHit, 0, 'never offers owned Quý nhân');
ok(Math.abs(cnt.thuong / total - 0.70) < 0.03 && Math.abs(cnt.hiem / total - 0.25) < 0.03 && Math.abs(cnt.quy / total - 0.05) < 0.02, 'rarity 70/25/5 got ' + JSON.stringify(cnt) + ' of ' + total);
// buy Quẻ
r = fresh(4); r.phase = 'payout'; r.money = 99; Run.payout(r); Run.shop(r); r.shop.items[4] = { kind: 'que', id: 'que_soi', price: 4, sold: false }; let mm = r.money;
eq([Run.buy(r, 4).ok, r.que[0], r.money], [true, 'que_soi', mm - 4], 'buy que'); r.shop.items.push({ kind: 'que', id: 'que_doi', price: 4, sold: false }); r.shop.items.push({ kind: 'que', id: 'que_loc', price: 3, sold: false });
ok(Run.buy(r, 6).ok, 'second slot'); eq(Run.buy(r, 7).why, 'slots', 'third que: slots full'); eq(Run.sellQue(r, 0).ok, true, 'sell que'); eq(r.money, mm - 4 - 4 + Math.floor(CFG.PRICE.QUE.que_soi / 2), 'sell value');
// ---- pack
r = fresh(8); r.phase = 'payout'; r.money = 30; Run.payout(r); Run.shop(r); const pi = r.shop.items.findIndex(z => z.kind === 'pack'); mm = r.money;
let pk = Run.openPack(r, pi); ok(pk.ok && pk.choices.length === 3 && new Set(pk.choices.map(c => c.id)).size === 3 && pk.choices.every(c => c.kind === 'qn' || c.kind === 'que'), 'pack: 3 distinct qn/que'); eq([r.money, r.shop.items[pi].sold], [mm - CFG.PRICE.PACK, true], 'pack paid');
eq(Run.openPack(r, pi).ok, false, 'pack cannot open twice');
const c1 = pk.choices[1], q0 = JSON.stringify(r.qn), e0q = JSON.stringify(r.que); eq(Run.choosePack(r, 1).ok, true, 'choose');
ok(c1.kind === 'qn' ? r.qn.some(s => s && s.id === c1.id) : r.que.includes(c1.id), 'choice lands in its slot'); ok(r.pack === null, 'pack cleared'); ok(r.seen.includes(c1.id) && pk.choices.every(c => r.seen.includes(c.id)), 'pack choices seen');
r = fresh(8); r.money = 30; r.shop = { items: [{ kind: 'pack', id: 'bao_li_xi', price: 4, sold: false }], rerolls: 0, n: 1 }; pk = Run.buy(r, 0); ok(pk.ok && pk.choices, 'buy on a pack opens it'); eq(Run.choosePack(r, -1).ok, true, 'skip'); eq([r.qn.filter(Boolean).length, r.que.filter(Boolean).length], [0, 0], 'skip gives nothing');
r = fresh(8); r.money = 30; r.qn = r.qn.map((_, i) => ({ id: QN()[i], n: 0 })); function QN() { return Object.keys(D.QUY_NHAN).slice(0, 5); }
r.shop = { items: [{ kind: 'pack', id: 'bao_li_xi', price: 4, sold: false }], rerolls: 0, n: 2 }; pk = Run.openPack(r, 0); ok(pk.ok && pk.choices.every(c => c.kind === 'que'), 'qn full: pack offers only Quẻ'); Run.choosePack(r, -1);
r.que = ['que_loc', 'que_loc']; r.shop.items[0].sold = false; const mq = r.money; eq(Run.openPack(r, 0).why, 'slots', 'both full: pack refused'); eq(r.money, mq, 'not charged'); ok(!r.shop.items[0].sold, 'still unsold'); eq(Run.choosePack(r, 5).ok, false, 'bad k');
r.que = [null, null]; r.qn[0] = null; r.shop.items[0].sold = false; pk = Run.openPack(r, 0); ok(pk.ok, 'opens again'); Run.choosePack(r, -1); r.shop.items[0].sold = false;
r.money = 1; r.pack = null; r.shop.items[0].sold = false; eq(Run.openPack(r, 0).why, 'money', 'pack needs money');
// ---- endless
r = fresh(6); r.phase = 'won'; r.chang = 2; r.ban = 2; eq(Run.continueEndless(r), 'ok', 'continue'); eq([r.chang, r.ban, r.phase, r.endless, r.diemBan, r.vanUsed], [3, 0, 'ban', true, 0, 0], 'chặng 4 starts');
bi = Run.ban(r); eq([bi.changName, bi.last, bi.aiLevel], ['Chặng 4', false, 3], 'endless ban info'); ok(bi.target > CFG.TARGETS[2][0], 'endless target grows');
let prev = 0; for (let c = 3; c < 9; c++) { r.chang = c; r.ban = 2; r.bosses[c] = undefined; bi = Run.ban(r); ok(bi.target > prev && D.BOSS_IDS.includes(bi.house) && bi.house !== r.bosses[c - 1], 'endless boss+target ' + c); prev = bi.target; }
r.chang = 3; r.ban = 2; r.phase = 'shop'; ok(Run.payout(Object.assign(r, { paid: false, diemBan: 99999 })).total > 0, 'endless payout'); eq(Run.nextBan(r), 'ok', 'endless never ends by winning'); eq([r.chang, r.ban], [4, 0], 'next chặng');
eq(Run.continueEndless(fresh(1)), false, 'continue only after a win');
r = fresh(6); r.chang = 2; r.ban = 2; r.phase = 'shop'; r.paid = true; r.lastPayout = { lines: [], total: 0 }; eq(Run.nextBan(r), 'won', 'normal run ends at the 9th bàn');
// loss ends endless
r = fresh(6); r.phase = 'won'; r.chang = 2; r.ban = 2; Run.continueEndless(r); r.vanUsed = Run.ban(r).vanMax - 1; r.diemBan = 0; eq(Run.endVan(r, { type: 'vanEnd', winner: 1, left: [0, 1], heo: [0, 0], cong: false, toiTrang: false, pot: 0 }), 'lost', 'endless ends on a loss');
// ---- seen
r = fresh(2); r.phase = 'payout'; r.money = 99; Run.payout(r); Run.shop(r); r.shop.items.forEach(z => ok(r.seen.includes(z.id) || z.kind === 'pack', 'shown item seen ' + z.id));
r = fresh(2); r.qn[0] = { id: 'co_giao', n: 0 }; Run.startVan(r); ok(r.seen.includes('co_giao'), 'owned seen on ván start');
// ---- save/load
r = fresh(12, ['que_soi', 'que_loc']); r.phase = 'payout'; r.money = 40; Run.payout(r); Run.shop(r); Run.buy(r, 0); r.pack = { choices: [{ kind: 'que', id: 'que_doi' }] }; r.flags.x2Next = true; r.vanExtra = 1;
const back = Run.load(Run.save(r)); eq(back, JSON.parse(JSON.stringify(r)), 'save/load round trip'); eq(JSON.stringify(Run.load(Run.save(back))), JSON.stringify(back), 'second round trip stable');
r = fresh(12); r.phase = 'won'; r.chang = 2; r.ban = 2; Run.continueEndless(r); eq(Run.load(Run.save(r)).chang, 3, 'endless save loads');
const old = JSON.parse(Run.save(fresh(5))); old.v = 1; ['que', 'seen', 'bosses', 'flags', 'endless', 'vanExtra', 'pack', 'rn'].forEach(k => delete old[k]); const mig = Run.load(JSON.stringify(old));
ok(mig && mig.v === 2 && mig.que.length === 2 && mig.bosses.length === 3 && Array.isArray(mig.seen), 'v1 save migrates');
r = fresh(5); r.que[0] = 'nope'; eq(Run.load(JSON.stringify(r)), null, 'bad que id rejected'); r = fresh(5); r.chang = 3; eq(Run.load(JSON.stringify(r)), null, 'chặng 4 without endless rejected'); eq(Run.load('{'), null, 'garbage');
ok(JSON.stringify(JSON.parse(JSON.stringify(fresh(1)))) === JSON.stringify(fresh(1)), 'RunState is plain JSON');

console.log(bad ? bad + ' FAILED of ' + n + ' checks' : 'ok: ' + n + ' checks passed');
process.exit(bad ? 1 : 0);
