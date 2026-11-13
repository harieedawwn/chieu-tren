/* js/profile.js  (owner META) Tiếng tăm, Cây mai, Khởi đầu, Chiếu, Thử thách ngày. Pure logic; the only side effect is localStorage CFG.STORAGE.profile (every access in try/catch). Needs config, data, content, run.
 * A profile p is plain JSON: {v:1, xp, spent, nodes:{id:true}, best (highest Chiếu won, 0 = none), runs, wins, endless (won once), daily:{date,seed,won,bans,bestPot,chieu}|null, dailyDone:{yyyymmdd:true}}
 * API  TL.Profile.empty() -> p                    TL.Profile.load() -> p (never throws; bad data -> empty)      TL.Profile.save(p) -> bool       TL.Profile.get() -> shared p (loaded once)
 *      TL.Profile.level(xp) -> {level, into, need}        level 1 at 0 xp; need = xp to the next level; each level above 1 = 1 hoa mai
 *      TL.Profile.mai(p) -> hoa mai left to spend         TL.Profile.canBuy(p, id) -> {ok, why?}  why: 'owned'|'req'|'mai'|'none'     TL.Profile.buy(p, id) -> {ok, why?}
 *      TL.Profile.starts(p) -> Khởi đầu ids unlocked      TL.Profile.chieuMax(p) -> highest Chiếu playable (best + 1, cap CFG.META.CHIEU_MAX, min 1)
 *      TL.Profile.pool(p) -> {qn, que, bau} card ids in the pool      TL.Profile.perks(p) -> {doi1, giu, lai, reroll} (0|1)
 *      TL.Profile.options(p, {start, chieu, daily}) -> opts for TL.Run.create (start/chieu clamped to what p has unlocked)
 *      TL.Profile.runXp(run, won) -> {lines:[{key, label, amount}], total}     xp for one finished run (bàn vượt, chặt, hũ >= mục tiêu, thắng) x CFG.META.XP.CHIEU_X[run.chieu]
 *      TL.Profile.finish(p, run, won, date?) -> {xp, lines, level0, level1, mai, best, newBest}   adds xp, counts the run, raises best on a win at run.chieu, records the daily result when run.daily
 *      TL.Profile.dailySeed(date?) -> yyyymmdd (number)    TL.Profile.dailyOptions() -> {seed, opts}  (Mặc định, Chiếu 2, base pool, no perks: the same for everyone)
 *      TL.Profile.dailyAvailable(p, date?) -> bool        one try per day     TL.Profile.dailyShare(entry) -> string for "Sao chép kết quả"
 *      TL.Profile.unlocked(p, mode) -> {ok, need?}        mode 'thuong' | 'daily' | 'vo_tan' (needs a win) | 'solo' (Sòng bốn, needs level CFG.META.SOLO_LEVEL)
 */
