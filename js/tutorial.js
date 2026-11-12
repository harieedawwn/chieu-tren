/* js/tutorial.js  (owner TUTORIAL) Ông Táo's guided first ván, Chợ Tết tour and boss tip. Needs config, data, art, fx. Loads after scene, before screens.
 * API  TL.Tutorial
 *   done() -> bool                 main lesson finished or skipped (localStorage CFG.STORAGE.tut, every access in try/catch)
 *   begin() / restart()            start the guided ván now (restart also clears the shop/boss tips so they show again)
 *   on() -> bool                   a tutorial mode is running (main | shop | boss)
 *   vanOpts(run) -> {hands}|undefined   fixed deal for the first ván of the first bàn while mode = main
 *   oppMove(view) -> {type,cardIds}|{type:'pass'}|null   the scripted opponent reply, null = let the AI play
 *   allowCard(id) / allowBtn(id) -> bool   what the player may touch right now; nudge() pulses the highlight when something else is tapped
 *   notify(event, data)            from the table: ready, sel(ids), played{seat,type}, scoreDone{seat,type}, vong{winner}, vanEnd, cleared
 *   gate(point, type) -> bool      false while a step holds the queue at that point (afterScore, afterVong, afterVan, beforePay, boss)
 *   onShop() / onBoss()            first Chợ Tết visit / first bàn trùm: start the one-off tips
 *   onFirst(key)                   one-line bubble the first time ever (localStorage CFG.STORAGE.tut + '.first'): key chat|thoi|cong|toiTrang, text TEXT.first[key]; no-op while another lesson runs
 *   cancel()                       drop the running lesson without saving (leaving the table)
 *   update(dt) / draw(ctx) / pointer(e) -> consumed? / key(k) -> consumed?   called by main
 * Steps: {k, say, say2?, on?: trigger event, wait: 'tap'|'play', cards?: [ids], target: names, avoid?: names, gate?, gateType?, needDone?: {seat,type}, slow?}.
 * The screen under the lesson exposes tutRects() -> {name: [rect...], card(id)}; spotlight holes and the bubble are placed from those, never over them.
 */
