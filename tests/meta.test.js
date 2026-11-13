/* tests/meta.test.js  node tests/meta.test.js : Profile (Tiếng tăm, Cây mai, Khởi đầu, Chiếu, daily) and their Run hooks. Prints only failures and one summary line */
const path = require('path'); const J = f => require(path.join(__dirname, '..', 'js', f));
['config', 'data', 'content', 'cards', 'rules', 'ai', 'scoring', 'run', 'profile'].forEach(J);
const TL = globalThis.TL, P = TL.Profile, Run = TL.Run, CFG = TL.CFG, D = TL.DATA, M = CFG.META;
let n = 0, bad = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log('FAIL: ' + m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + ' got ' + JSON.stringify(a) + ' want ' + JSON.stringify(b));
const opts = (p, o) => P.options(p, o);

// ---- levels and xp
eq(P.level(0), { level: 1, into: 0, need: M.LEVEL.BASE }, 'level 1');
eq(P.level(M.LEVEL.BASE).level, 2, 'level 2'); eq(P.level(M.LEVEL.BASE - 1).level, 1, 'just under level 2');
eq(P.level(M.LEVEL.BASE + M.LEVEL.BASE + M.LEVEL.STEP).level, 3, 'level 3');
let prev = 0; for (let x = 0; x < 20000; x += 37) { const l = P.level(x).level; ok(l >= prev, 'levels monotonic'); prev = l; }
const fakeRun = (o) => Object.assign({ chieu: 1, stats: { bans: 3, chat: 2, bigPots: 4 } }, o);
let xp = P.runXp(fakeRun(), false);
eq(xp.total, 3 * M.XP.BAN + 2 * M.XP.CHAT + 4 * M.XP.BIG_POT, 'xp loss run'); ok(!xp.lines.some(l => l.key === 'win'), 'no win line on a loss');
xp = P.runXp(fakeRun(), true); eq(xp.total, 3 * M.XP.BAN + 2 * M.XP.CHAT + 4 * M.XP.BIG_POT + M.XP.WIN, 'xp win run');
const base = P.runXp(fakeRun(), true).total;
for (let c = 1; c <= 6; c++) { const t = P.runXp(fakeRun({ chieu: c }), true); eq(t.total, Math.round(base * M.XP.CHIEU_X[c]), 'xp x Chiếu ' + c); eq(t.lines.reduce((a, l) => a + l.amount, 0), t.total, 'lines sum ' + c); }
eq(P.runXp({ chieu: 1, stats: {} }, false).total, 0, 'empty run 0 xp');

// ---- tree
let p = P.empty();
eq(P.mai(p), 0, 'no mai at start'); eq(P.canBuy(p, 'kd_ngheo'), { ok: false, why: 'mai' }, 'cannot afford'); eq(P.canBuy(p, 'nope').why, 'none', 'unknown node');
p.xp = 100000; const lv = P.level(p.xp).level; eq(P.mai(p), lv - 1, 'mai = level - 1');
eq(P.canBuy(p, 'qn_b').why, 'req', 'needs previous node'); eq(P.buy(p, 'qn_a'), { ok: true }, 'buy qn_a'); eq(P.mai(p), lv - 1 - 1, 'mai spent'); eq(P.buy(p, 'qn_a').why, 'owned', 'no double buy');
ok(P.buy(p, 'qn_b').ok, 'buy qn_b after qn_a');
p = P.empty(); eq(P.pool(p).qn.length, 14, 'new player 14 Quý nhân'); eq(P.pool(p).que.length, 3, '3 Quẻ'); eq(P.pool(p).bau.length, 0, 'no Báu vật'); eq(P.starts(p), ['mac_dinh'], 'only Mặc định'); eq(P.chieuMax(p), 1, 'Chiếu 1 only');
p.xp = 1e7; M.TREE.forEach(nd => { let g = 0; while (!P.canBuy(p, nd.id).ok && !p.nodes[nd.id] && g++ < 20) M.TREE.forEach(x => P.buy(p, x.id)); P.buy(p, nd.id); });
ok(M.TREE.every(nd => p.nodes[nd.id]), 'every node buyable'); eq(P.pool(p).qn.length, 28, 'full tree 28 Quý nhân'); eq(P.pool(p).que.length, 6, 'full tree 6 Quẻ'); eq(P.pool(p).bau.length, 5, 'full tree 5 Báu vật');
eq(P.starts(p), M.STARTS, 'all Khởi đầu'); eq(P.perks(p), { doi1: 1, giu: 1, lai: 1, reroll: 1 }, 'all perks');
const total = M.TREE.reduce((a, nd) => a + nd.cost, 0); ok(total >= 30 && total <= 45, 'tree cost ' + total + ' within 30..45 hoa mai');
ok(M.TREE.length === 15 && ['noi_dung', 'khoi_dau', 'tien_ich'].every(b => M.TREE.some(nd => nd.br === b)), '15 nodes in 3 branches');
ok(M.TREE.every(nd => !nd.req || M.TREE.some(x => x.id === nd.req)), 'req ids exist');
ok(M.TREE.every(nd => D.TEXT.meta.nodes[nd.id]), 'node texts');

