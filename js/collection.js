/* js/collection.js  (owner SCREENS) Sổ tay (collection), plus the title / end additions. Loads after screens.js and shop.js; wraps the originals, never edits them.
 * API  TL.Collection.{seen() -> string[], merge(ids) -> adds ids to the saved set (localStorage CFG.STORAGE.seen, try/catch), total() -> 38}
 *      TL.Screens.collection = Screen {enter(), exit(), resize(), update(dt), draw(ctx), pointer(e), key(e)}
 *        tabs Quý nhân (20) · Quẻ (6) · Sao (6) · Luật nhà (6); seen cards are real art, unseen are a dark silhouette with "???";
 *        tap a seen card: name, rarity, description; counter "x/38 đã gặp"; Quay lại. Left/Right switch tabs, Esc goes back.
 *      TL.Screens.title  wrapped: adds a "Sổ tay" button (top left).   TL.Screens.end  wrapped: on a win adds "Chơi tiếp: vô tận" (Run.continueEndless, then the table).
 *      TL.Run.save is wrapped so every save merges run.seen into the stored set; the end screen merges too.
 */
(function (TL) {
  'use strict';
  const CFG = TL.CFG, D = TL.DATA, T = D.TEXT, PAL = CFG.PAL, FX = TL.FX, SP = TL.Sprite, A = TL.Art;
  const KEY = (CFG.STORAGE && CFG.STORAGE.seen) || 'chieutren.seen';
  const G = () => TL.Game;
  const snd = (n, o) => { try { TL.Audio && TL.Audio.play(n, o); } catch (e) {} };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const inR = (b, x, y) => !!b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  const ctr = b => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
  const rr = r => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) });
  const txt = (ctx, s, x, y, size, color, align) => A.text(ctx, s, x, y, { size: size, color: color || PAL.giayDo, align: align || 'left' });
  const fit = (s, size, maxW, min) => { while (size > (min || 9) && A.textWidth(s, size) > maxW) size--; return size; };
  const base = () => Math.round(clamp(Math.min(G().w, G().h) / 36, 12, 22));
  const wrap = (s, size, maxW) => { const out = []; let line = ''; String(s).split(' ').forEach(w => { const t = line ? line + ' ' + w : w; if (line && A.textWidth(t, size) > maxW) { out.push(line); line = w; } else line = t; }); if (line) out.push(line); return out; };

  // ---------------------------------------------------------------- the saved set
  const GROUPS = () => [
    { id: 'qn', tab: T.sotay.tabQn, ids: Object.keys(D.QUY_NHAN), data: D.QUY_NHAN, tex: id => A.quyNhan(id), h: 64 },
    { id: 'que', tab: T.sotay.tabQue, ids: Object.keys(D.QUE), data: D.QUE, tex: id => A.que(id), h: 64 },
    { id: 'sao', tab: T.sotay.tabSao, ids: Object.keys(D.SAO), data: D.SAO, tex: id => A.sao(id), h: 64 },
    { id: 'luat', tab: T.sotay.tabLuat, ids: D.BOSS_IDS.slice(), data: D.HOUSE_RULES, tex: id => A.portrait(id), h: 48 },
  ];
  let seenCache = null;
  function seen() {
    if (seenCache) return seenCache.slice();
    let a = []; try { const o = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(o)) a = o.filter(x => typeof x === 'string'); } catch (e) {}
    seenCache = a; return a.slice();
  }
  function merge(ids) {
    if (!Array.isArray(ids) || !ids.length) return;
    const cur = seen(), set = new Set(cur); let add = false; ids.forEach(id => { if (typeof id === 'string' && !set.has(id)) { set.add(id); cur.push(id); add = true; } });
    if (!add) return; seenCache = cur;
    try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch (e) {}
  }
  const total = () => GROUPS().reduce((a, g) => a + g.ids.length, 0);
  TL.Collection = { seen: seen, merge: merge, total: total };

  const origSave = TL.Run.save;
  TL.Run.save = function (run) { try { if (run && run.seen && !(G() && G().flags.auto)) merge(run.seen); } catch (e) {} return origSave(run); };

  // ---------------------------------------------------------------- shared button bits
  function Btns() {
    const o = { list: [], hover: null, down: null };
    const hit = (x, y) => o.list.find(b => b.on !== false && inR(b.r, x, y)) || null;
    o.draw = ctx => o.list.forEach(b => A.button(ctx, b.r, b.label, b.on === false ? 'disabled' : o.down === b.id ? 'down' : (b.sel || o.hover === b.id) ? 'hover' : 'idle'));
    o.pointer = (e, fn) => {
      if (e.type === 'move') { const b = hit(e.x, e.y); o.hover = b ? b.id : null; return false; }
      if (e.type === 'down') { const b = hit(e.x, e.y); o.down = b ? b.id : null; o.hover = o.down; if (b) snd('button'); return !!b; }
      if (e.type === 'up') { const b = hit(e.x, e.y), d = o.down; o.down = null; o.hover = null; if (b && d === b.id) { fn(b.id); return true; } }
      return false;
    };
    return o;
  }

  // ---------------------------------------------------------------- Sổ tay
  const Col = (() => {
    let groups, tab, sprites, sel, btns, L, key, seenSet, menuDown = false;
    const silCache = {};
    function silhouette(tex, id) {
      if (silCache[id]) return silCache[id];
      const c = document.createElement('canvas'); c.width = tex.width; c.height = tex.height;
      const x = c.getContext('2d'); x.drawImage(tex, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = PAL.nauCanhGian; x.fillRect(0, 0, c.width, c.height);
      return (silCache[id] = c);
    }
    const isSeen = id => seenSet.has(id);
    const grp = () => groups[tab];

    function lay() {
      const g = G(), w = g.w, h = g.h, sf = g.safe, dpr = g.dpr, k = [w, h, dpr, sf.t, sf.r, sf.b, sf.l, tab].join();
      if (k === key) return false; key = k;
      const X0 = sf.l + 8, X1 = w - sf.r - 8, Y0 = sf.t + 6, Y1 = h - sf.b - 8, u = base(), gap = Math.max(6, Math.round(u * 0.5)), o = { u: u, gap: gap };
      const wide = (X1 - X0) / (Y1 - Y0) > 1.25, btnH = 48;
      o.bar = { x: X0, y: Y0, w: X1 - X0, h: 44 };
      const tabY = Y0 + 44 + gap, tabW = Math.floor((X1 - X0 - 3 * gap) / 4);
      o.tabs = [0, 1, 2, 3].map(i => rr({ x: X0 + i * (tabW + gap), y: tabY, w: tabW, h: 44 }));
      const top = tabY + 44 + gap, colW = wide ? Math.round((X1 - X0) * 0.64) : X1 - X0, infoMin = Math.round(u * 6);
      const availW = colW, availH = wide ? Y1 - top : Y1 - top - infoMin - btnH - gap * 3;
      const n = grp().ids.length, hh = grp().h;
      let sc = 1, cols = 1, rows = n;
      for (let s = 6; s >= 1; s--) {
        const cw = 48 * s / dpr, ch = hh * s / dpr, c = Math.max(1, Math.floor((availW + gap) / (cw + gap))), rws = Math.ceil(n / c);
        if (rws * (ch + gap) - gap <= availH || s === 1) { sc = s; cols = c; rows = rws; break; }
      }
      const cw = 48 * sc / dpr, ch = hh * sc / dpr, gw = cols * cw + (cols - 1) * gap, gh = rows * ch + (rows - 1) * gap;
      const gx = X0 + (colW - gw) / 2, gy = wide ? top + Math.max(0, (availH - gh) / 2) : top;
      o.scale = sc; o.cells = grp().ids.map((id, i) => rr({ x: gx + (i % cols) * (cw + gap), y: gy + Math.floor(i / cols) * (ch + gap), w: cw, h: ch }));
      if (wide) {
        const rx = X0 + colW + gap * 2, rw = X1 - rx;
        o.info = rr({ x: rx, y: top, w: rw, h: Y1 - top - btnH - gap }); o.back = rr({ x: rx + (rw - Math.min(rw, 320)) / 2, y: Y1 - btnH, w: Math.min(rw, 320), h: btnH });
      } else {
        const by = Y1 - btnH; o.info = rr({ x: X0, y: Math.min(gy + gh + gap, by - gap - infoMin), w: X1 - X0, h: Math.max(infoMin, by - gap - Math.min(gy + gh + gap, by - gap - infoMin)) });
        o.back = rr({ x: X0, y: by, w: X1 - X0, h: btnH });
      }
      o.menu = { x: w - sf.r - 8 - 44, y: sf.t + 6, w: 44, h: 44 };
      L = o; return true;
    }
    function mkSprites() {
      const gp = grp(); sprites = gp.ids.map((id, i) => {
        const tex = isSeen(id) ? gp.tex(id) : silhouette(gp.tex(id), id), s = SP.create({ tex: tex, scale: L.scale }); s.sway = false; s.cid = id;
        const c = ctr(L.cells[i]); s.T.x = s.V.x = c.x; s.T.y = s.V.y = c.y; s._sp.x.x = c.x; s._sp.y.x = c.y; return s;
      });
    }
    function setTab(t, silent) {
      tab = t; sel = null; key = ''; lay(); mkSprites(); buildBtns(); if (!silent) snd('select');
    }
    function buildBtns() {
      btns.list = [].concat(L.tabs.map((r, i) => ({ id: 'tab' + i, label: groups[i].tab, r: r, sel: i === tab })), [{ id: 'back', label: T.sotay.back, r: L.back, on: true }]);
    }
    function enter() {
      FX.reset(); if (TL.BG) TL.BG.setMood('title');
      groups = GROUPS(); seenSet = new Set(seen()); btns = Btns(); menuDown = false; tab = 0; key = ''; sel = null; lay(); mkSprites(); buildBtns();
      sprites.forEach((s, i) => s.deal({ x: L.bar.x + L.bar.w / 2, y: L.bar.y }, 0.03 * i, s.tex));
      snd('shuffle');
    }
    function act(id) { if (id === 'back') { snd('button'); G().setScreen('title'); } else if (id.indexOf('tab') === 0) setTab(+id.slice(3)); }
    function update(dt) { if (lay()) { mkSprites(); } sprites.forEach(s => s.update(dt)); buildBtns(); }
    function chip(ctx, rarity, x, y) {
      const c = rarity === 'bau' ? { fill: TL.CFG.BAU.AURA[0], ink: PAL.giayDo } : rarity === 'quy' ? { fill: PAL.vangKim, ink: PAL.denSon } : rarity === 'hiem' ? { fill: PAL.menLam, ink: PAL.giayDo } : { fill: PAL.denSon, ink: PAL.giayDo };
      A.badge(ctx, T.rarity[rarity], x, y, { size: Math.max(11, L.u - 2), fill: c.fill, ink: c.ink, anchor: 'center' });
    }
    function draw(ctx) {
      lay(); const u = L.u, B = L.bar, gp = grp(), all = groups.reduce((a, g) => a + g.ids.filter(isSeen).length, 0);
      A.panel(ctx, B, { fill: PAL.nauCanhGian, border: PAL.vangKim, radius: 4 });
      txt(ctx, T.sotay.title, B.x + 14, B.y + 6, 28, PAL.vangKim, 'left');
      const cnt = T.sotay.count.replace('%d', all).replace('%d', total());
      txt(ctx, cnt, B.x + B.w - 14, B.y + 11, fit(cnt, 20, B.w * 0.5, 12), PAL.giayDo, 'right');
      btns.draw(ctx);
      if (sel != null) { const r = L.cells[sel]; A.panel(ctx, { x: r.x - 4, y: r.y - 4, w: r.w + 8, h: r.h + 8 }, { fill: PAL.denSon, border: PAL.vangKim, shadow: null, radius: 4 }); }
      SP.drawAll(ctx, sprites);
      sprites.forEach((s, i) => {
        if (isSeen(s.cid)) return; const r = L.cells[i];
        A.textC(ctx, T.sotay.unseen, r.x + r.w / 2, r.y + r.h / 2, { size: fit(T.sotay.unseen, u + 4, r.w - 6, 10), color: PAL.giayDo, align: 'center', outline: PAL.denSon });
      });
      A.panel(ctx, L.info, { fill: PAL.nauCanhGian, border: PAL.vangKim, radius: 5 });
      const I = L.info, pad = 10, ww = I.w - pad * 2; let y = I.y + pad;
      if (sel == null) { txt(ctx, gp.tab + ' · ' + gp.ids.filter(isSeen).length + '/' + gp.ids.length, I.x + pad, y, u + 3, PAL.vangKim); txt(ctx, T.sotay.hint, I.x + pad, y + Math.round((u + 3) * 1.5), u, PAL.giayDo); return; }
      const id = gp.ids[sel], d = gp.data[id];
      if (!isSeen(id)) { txt(ctx, T.sotay.unseen, I.x + pad, y, u + 3, PAL.vangKim); return; }
      const sz = fit(d.name, u + 3, ww - 70, 11); txt(ctx, d.name, I.x + pad, y, sz, PAL.vangKim);
      if (gp.id === 'luat') A.badge(ctx, T.hud.house, I.x + I.w - pad - 36, y + sz * 0.6, { size: Math.max(11, u - 2), fill: PAL.doSon, ink: PAL.giayDo, anchor: 'center' }); else if (gp.id !== 'sao') chip(ctx, d.rarity, I.x + I.w - pad - 30, y + sz * 0.6);
      y += Math.round(sz * 1.5);
      [[d.desc, PAL.giayDo]].concat(d.quote && gp.id !== 'luat' ? [['“' + d.quote + '”', PAL.laXanh]] : []).forEach(l => wrap(l[0], u, ww).forEach(t => { if (y + u < I.y + I.h - 2) txt(ctx, t, I.x + pad, y, u, l[1], 'left'); y += Math.round(u * 1.3); }));
    }
    function pointer(e) {
      if (e.type === 'move') { btns.pointer(e); SP.hover(sprites, e.x, e.y); return; }
      if (e.type === 'down') {
        if (btns.pointer(e)) return;
        const s = SP.pick(sprites, e.x, e.y);
        if (s) { sel = sprites.indexOf(s); s.juice(0.8); snd(isSeen(s.cid) ? 'select' : 'button'); }
        return;
      }
      if (e.type === 'up') btns.pointer(e, act);
    }
    function key_(e) {
      if (e.key === 'esc' || e.key === 'enter') act('back');
      else if (e.key === 'left') setTab((tab + 3) % 4); else if (e.key === 'right') setTab((tab + 1) % 4);
    }
    return { enter: enter, exit() {}, resize() { key = ''; }, update: update, draw: draw, pointer: pointer, key: key_ };
  })();
  TL.Screens.collection = Col;

  // ---------------------------------------------------------------- wrap title and end: extra button placed under the original ones
  function captureButtons(fn, ctx) {   // run the original draw while recording every A.button rect it draws (label non-empty)
    const orig = A.button, got = [];
    A.button = function (c, rect, label, st) { if (label) got.push(rect); return orig.apply(this, arguments); };
    try { fn(ctx); } finally { A.button = orig; }
    return got;
  }
  function extraButton(parent, label, id, onClick) {
    let r = null, st = null, hover = false, down = false;
    function place(got) {
      const g = G(), sf = g.safe; if (!got.length) { r = null; return; }
      const w = Math.max.apply(null, got.map(b => b.w)), x0 = got[0].x, y1 = Math.max.apply(null, got.map(b => b.y + b.h)), y0 = Math.min.apply(null, got.map(b => b.y)), h = got[0].h, gap = 10;
      r = { x: Math.round(x0 + (got[0].w - w) / 2), y: Math.round(y1 + gap), w: Math.round(w), h: h };
      if (r.y + r.h > g.h - sf.b - 4) r.y = Math.round(y0 - gap - h);
    }
    return {
      draw(ctx, got) { place(got); if (r) A.button(ctx, r, label, down ? 'down' : hover ? 'hover' : 'idle'); },
      pointer(e) {
        if (!r) return false;
        if (e.type === 'move') { hover = inR(r, e.x, e.y); return false; }
        if (e.type === 'down' && inR(r, e.x, e.y)) { down = true; snd('button'); return true; }
        if (e.type === 'up' && down) { down = false; if (inR(r, e.x, e.y)) { onClick(); return true; } }
        return false;
      },
      reset() { down = hover = false; r = null; },
    };
  }
  function wrapScreen(name, mk, enterHook) {
    const orig = TL.Screens[name]; if (!orig) return;
    let extra = null;
    TL.Screens[name] = Object.assign({}, orig, {
      enter(args) { extra = mk(args); if (enterHook) enterHook(args); return orig.enter.apply(this, arguments); },
      draw(ctx) { const got = captureButtons(orig.draw.bind(orig), ctx); if (extra) extra.draw(ctx, got); },
      pointer(e) { if (extra && extra.pointer(e)) return; return orig.pointer.apply(orig, arguments); },
    });
  }
  wrapScreen('title', () => {
    // the book button sits top left, clear of the title's own buttons
    let r = null, hover = false, down = false;
    const rect = () => { const g = G(); return { x: g.safe.l + 8, y: g.safe.t + 6, w: 120, h: 44 }; };
    return {
      draw(ctx) { r = rect(); A.button(ctx, r, T.title.sotay, down ? 'down' : hover ? 'hover' : 'idle'); },
      pointer(e) {
        r = r || rect();
        if (e.type === 'move') { hover = inR(r, e.x, e.y); return false; }
        if (e.type === 'down' && inR(r, e.x, e.y)) { down = true; snd('button'); return true; }
        if (e.type === 'up' && down) { down = false; if (inR(r, e.x, e.y)) { G().setScreen('collection'); return true; } }
        return false;
      },
    };
  });
  let endRun = null;
  wrapScreen('end', args => {
    const run = (args && args.run) || G().run, won = !!(args && args.result === 'won') || (run && run.phase === 'won');
    endRun = run; try { if (run && run.seen) merge(run.seen); } catch (e) {}
    if (!won || !run) return null;
    return extraButton(null, T.end.endless, 'endless', () => {
      if (!TL.Run.continueEndless(run)) return;
      try { localStorage.setItem(CFG.STORAGE.save, TL.Run.save(run)); } catch (e) {}
      G().run = run; G().setScreen('table');
    });
  });
})(globalThis.TL = globalThis.TL || {});