(function (TL) {
  'use strict';
  const CFG = TL.CFG, D = TL.DATA, TX = D.TEXT.tut, PAL = CFG.PAL, FX = TL.FX, A = TL.Art;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const G = () => TL.Game;
  const snd = (n, o) => { try { TL.Audio && TL.Audio.play(n, o); } catch (e) {} };

  // ---------------------------------------------------------------- persistence
  function loadFlags() {
    try { const o = JSON.parse(localStorage.getItem(CFG.STORAGE.tut)); if (o && typeof o === 'object') return { main: !!o.main, shop: !!o.shop, boss: !!o.boss }; } catch (e) {}
    return { main: false, shop: false, boss: false };
  }
  const FIRST_KEY = CFG.STORAGE.tut + '.first';
  function loadFirst() { try { const o = JSON.parse(localStorage.getItem(FIRST_KEY)); if (o && typeof o === 'object') return o; } catch (e) {} return {}; }
  let first = loadFirst(), firstKey = null;
  function saveFirst() { try { localStorage.setItem(FIRST_KEY, JSON.stringify(first)); } catch (e) {} }
  let flags = loadFlags();
  function save() { try { localStorage.setItem(CFG.STORAGE.tut, JSON.stringify(flags)); } catch (e) {} }

  // ---------------------------------------------------------------- the scripted ván
  const HANDS = [[0, 2, 20, 21, 22, 23, 25, 26, 36, 47], [5, 8, 11, 14, 29, 33, 41, 45, 48, 50]];   // you: 3♠3♦ 8♠8♣8♦8♥ 9♣9♦ Q♠ A♥ · opp: 5♠5♥ 2♠2♦ + filler
  const OPP = [{ type: 'play', cardIds: [8, 11] }, { type: 'pass' }, { type: 'play', cardIds: [50] }, { type: 'pass' }];
  const MAIN = [
    { k: 'hello', say: TX.hello, on: 'ready', wait: 'tap', target: null },
    { k: 'goal', say: TX.goal, wait: 'tap', target: ['goal'] },
    { k: 'hand', say: TX.hand, wait: 'tap', target: ['hand'] },
    { k: 'pick1', say: TX.pick1, say2: TX.pick1b, wait: 'play', cards: [0, 2] },
    { k: 'score', say: TX.score, on: 'played', seat: 0, wait: 'tap', target: ['score'], needDone: { seat: 0, type: 'play' }, gate: 'afterScore', gateType: 'play', slow: true },
    { k: 'opp', say: TX.opp, on: 'played', seat: 1, wait: 'tap', target: ['pot'], needDone: { seat: 1, type: 'play' }, gate: 'afterScore', gateType: 'play', slow: true },
    { k: 'choice', say: TX.choice, on: 'ready', wait: 'tap', target: ['btns2'] },
    { k: 'pick2', say: TX.pick2, say2: TX.pick2b, wait: 'play', cards: [25, 26] },
    { k: 'vong1', say: TX.vong1, on: 'vong', winner: 0, wait: 'tap', target: ['db'], gate: 'afterVong' },
    { k: 'lead', say: TX.lead, on: 'ready', wait: 'play', cards: [36], target: null },
    { k: 'heo', say: TX.heo, on: 'played', seat: 1, wait: 'tap', target: ['tableOnly'], needDone: { seat: 1, type: 'play' }, gate: 'afterScore', gateType: 'play', slow: true },
    { k: 'pick3', say: TX.pick3, say2: TX.pick3b, on: 'ready', wait: 'play', cards: [20, 21, 22, 23] },
    { k: 'chat', say: TX.chat, on: 'played', seat: 0, wait: 'tap', target: ['pot'], needDone: { seat: 0, type: 'chat' }, gate: 'afterScore', gateType: 'chat', slow: true },
    { k: 'vong2', say: TX.vong2, on: 'vong', winner: 0, wait: 'tap', target: ['db'], gate: 'afterVong' },
    { k: 'last', say: TX.last, on: 'ready', wait: 'play', cards: [47] },
    { k: 'van', say: TX.van, on: 'vanEnd', wait: 'tap', target: ['db', 'opp'], gate: 'afterVan' },
    { k: 'done', say: TX.done, on: 'cleared', wait: 'tap', target: ['goal'], gate: 'beforePay' },
  ];
  const SHOP = [
    { k: 'shop1', say: TX.shop1, wait: 'tap', target: ['qn'] },
    { k: 'shop2', say: TX.shop2, wait: 'tap', target: ['sao'] },
    { k: 'shop3', say: TX.shop3, wait: 'tap', target: ['lixi'] },
  ];
  const BOSS = [{ k: 'boss', say: TX.boss, wait: 'tap', target: ['opp'], gate: 'boss' }];

  // ---------------------------------------------------------------- state
  let mode = null, steps = [], si = 0, shown = false, ready = false, selOK = false, runRef = null, oppN = 0;
  let time = 0, shownAt = 0, typed = 0, nudgeT = 0, slow = false, pos = null, lastKey = '', LB = null, hov = null, down = null, btnR = {};
  const cur = () => steps[si] || null;

  function setSlow(on) {
    if (on === slow) return; slow = on;
    if (on) FX.speed = (G().settings.speed || 1) * 0.5; else G().applySettings();
  }
  function arm() {
    const s = cur(); setSlow(false);
    if (!s) return finish();
    shown = !s.on; ready = s.wait === 'tap' && !s.needDone; selOK = false; typed = 0; shownAt = time; lb(); pos = null;
    if (shown) onShow();
  }
  function onShow() { const s = cur(); shownAt = time; typed = 0; if (s && s.slow) setSlow(true); snd('stamp', { vol: 0.35, pitch: 1.3 }); }
  function advance() { si++; arm(); }
  function finish() {
    setSlow(false);
    if (mode === 'main') flags.main = true; else if (mode === 'shop') flags.shop = true; else if (mode === 'boss') flags.boss = true;
    else if (mode === 'first') { first[firstKey] = true; saveFirst(); }
    if (mode === 'main') { first.chat = first.thoi = true; saveFirst(); }
    save(); mode = null; steps = []; shown = false;
  }
  function skip() { setSlow(false); flags.main = flags.shop = flags.boss = true; save(); mode = null; steps = []; shown = false; snd('button'); }
  function start(kind) { mode = kind; steps = kind === 'main' ? MAIN : kind === 'shop' ? SHOP : BOSS; si = 0; oppN = 0; arm(); }

  const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  function notify(ev, data) {
    if (!mode) return;
    data = data || {};
    const s = cur(); if (!s) return;
    if (ev === 'sel') { const was = selOK; selOK = s.wait === 'play' && !!s.cards && shown && same(data.slice().sort((a, b) => a - b), s.cards.slice().sort((a, b) => a - b)); if (was !== selOK && s.say2) typed = 0; return; }
    if (ev === 'played' && s.wait === 'play' && shown && data.seat === 0) { advance(); return notifyTrigger(ev, data); }
    notifyTrigger(ev, data);
    const c = cur();
    if (ev === 'scoreDone' && c && shown && c.needDone && c.needDone.seat === data.seat && c.needDone.type === data.type) ready = true;
  }
  function notifyTrigger(ev, data) {
    const s = cur();
    if (!s || shown || s.on !== ev) return;
    if (s.seat != null && data.seat !== s.seat) return;
    if (s.winner != null && data.winner !== s.winner) return;
    shown = true; ready = s.wait === 'tap' && !s.needDone; onShow();
  }
  function gate(point, type) {
    if (!mode) return true;
    const s = cur();
    return !(s && shown && s.gate === point && (!s.gateType || s.gateType === type));
  }
  function tap() {
    const s = cur(); if (!mode || !s || !shown || s.wait !== 'tap' || !canTap()) return;
    snd('button'); advance();
  }
  const canTap = () => { const s = cur(); return !!s && shown && s.wait === 'tap' && (ready || time - shownAt > 8); };

  function allowCard(id) { const s = cur(); return !mode || (!!s && shown && s.wait === 'play' && s.cards.indexOf(id) >= 0); }
  function allowBtn(id) { const s = cur(); return !mode || id === 'menu' || (!!s && shown && s.wait === 'play' && selOK && id === 'danh'); }
  function nudge() { nudgeT = 0.5; snd('hover', { vol: 0.5 }); }

  // ---------------------------------------------------------------- bubble layout
  function view() { return { w: G().w, h: G().h }; }
  function metrics() {
    const v = view(), ts = clamp(Math.round(Math.min(v.w * 0.022, v.h * 0.03)), 14, 22), k = v.h >= 640 && v.w >= 560 ? 2 : 1;
    const bw = v.w < 560 ? v.w - 24 : clamp(Math.round(v.w * 0.38), 320, 520);
    return { v: v, ts: ts, k: k, bw: bw, pad: Math.round(ts * 0.8), lh: Math.round(ts * 1.3) };
  }
  function wrapText(str, size, maxW) {
    const out = []; let line = '';
    str.split(' ').forEach(w => { const t = line ? line + ' ' + w : w; if (line && A.textWidth(t, size) > maxW) { out.push(line); line = w; } else line = t; });
    if (line) out.push(line);
    return out;
  }
  function lb() {   // layout of the current bubble: size from the full text so typing never reflows it
    const s = cur(); if (!s) { LB = null; return; }
    const m = metrics(), say = (s.say2 && selOK) ? s.say2 : s.say, pw = 48 * m.k, tw = m.bw - 3 * m.pad - pw;
    const lines = wrapText(say, m.ts, tw), btnH = Math.max(44, Math.round(m.ts * 2.2));
    const textH = Math.round(m.ts * 1.2) + lines.length * m.lh, body = Math.max(pw, textH), bh = m.pad + body + Math.round(m.pad * 0.6) + btnH + m.pad;
    LB = { m: m, say: say, lines: lines, pw: pw, tw: tw, bh: bh, btnH: btnH, n: say.length, key: [m.v.w, m.v.h, say].join('|') };
  }
  function rects() { const sc = G().screen; return sc && sc.tutRects ? sc.tutRects() : null; }
  function targetRects(names, R) {
    const out = [];
    (names || []).forEach(n => {
      if (n === 'tableOnly') { (R.table || []).forEach(r => out.push(r)); return; }
      (R[n] || []).forEach(r => r && out.push(r));
    });
    return out;
  }
  function holes() {
    const s = cur(), R = rects(); if (!s || !R || !shown) return { holes: [], avoid: [] };
    let h = [];
    if (s.wait === 'play') {
      if (selOK) h = targetRects(['danh'], R);
      else h = s.cards.map(id => R.card(id)).filter(Boolean);
    } else h = targetRects(s.target, R);
    let avoid = h.slice();
    if (s.wait === 'play') avoid = s.cards.map(id => R.card(id)).filter(Boolean).concat(R.danh || []);
    (R.played || []).forEach(r => { if (avoid.indexOf(r) < 0) avoid.push(r); });   // keep the cards just played in view
    return { holes: h, avoid: avoid };
  }
  const grow = (r, g) => ({ x: r.x - g, y: r.y - g, w: r.w + 2 * g, h: r.h + 2 * g });
  function merge(list) {   // overlapping holes become one (even-odd fill would cancel the overlap)
    const out = list.map(r => Object.assign({}, r));
    for (let again = true; again;) {
      again = false;
      for (let i = 0; i < out.length && !again; i++) for (let j = i + 1; j < out.length && !again; j++) {
        const a = out[i], b = out[j];
        if (a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y) {
          const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
          out[i] = { x: x, y: y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y }; out.splice(j, 1); again = true;
        }
      }
    }
    return out;
  }
  const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  function place(avoid, bw, bh) {   // nearest free spot to the target: grid search over the screen, never over `avoid`
    const v = view(), mg = 10, safe = G().safe || { t: 0, r: 0, b: 0, l: 0 };
    const X0 = safe.l + mg, X1 = v.w - safe.r - mg - bw, Y0 = safe.t + mg, Y1 = v.h - safe.b - mg - bh;
    if (!avoid.length) return { x: Math.round((v.w - bw) / 2), y: Math.round(clamp(v.h * 0.3, Y0, Y1)) };
    const aq = 9 * arrowQ(v) + 24, zones = avoid.map(r => { const g = grow(r, 20); if (r.y > aq + 6) { g.y -= aq; g.h += aq; } else g.h += aq; return g; }), cx = avoid.reduce((a, r) => a + r.x + r.w / 2, 0) / avoid.length, cy = avoid.reduce((a, r) => a + r.y + r.h / 2, 0) / avoid.length;
    let best = null, bd = 1e12;
    const sx = Math.max(12, (X1 - X0) / 24), sy = Math.max(12, (Y1 - Y0) / 24);
    for (let y = Y0; y <= Y1 + 0.5; y += sy) for (let x = X0; x <= X1 + 0.5; x += sx) {
      const b = { x: x, y: y, w: bw, h: bh };
      if (zones.some(z => hit(b, z))) continue;
      const d = Math.hypot(x + bw / 2 - cx, y + bh / 2 - cy);
      if (d < bd) { bd = d; best = { x: x, y: y }; }
    }
    if (best) return { x: Math.round(best.x), y: Math.round(best.y) };
    let least = null, lo = 1e12;   // nothing fully free: the spot that covers the least
    for (let y = Y0; y <= Y1 + 0.5; y += sy) for (let x = X0; x <= X1 + 0.5; x += sx) {
      let area = 0; zones.forEach(z => { area += Math.max(0, Math.min(x + bw, z.x + z.w) - Math.max(x, z.x)) * Math.max(0, Math.min(y + bh, z.y + z.h) - Math.max(y, z.y)); });
      if (area < lo) { lo = area; least = { x: x, y: y }; }
    }
    return least ? { x: Math.round(least.x), y: Math.round(least.y) } : { x: Math.round(X0), y: Math.round(Y0) };
  }

  // ---------------------------------------------------------------- draw
  const dimRect = (ctx, v, hs) => {
    ctx.save(); ctx.fillStyle = 'rgba(12,8,7,0.72)'; ctx.beginPath(); ctx.rect(0, 0, v.w, v.h);
    hs.forEach(r => ctx.rect(Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h)));
    ctx.fill('evenodd'); ctx.restore();
  };
  function outline(ctx, r, pulse) {
    const t = Math.round(2 + pulse * 3), a = 0.6 + 0.4 * pulse;
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = PAL.vangKim;
    ctx.fillRect(r.x - t, r.y - t, r.w + 2 * t, t); ctx.fillRect(r.x - t, r.y + r.h, r.w + 2 * t, t);
    ctx.fillRect(r.x - t, r.y, t, r.h); ctx.fillRect(r.x + r.w, r.y, t, r.h);
    ctx.restore();
  }
  const arrowQ = v => clamp(Math.round(v.h * 0.0055), 3, 5);
  function arrow(ctx, r, v, bob) {   // pixel pointer above the hole (below it when there is no room), bouncing
    const q = arrowQ(v), above = r.y > 9 * q + 30, cx = r.x + r.w / 2;
    const y0 = above ? Math.round(r.y - 9 * q - 4 - bob) : Math.round(r.y + r.h + 6 + bob);
    const parts = [];   // [x, y, w, h] in units of q from (cx, y0): stem + 4-row head, tip toward the hole
    if (above) { parts.push([-1, 0, 2, 5]); [7, 5, 3, 1].forEach((w, i) => parts.push([-w / 2, 5 + i, w, 1])); }
    else { [1, 3, 5, 7].forEach((w, i) => parts.push([-w / 2, i, w, 1])); parts.push([-1, 4, 2, 5]); }
    const paint = (col, ox, oy) => { ctx.fillStyle = col; parts.forEach(p => ctx.fillRect(Math.round(cx + p[0] * q + ox), y0 + p[1] * q + oy, p[2] * q, p[3] * q)); };
    ctx.save(); paint(PAL.denSon, q, q); paint(PAL.denSon, -q, -q); paint(PAL.denSon, q, -q); paint(PAL.denSon, -q, q); paint(PAL.vangKim, 0, 0); ctx.restore();
  }
  function bubble(ctx, dt) {
    if (!LB || LB.key !== [view().w, view().h, ((cur().say2 && selOK) ? cur().say2 : cur().say)].join('|')) lb();
    const s = cur(), m = LB.m, v = m.v, hs = holes();
    const target = place(hs.avoid, m.bw, LB.bh);
    if (!pos) pos = { x: target.x, y: target.y + 18 };
    const k = 1 - Math.exp(-dt * 14); pos.x += (target.x - pos.x) * k; pos.y += (target.y - pos.y) * k;
    const x = Math.round(pos.x), y = Math.round(pos.y), age = time - shownAt, a = clamp(age / 0.18, 0, 1);
    const R = { x: x, y: y, w: m.bw, h: LB.bh };
    ctx.save(); ctx.globalAlpha = a;
    A.panel(ctx, R, { fill: PAL.giayDo, border: PAL.vangKim, shadow: PAL.denSon, radius: 8, shadowY: 5, bw: 3 });
    // portrait, bobbing while the text types
    const talking = typed < LB.n, bob = talking && !FX.reducedMotion ? Math.round(Math.sin(time * 18) * 1.5) : 0;
    const pc = A.portrait('ong_tao'), px = x + m.pad, py = y + m.pad + bob;
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(pc, Math.round(px), Math.round(py), LB.pw, LB.pw); ctx.restore();
    const tx = px + LB.pw + m.pad, ink = PAL.denSon;
    A.textC(ctx, TX.who, tx, y + m.pad + Math.round(m.ts * 0.6), { size: Math.round(m.ts * 0.9), color: PAL.doSon, outline: false, shadow: false });
    const n = Math.floor(typed); let left = n;
    LB.lines.forEach((l, i) => {
      const part = left <= 0 ? '' : l.slice(0, left); left -= l.length + 1;
      if (part) A.textC(ctx, part, tx, y + m.pad + Math.round(m.ts * 1.2) + i * m.lh + Math.round(m.lh * 0.5), { size: m.ts, color: ink, outline: false, shadow: false });
    });
    // footer: skip link (left), Tiếp (right)
    const fy = y + LB.bh - m.pad - LB.btnH, bwid = Math.min(Math.round(m.bw * 0.34), 150);
    btnR = { next: { x: x + m.bw - m.pad - bwid, y: fy, w: bwid, h: LB.btnH }, skip: { x: x + m.pad, y: fy, w: Math.round(m.bw * 0.5), h: LB.btnH } };
    const ss = Math.max(12, Math.round(m.ts * 0.8)), sw = A.textWidth(TX.skip, ss);
    A.textC(ctx, TX.skip, btnR.skip.x, fy + LB.btnH / 2, { size: ss, color: PAL.nauCanhGian, outline: false, shadow: false });
    ctx.fillStyle = PAL.nauCanhGian; ctx.fillRect(Math.round(btnR.skip.x), Math.round(fy + LB.btnH / 2 + ss * 0.55), Math.round(sw), 1);
    btnR.skip.w = Math.round(sw) + 12;
    if (s.wait === 'tap' && canTap()) A.button(ctx, btnR.next, TX.next, down === 'next' ? 'down' : hov === 'next' ? 'hover' : 'idle');
    ctx.restore();
    LB.rect = R;
  }
  function draw(ctx, dt) {
    if (!mode || G().overlay) return;
    dt = Math.min(dt || 0, 0.1); time += dt; if (nudgeT > 0) nudgeT -= dt;
    const s = cur(); if (!s || !shown) return;
    const v = view();
    typed = FX.reducedMotion ? 1e6 : typed + dt * 52;
    if (Math.floor(typed) % 3 === 0 && typed < (LB ? LB.n : 0) && Math.floor(typed) !== lastKey) { lastKey = Math.floor(typed); snd('hover', { vol: 0.12, pitch: 1.6 }); }
    const hs = holes(), pulse = 0.5 + 0.5 * Math.sin(time * 5) + (nudgeT > 0 ? 1 : 0);
    const hr = merge(hs.holes.map(r => grow(r, 6)));
    ctx.save(); ctx.imageSmoothingEnabled = false;
    dimRect(ctx, v, hr);
    hr.forEach(r => outline(ctx, r, clamp(pulse, 0, 1)));
    if (hs.holes.length) arrow(ctx, grow(hs.holes[0], 6), v, FX.reducedMotion ? 0 : Math.abs(Math.sin(time * 5)) * 6);   // points at the first target, not the merged union
    bubble(ctx, dt);
    ctx.restore();
  }
  function update(dt) {}

  // ---------------------------------------------------------------- input
  const inR = (b, x, y) => !!b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  function pointer(e) {
    if (!mode || G().overlay) return false;
    const s = cur(); if (!s || !shown) return false;
    const over = k => inR(btnR[k], e.x, e.y) && (k !== 'next' || (s.wait === 'tap' && canTap()));
    if (e.type === 'move') { hov = over('next') ? 'next' : over('skip') ? 'skip' : null; return false; }
    if (e.type === 'down') {
      if (over('skip')) { down = 'skip'; return true; }
      if (over('next')) { down = 'next'; return true; }
      if (LB && LB.rect && inR(LB.rect, e.x, e.y)) { typed = 1e6; return true; }
      if (s.wait === 'play') return false;   // the scene decides what a tap on the table means (allowCard / allowBtn)
      nudge(); return true;
    }
    if (e.type === 'up') {
      const d = down; down = null;
      if (d === 'skip' && over('skip')) { skip(); return true; }
      if (d === 'next' && over('next')) { tap(); return true; }
      return s.wait !== 'play';
    }
    return false;
  }
  function key(k) {
    if (!mode || G().overlay) return false;
    const s = cur(); if (!s || !shown) return false;
    if ((k === 'enter' || k === 'space') && s.wait === 'tap') { if (canTap()) tap(); return true; }
    return false;
  }

  // ---------------------------------------------------------------- public
  function belongs(run) { return mode !== 'main' || runRef === run; }
  TL.Tutorial = {
    done: () => flags.main,
    on: () => !!mode,
    mode: () => mode,
    begin(run) { flags = { main: false, shop: false, boss: false }; first = {}; saveFirst(); runRef = run || null; start('main'); },
    restart(run) { this.begin(run); },
    vanOpts(run) { return mode === 'main' && run.chang === 0 && run.ban === 0 && run.vanUsed === 0 ? { hands: HANDS } : undefined; },
    oppMove(view) {
      if (mode !== 'main') return null;
      const m = OPP[oppN++];
      if (!m) return null;
      if (m.type === 'pass') return view.canPass ? m : null;
      return view.legal.some(c => c.cards.join() === m.cardIds.join()) ? m : null;
    },
    allowCard: allowCard, allowBtn: allowBtn, nudge: nudge, notify: notify, gate: gate, cancel() { setSlow(false); mode = null; steps = []; shown = false; },
    attach(run) { if (mode === 'main' && runRef !== run) this.cancel(); },
    onShop() { if (!mode && flags.main && !flags.shop) start('shop'); },
    onFirst(k) {
      if (mode || first[k] || !D.TEXT.first[k]) return;
      firstKey = k; mode = 'first'; steps = [{ k: 'first', say: D.TEXT.first[k], wait: 'tap', target: ['table'] }]; si = 0; oppN = 0; arm();
    },
    onBoss() { if (!mode && flags.main && !flags.boss) start('boss'); },
    _state() { const s = cur(), h = holes(); return { mode: mode, k: s && s.k, wait: s && s.wait, shown: shown, ready: ready, selOK: selOK, typedAll: !!LB && typed >= LB.n, bubble: LB && LB.rect, btns: btnR, holes: h.holes, avoid: h.avoid, say: LB && LB.say }; },
    update: update, draw: draw, pointer: pointer, key: key, _steps: { MAIN: MAIN, SHOP: SHOP, BOSS: BOSS, HANDS: HANDS },
  };
})(globalThis.TL = globalThis.TL || {});