// ---- save / load
const mem = {}; globalThis.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = v; } };
p = P.empty(); p.xp = 500; p.nodes.qn_a = true; p.spent = 1; p.best = 2; ok(P.save(p), 'save'); eq(P.load(), p, 'round trip');
mem[CFG.STORAGE.profile] = '{bad'; eq(P.load(), P.empty(), 'corrupt -> empty');
mem[CFG.STORAGE.profile] = JSON.stringify({ xp: -5, spent: 99, nodes: { qn_a: true, zzz: true, qn_b: 1 }, best: 99, daily: { date: 'x' } }); p = P.load(); eq([p.xp, p.spent, p.best, p.nodes, p.daily], [0, 0, 6, { qn_a: true }, null], 'sanitize');
globalThis.localStorage = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } }; eq(P.load(), P.empty(), 'throwing storage load'); ok(P.save(P.empty()) === false, 'throwing storage save is false');
delete globalThis.localStorage; eq(P.load(), P.empty(), 'no storage');

// ---- options clamp
p = P.empty(); eq(opts(p, { start: 'choi', chieu: 6 }).start, 'mac_dinh', 'locked start -> Mặc định'); eq(opts(p, { chieu: 6 }).chieu, 1, 'locked Chiếu clamps');
p.best = 3; eq(opts(p, { chieu: 6 }).chieu, 4, 'Chiếu = best + 1'); p.best = 6; eq(opts(p, { chieu: 6 }).chieu, 6, 'Chiếu cap 6'); p.nodes.kd_cung = true; eq(opts(p, { start: 'cung' }).start, 'cung', 'unlocked start');

// ---- finish
p = P.empty(); let r = Run.create(1, opts(p, {})); r.stats = { bans: 2, chat: 1, bigPots: 1 }; let f = P.finish(p, r, false);
eq([f.xp, p.xp, p.runs, p.wins, p.best, f.newBest], [2 * 20 + 5 + 8, 53, 1, 0, 0, false], 'finish loss');
r = Run.create(1, { chieu: 1 }); r.stats = { bans: 9, chat: 0, bigPots: 0 }; r.phase = 'won'; f = P.finish(p, r, true); eq([p.wins, p.best, f.newBest, p.endless], [1, 1, true, true], 'win raises best + endless unlock');
r = Run.create(1, { chieu: 1 }); P.finish(p, r, true); eq(p.best, 1, 'same Chiếu does not raise'); r = Run.create(1, { chieu: 2 }); P.finish(p, r, true); eq(p.best, 2, 'Chiếu 2 win -> best 2'); r = Run.create(1, { chieu: 5 }); P.finish(p, r, false); eq(p.best, 2, 'loss keeps best');
p.xp = 0; r = Run.create(1, {}); r.stats = { bans: 6, chat: 0, bigPots: 0 }; f = P.finish(p, r, false); eq([f.level0, f.level1, f.mai], [1, 2, 1], 'level up gives a hoa mai');