(function (TL) {
  'use strict';
  const CFG = TL.CFG, D = TL.DATA, M = () => CFG.META;
  const KEY = () => CFG.STORAGE.profile || 'chieutren.profile';
  const byId = id => M().TREE.find(n => n.id === id);

  const empty = () => ({ v: 1, xp: 0, spent: 0, nodes: {}, best: 0, runs: 0, wins: 0, endless: false, daily: null, dailyDone: {} });
  const num = (x, d) => (typeof x === 'number' && isFinite(x) && x >= 0 ? Math.floor(x) : d);
  function sanitize(o) {
    const p = empty();
    if (!o || typeof o !== 'object') return p;
    p.xp = num(o.xp, 0); p.spent = num(o.spent, 0); p.best = Math.min(M().CHIEU_MAX, num(o.best, 0)); p.runs = num(o.runs, 0); p.wins = num(o.wins, 0); p.endless = !!o.endless;
    if (o.nodes && typeof o.nodes === 'object') M().TREE.forEach(n => { if (o.nodes[n.id] === true) p.nodes[n.id] = true; });
    if (o.dailyDone && typeof o.dailyDone === 'object') Object.keys(o.dailyDone).forEach(k => { if (/^\d{8}$/.test(k)) p.dailyDone[k] = true; });
    if (o.daily && typeof o.daily === 'object' && /^\d{8}$/.test(String(o.daily.date))) p.daily = { date: String(o.daily.date), seed: num(o.daily.seed, 0), won: !!o.daily.won, bans: num(o.daily.bans, 0), bestPot: num(o.daily.bestPot, 0), chieu: num(o.daily.chieu, M().DAILY_CHIEU) };
    p.spent = Math.min(p.spent, level(p.xp).level - 1);   // can never have spent more than earned
    return p;
  }
  function load() { try { return sanitize(JSON.parse(localStorage.getItem(KEY()))); } catch (e) { return empty(); } }
  function save(p) { try { localStorage.setItem(KEY(), JSON.stringify(p)); return true; } catch (e) { return false; } }
  let shared = null;
  const get = () => shared || (shared = load());

  // ---- Tiếng tăm: level n -> n+1 costs BASE + STEP x (n-1) xp
  function level(xp) {
    const L = M().LEVEL; let lv = 1, left = Math.max(0, xp | 0), need = L.BASE;
    while (left >= need) { left -= need; lv++; need = L.BASE + L.STEP * (lv - 1); }
    return { level: lv, into: left, need: need };
  }
  const mai = p => level(p.xp).level - 1 - p.spent;

  // ---- Cây mai
  function owned(p, id) { return !!p.nodes[id]; }
  function canBuy(p, id) {
    const n = byId(id);
    if (!n) return { ok: false, why: 'none' };
    if (owned(p, id)) return { ok: false, why: 'owned' };
    if (n.req && !owned(p, n.req)) return { ok: false, why: 'req' };
    if (mai(p) < n.cost) return { ok: false, why: 'mai' };
    return { ok: true };
  }
  function buy(p, id) { const c = canBuy(p, id); if (!c.ok) return c; p.nodes[id] = true; p.spent += byId(id).cost; return { ok: true }; }

  const starts = p => M().STARTS.filter(s => s === 'mac_dinh' || M().TREE.some(n => n.start === s && owned(p, n.id)));
  const chieuMax = p => Math.max(1, Math.min(M().CHIEU_MAX, p.best + 1));
  function pool(p) {
    const out = { qn: M().POOL.qn.slice(), que: M().POOL.que.slice(), bau: M().POOL.bau.slice() };
    M().TREE.forEach(n => { if (owned(p, n.id)) ['qn', 'que', 'bau'].forEach(k => { (n[k] || []).forEach(id => { if (!out[k].includes(id)) out[k].push(id); }); }); });
    return out;
  }
  function perks(p) { const o = { doi1: 0, giu: 0, lai: 0, reroll: 0 }; M().TREE.forEach(n => { if (n.perk && owned(p, n.id)) o[n.perk] = 1; }); return o; }
  function options(p, o) {
    o = o || {};
    const st = starts(p), start = st.includes(o.start) ? o.start : 'mac_dinh', chieu = Math.max(1, Math.min(chieuMax(p), (o.chieu | 0) || 1));
    return { start: start, chieu: chieu, perks: perks(p), pool: pool(p), daily: !!o.daily };
  }

  // ---- XP
  function runXp(run, won) {
    const X = M().XP, st = run.stats || {}, lines = [];
    const add = (key, n, per) => { if (n > 0) lines.push({ key: key, label: D.TEXT.meta.xp[key] + (key === 'win' ? '' : ' ×' + n), amount: n * per }); };
    add('ban', st.bans || 0, X.BAN); add('chat', st.chat || 0, X.CHAT); add('bigPot', st.bigPots || 0, X.BIG_POT); if (won) add('win', 1, X.WIN);
    const sub = lines.reduce((a, l) => a + l.amount, 0), mult = X.CHIEU_X[Math.max(1, Math.min(M().CHIEU_MAX, run.chieu || 1))] || 1;
    let total = sub;
    if (mult !== 1 && sub > 0) { total = Math.round(sub * mult); lines.push({ key: 'chieu', label: D.TEXT.meta.xp.chieu + ' ×' + String(mult).replace('.', ','), amount: total - sub }); }
    return { lines: lines, total: total };
  }

  // ---- daily
  const pad = n => (n < 10 ? '0' : '') + n;
  function dateKey(d) { d = d || new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
  const dailySeed = d => dateKey(d);
  function dailyOptions(d) {
    const base = { qn: M().POOL.qn.slice(), que: M().POOL.que.slice(), bau: M().POOL.bau.slice() };
    return { seed: dailySeed(d), opts: { start: 'mac_dinh', chieu: M().DAILY_CHIEU, perks: { doi1: 0, giu: 0, lai: 0, reroll: 0 }, pool: base, daily: true } };
  }
  const dailyAvailable = (p, d) => !p.dailyDone[String(dateKey(d))];
  function dailyShare(e) { const s = String(e.date); return D.TEXT.meta.share.replace('%s', s.slice(6, 8) + '/' + s.slice(4, 6)).replace('%d', e.bans).replace('%s', TL.fmt(e.bestPot)); }

  function finish(p, run, won, date) {
    const xp = runXp(run, !!won), l0 = level(p.xp).level;
    p.xp += xp.total; p.runs++;
    let newBest = false;
    if (won) { p.wins++; if (!run.daily && (run.chieu || 1) > p.best) { p.best = Math.min(M().CHIEU_MAX, run.chieu || 1); newBest = true; } if (run.endless || run.phase === 'won') p.endless = true; }
    if (run.daily) {
      const key = String(run.seed || dateKey(date));
      p.dailyDone[key] = true;
      p.daily = { date: key, seed: run.seed >>> 0, won: !!won, bans: run.chang * 3 + run.ban + (run.phase === 'won' ? 1 : 0), bestPot: (run.stats && run.stats.bestPot) || 0, chieu: run.chieu || M().DAILY_CHIEU };
    }
    const l1 = level(p.xp).level;
    return { xp: xp.total, lines: xp.lines, level0: l0, level1: l1, mai: l1 - l0, best: p.best, newBest: newBest };
  }

  function unlocked(p, mode) {
    if (mode === 'vo_tan') return p.wins > 0 || p.endless ? { ok: true } : { ok: false, need: 'win' };
    if (mode === 'solo') return level(p.xp).level >= M().SOLO_LEVEL ? { ok: true } : { ok: false, need: 'level', level: M().SOLO_LEVEL };
    return { ok: true };
  }

  TL.Profile = { empty: empty, load: load, save: save, get: get, level: level, mai: mai, canBuy: canBuy, buy: buy, starts: starts, chieuMax: chieuMax, pool: pool, perks: perks, options: options, runXp: runXp, finish: finish, dailySeed: dailySeed, dailyOptions: dailyOptions, dailyAvailable: dailyAvailable, dailyShare: dailyShare, unlocked: unlocked };
})(globalThis.TL = globalThis.TL || {});