// ---- daily
const d1 = new Date(2026, 10, 13); eq(P.dailySeed(d1), 20261113, 'daily seed yyyymmdd'); eq(P.dailySeed(new Date(2027, 0, 5)), 20270105, 'daily seed pads');
let dd = P.dailyOptions(d1); eq([dd.seed, dd.opts.start, dd.opts.chieu, dd.opts.daily, dd.opts.perks.giu, dd.opts.pool.bau.length], [20261113, 'mac_dinh', 2, true, 0, 0], 'daily options');
eq(P.dailyOptions(d1), P.dailyOptions(new Date(2026, 10, 13, 23, 59)), 'daily same all day');
p = P.empty(); ok(P.dailyAvailable(p, d1), 'daily available'); r = Run.create(dd.seed, dd.opts); r.stats = { bans: 6, bestPot: 12400, bigPots: 0, chat: 0 }; r.chang = 1; r.ban = 0; r.phase = 'lost';
P.finish(p, r, false, d1); ok(!P.dailyAvailable(p, d1), 'one daily per day'); ok(P.dailyAvailable(p, new Date(2026, 10, 14)), 'next day free'); eq(p.best, 0, 'daily never raises best');
eq([p.daily.date, p.daily.bans, p.daily.bestPot, p.daily.won], ['20261113', 3, 12400, false], 'daily entry'); eq(P.dailyShare(p.daily), 'Chiếu Trên 13/11 · Bàn 3 · Hũ lớn nhất 12.400', 'share text');
const a = Run.create(dd.seed, dd.opts), b = Run.create(dd.seed, dd.opts); eq(a, b, 'daily runs identical'); eq(Run.shop(a).map(i => i.id), Run.shop(b).map(i => i.id), 'daily shop identical');

// ---- unlocks
p = P.empty(); eq(P.unlocked(p, 'vo_tan').ok, false, 'vo tan locked'); eq(P.unlocked(p, 'solo').ok, false, 'solo locked'); p.xp = 1000; ok(P.level(p.xp).level >= M.SOLO_LEVEL, 'level 3 reachable'); ok(P.unlocked(p, 'solo').ok, 'solo unlocked'); p.wins = 1; ok(P.unlocked(p, 'vo_tan').ok, 'vo tan unlocked');

// ---- Run: default unchanged
const def = Run.create(7), noOpts = Run.create(7, {});
eq([def.doi, def.money, def.qnMax, Run.interestMax(def), def.chieu, def.start], [CFG.DOI_PER_BAN, CFG.START_MONEY, 5, CFG.INTEREST_MAX, 1, 'mac_dinh'], 'defaults'); eq(Run.ban(def).target, CFG.TARGETS[0][0], 'target default'); eq(Run.ban(def).aiLevel, 1, 'ai default');
ok(def.pool === undefined, 'no pool by default'); eq(Run.shop(def).length, 6, 'default shop size');

// ---- Run: Khởi đầu
r = Run.create(3, { start: 'ngheo' }); eq([r.money, Run.interestMax(r)], [0, CFG.INTEREST_MAX + M.NGHEO_LAI], 'ngheo');
r = Run.create(3, { start: 'cung' }); ok(r.qn[0] && D.QUY_NHAN[r.qn[0].id].rarity === 'hiem', 'cung: hiem Quý nhân'); eq(Run.ban(r).target, Math.round(CFG.TARGETS[0][0] * M.CUNG_TGT_X / 10) * 10, 'cung: target +15%');
r = Run.create(3, { start: 'choi' }); eq([r.qn[0].id, r.doi, Run.doiMax(r)], ['dan_cho_lon', 0, 0], 'choi'); ok(r.seen.includes('dan_cho_lon'), 'choi seen');
r = Run.create(3, { start: 'tro' }); eq([Object.values(r.sao), r.qnMax], [[2, 2, 2, 2, 2, 2], 4], 'tro'); for (let i = 0; i < 4; i++) r.qn[i] = { id: 'ong_do', n: 0 }; r.money = 99; r.phase = 'shop'; const it = Run.shop(r).findIndex(x => x.kind === 'qn'); eq(Run.buy(r, it).why, 'slots', 'tro: 5th slot closed');
r = Run.create(3, { start: 'loc' }); ok(r.que.every(q => q && D.QUE[q]) && r.que[0] !== r.que[1], 'loc: 2 distinct Quẻ');
for (let s = 1; s <= 50; s++) { const a1 = Run.create(s, { start: 'cung' }), a2 = Run.create(s, { start: 'cung' }); eq(a1.qn[0], a2.qn[0], 'cung deterministic'); }

// ---- Run: pool
p = P.empty(); r = Run.create(11, opts(p, {}));
const seenQn = new Set(), seenQue = new Set(); for (let s = 1; s <= 120; s++) { const q = Run.create(s, opts(p, {})); q.chang = 2; q.phase = 'shop'; Run.shop(q).forEach(i => { (i.kind === 'qn' ? seenQn : i.kind === 'que' ? seenQue : new Set()).add(i.id); }); }
ok([...seenQn].every(id => M.POOL.qn.includes(id)), 'shop Quý nhân stay in pool'); ok([...seenQue].every(id => M.POOL.que.includes(id)), 'shop Quẻ stay in pool'); ok(seenQn.size >= 10, 'pool is varied: ' + seenQn.size);
r = Run.create(5, opts(p, {})); r.money = 99; const pk = Run.shop(r).findIndex(i => i.kind === 'pack'); const op = Run.openPack(r, pk); ok(op.ok && op.choices.every(c => c.kind === 'qn' ? M.POOL.qn.includes(c.id) : M.POOL.que.includes(c.id)), 'pack choices in pool');

// ---- Run: Chiếu
const T = c => Run.create(2, { chieu: c });
eq(Run.ban(T(1)).target, CFG.TARGETS[0][0], 'chieu 1 target'); eq(Run.ban(T(2)).target, Math.round(CFG.TARGETS[0][0] * 1.15 / 10) * 10, 'chieu 2 target +15%');
eq([Run.ban(T(2)).aiLevel, Run.ban(T(3)).aiLevel, Run.ban(T(6)).aiLevel], [1, 3, 3], 'chieu 3 ai max');
eq([Run.interestMax(T(3)), Run.interestMax(T(4))], [CFG.INTEREST_MAX, CFG.INTEREST_MAX - 2], 'chieu 4 lai -2');
r = T(4); r.money = 100; r.phase = 'payout'; r.diemBan = 0; ok(Run.payout(r).lines.find(l => l.label === D.TEXT.payout.interest).amount === 3, 'payout uses lowered cap');
r = T(5); r.chang = 2; r.ban = 2; let bi = Run.ban(r); ok(bi.house && bi.house2 && bi.house !== bi.house2, 'chieu 5: two house rules on the last trùm'); eq(Object.keys(bi.mods).length >= 1, true, 'merged mods');
r.chang = 0; bi = Run.ban(r); ok(!bi.house2, 'chieu 5: only the last trùm'); ok(!Run.ban(T(4)).house2, 'chieu 4: none');
r = T(6); r.chang = 1; r.ban = 1; bi = Run.ban(r); ok(bi.house && bi.rule && bi.kind === 'lon' || bi.house, 'chieu 6: bàn lớn has a house rule'); ok(bi.house !== r.bosses[1], 'big rule differs from the trùm rule'); eq(bi.name, D.CHANG[1].ban[1].name, 'big keeps its name');
ok(!Run.ban(T(5)).house || Run.ban(T(5)).house === undefined || (T(5).ban = 1, !Run.ban(Object.assign(T(5), { ban: 1 })).house), 'chieu 5: bàn lớn has none');
r = T(6); eq(Run.doiMax(r), CFG.DOI_PER_BAN - 1, 'chieu 6: one fewer doi'); eq(r.doi, CFG.DOI_PER_BAN - 1, 'chieu 6 run.doi');
r = Run.create(2, { chieu: 6, start: 'choi' }); eq(Run.doiMax(r), 0, 'doi never negative');
r = T(6); r.chang = 2; r.ban = 2; bi = Run.ban(r); ok(bi.house2, 'chieu 6 includes chieu 5');
const st = Run.startVan(r); ok(st && st.hands.length === 2, 'startVan works with two house rules'); ok(r.seen.includes(bi.house2), 'second rule marked seen');

// ---- Run: perks
const PK = o => Run.create(4, { perks: Object.assign({ doi1: 0, giu: 0, lai: 0, reroll: 0 }, o) });
r = PK({ doi1: 1 }); eq([r.doi, Run.doiMax(r)], [CFG.DOI_PER_BAN + 1, CFG.DOI_PER_BAN + 1], 'doi1 first bàn'); r.ban = 1; eq(Run.doiMax(r), CFG.DOI_PER_BAN, 'doi1 only first bàn of a chặng'); r.ban = 0; r.chang = 1; eq(Run.doiMax(r), CFG.DOI_PER_BAN + 1, 'doi1 again next chặng');
eq(Run.interestMax(PK({ lai: 1 })), CFG.INTEREST_MAX + 1, 'lai +1');
r = PK({ reroll: 1 }); r.money = 50; r.phase = 'shop'; Run.shop(r); let m0 = r.money; Run.reroll(r); eq(m0 - r.money, CFG.SHOP.REROLL_BASE - M.REROLL_OFF, 'first reroll cheaper'); m0 = r.money; Run.reroll(r); eq(m0 - r.money, CFG.SHOP.REROLL_BASE + CFG.SHOP.REROLL_STEP, 'second reroll normal');
r = PK({}); r.money = 50; r.phase = 'shop'; Run.shop(r); m0 = r.money; Run.reroll(r); eq(m0 - r.money, CFG.SHOP.REROLL_BASE, 'no perk: base price');
r = PK({ giu: 1 }); r.phase = 'shop'; const items = Run.shop(r); const hi = items.findIndex(i => i.kind === 'qn'); const hid = items[hi].id;
eq(Run.hold(r, hi), { ok: true, kept: true }, 'hold'); eq(Run.hold(r, items.findIndex(i => i.kind === 'pack')).ok, false, 'cannot hold a pack'); eq(Run.hold(PK({}), 0).ok, false, 'no perk no hold');
r.paid = true; Run.nextBan(r); r.vanNo += 2; r.phase = 'shop'; r.shop = { items: [], rerolls: 0, n: 0 }; const next = Run.shop(r); ok(next.some(i => i.id === hid && !i.sold), 'held item returns next shop'); ok(next.filter(i => i.id === hid).length === 1, 'no duplicate of the held item'); ok(r.held === null, 'held consumed');
r = PK({ giu: 1 }); r.phase = 'shop'; Run.shop(r); r.paid = true; Run.nextBan(r); r.phase = 'shop'; r.shop = { items: [], rerolls: 0, n: 0 }; Run.shop(r); ok(!Run.shop(r).some(i => i.held), 'nothing held when nothing marked');

// ---- Run stats: bigPots, bans
r = Run.create(8, {}); const tg = Run.ban(r).target; Run.record(r, [{ type: 'vong', winner: 0, pot: tg }, { type: 'vong', winner: 0, pot: tg - 1 }, { type: 'vong', winner: 1, pot: tg * 2 }]); eq(r.stats.bigPots, 1, 'bigPots counts only pots >= target won by you');
r.diemBan = tg; ok(Run.endVan(r, { type: 'vanEnd', winner: 0, left: [0, 1], heo: [0, 0], cong: false, toiTrang: false, pot: 0 }) === 'cleared', 'cleared'); eq(r.stats.bans, 1, 'bans counted');

// ---- save / load keeps meta fields
r = Run.create(9, { start: 'tro', chieu: 6, perks: { doi1: 1, giu: 0, lai: 1, reroll: 0 }, pool: P.pool(P.empty()) }); const r2 = Run.load(Run.save(r)); ok(r2, 'loads'); eq([r2.start, r2.chieu, r2.qnMax, r2.big, r2.boss2, r2.pool], [r.start, r.chieu, r.qnMax, r.big, r.boss2, r.pool], 'meta fields survive save/load');
console.log(bad ? bad + ' of ' + n + ' failed' : 'ok: ' + n + ' meta checks passed'); process.exit(bad ? 1 : 0);
