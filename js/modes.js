/* js/modes.js  (owner SCREENS) mode select, Khởi đầu + Chiếu picker, Cây mai. Needs screens.js (TL.Screens._u helpers), profile.js, trans.js.
 * API  TL.Screens.{modes, start, mai}  Screen objects. TL.Modes.begin({mode:'thuong'|'vo_tan', daily?, start?, chieu?}) builds the run (Profile.options -> Run.create) and goes to the table; TL.Modes.again() repeats the last begin().
 *   modes  4 big cards: Chơi thường -> start; Thử thách ngày (one try a day, begins at once); Vô tận (needs a win); Sòng bốn (needs Tiếng tăm cấp CFG.META.SOLO_LEVEL; begin({mode:'solo'}) -> Run.create seats:4, no tutorial).
 *   start  enter({mode}): Khởi đầu cards (locked ones are shadows), Chiếu ladder (1..6, locked above Profile.chieuMax), Bắt đầu. Keys: left/right Khởi đầu, up/down Chiếu, enter start, esc back.
 *   mai    Cây mai: three branches of nodes drawn as a pixel plum branch; tap a node -> details + Mua; bought nodes bloom. Saves the profile after each buy.
 * Entrances stagger with outBack (reducedMotion: none). Leaving goes through TL.Trans.
 */
(function (TL) {
  'use strict';
  const CFG = TL.CFG, D = TL.DATA, PAL = CFG.PAL, FX = TL.FX, A = TL.Art, U = TL.Screens._u, MT = D.TEXT.modes, MM = D.TEXT.meta;
  const { Btns, txt, fit, base, inR, clamp, snd, wrap } = U;
  const G = () => TL.Game, P = () => TL.Profile.get(), META = () => CFG.META;
  const go = (n, a, k) => TL.Trans.go(n, a, k);
  let last = null;

  function begin(c) {
    const g = G(), p = P(); let seed, o;
    if (c.daily) { const d = TL.Profile.dailyOptions(); seed = d.seed; o = d.opts; }
    else { o = TL.Profile.options(p, { start: c.start, chieu: c.chieu }); seed = g.flags.seed != null ? g.flags.seed : undefined; }
    if (c.mode === 'solo') o = Object.assign({}, o, { seats: 4 });
    const run = TL.Run.create(seed, o);
    if (c.mode === 'vo_tan') { run.phase = 'won'; TL.Run.continueEndless(run); }
    g.run = run; last = c;
    if (!c.daily && c.mode !== 'vo_tan' && c.mode !== 'solo' && TL.Tutorial && !g.flags.auto && !TL.Tutorial.done()) TL.Tutorial.begin(run);
    go('table', null, 'bai');
  }
  const again = () => { if (last && !last.daily) begin(last); else go('modes'); };
  TL.Modes = { begin: begin, again: again };

  // ---- shared bits
  const ent = (tt, i) => (FX.reducedMotion ? 1 : clamp((tt - i * 0.07) / 0.35, 0, 1));
  const pop = (tt, i) => { const q = ent(tt, i); return q >= 1 ? 1 : FX.ease.outBack(q); };
  function head(ctx, title, tt) {
    const g = G(), ts = fit(title, clamp(Math.round(g.h / 12), 20, 40), g.w - 2 * (g.safe.l + 76), 16); txt(ctx, title, g.w / 2, g.safe.t + 10, ts, PAL.vangKim, 'center', { outline: PAL.denSon, shadow: PAL.doSon });
  }
  const backRect = () => { const g = G(); return { x: g.safe.l + 8, y: g.safe.t + 6, w: 52, h: 44 }; };
  function backBtn(ctx, down) { A.button(ctx, backRect(), '‹', down ? 'down' : 'idle'); }
  function fill(ctx, r, c, a) { ctx.save(); ctx.globalAlpha = a == null ? 1 : a; ctx.fillStyle = c; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.restore(); }
  function lines(ctx, s, r, size, color, maxLines) {
    const ls = wrap(s, size, r.w), n = Math.min(ls.length, maxLines || 9);
    for (let i = 0; i < n; i++) txt(ctx, ls[i], r.x + r.w / 2, r.y + i * Math.round(size * 1.15), size, color, 'center');
    return n;
  }

  // ================================================================ MODES
  const Modes = (() => {
    let btns = Btns(), cards = [], L = null, key = '', tt = 0, back = false, hov = -1, note = '';
    function states() {
      const p = P(), un = id => TL.Profile.unlocked(p, id), t = id => MT[id];
      const vt = un('vo_tan'), so = un('solo'), da = TL.Profile.dailyAvailable(p);
      return [
        { id: 'thuong', name: t('thuong')[0], desc: t('thuong')[1], ok: true },
        { id: 'daily', name: t('daily')[0], desc: t('daily')[1], ok: da, why: da ? MT.today : MT.done },
        { id: 'vo_tan', name: t('vo_tan')[0], desc: t('vo_tan')[1], ok: vt.ok, why: MT.needWin },
        { id: 'solo', name: t('solo')[0], desc: t('solo')[1], ok: so.ok, why: MT.needLevel.replace('%d', META().SOLO_LEVEL) },
      ];
    }
    function lay() {
      const g = G(), sf = g.safe, k = [g.w, g.h, g.dpr].join();
      if (k === key) return; key = k;
      const X0 = sf.l + 12, X1 = g.w - sf.r - 12, Y0 = sf.t + 58, Y1 = g.h - sf.b - 12, W = X1 - X0, H = Y1 - Y0, wide = W / H > 1.15, gap = 12;
      const cols = wide ? 4 : 2, rows = wide ? 1 : 2, cw = Math.min(250, (W - gap * (cols - 1)) / cols), ch = Math.min(wide ? 230 : 240, (H - gap * (rows - 1)) / rows);
      const x0 = X0 + (W - cols * cw - (cols - 1) * gap) / 2, y0 = Y0 + (H - rows * ch - (rows - 1) * gap) / 2;
      L = { u: base(), rects: [0, 1, 2, 3].map(i => ({ x: Math.round(x0 + (i % cols) * (cw + gap)), y: Math.round(y0 + Math.floor(i / cols) * (ch + gap)), w: Math.round(cw), h: Math.round(ch) })) };
    }
    function enter() { if (TL.BG) TL.BG.setMood('title'); tt = 0; key = ''; back = false; hov = -1; cards = states(); lay(); }
    function pick(i) { const c = cards[i]; if (!c) return; if (!c.ok) { snd('nope'); return; } if (c.id === 'daily') begin({ mode: 'thuong', daily: true }); else go('start', { mode: c.id }); }
    function draw(ctx) {
      lay(); head(ctx, MT.title, tt); backBtn(ctx, back);
      cards.forEach((c, i) => {
        const r = L.rects[i], q = pop(tt, i + 1), s = FX.reducedMotion ? 1 : q, cy = r.y + r.h / 2, hh = r.h * s, rr = { x: r.x, y: Math.round(cy - hh / 2), w: r.w, h: Math.max(4, Math.round(hh)) };
        A.panel(ctx, rr, { fill: c.ok ? PAL.nauCanhGian : PAL.denSon, border: c.ok ? (hov === i ? PAL.giayDo : PAL.vangKim) : PAL.nauCanhGian, radius: 6 });
        if (q < 0.8) return;
        const u = L.u, ns = fit(c.name, Math.round(u * 1.9), r.w - 16, 12);
        txt(ctx, c.name, r.x + r.w / 2, r.y + 14, ns, c.ok ? PAL.vangKim : PAL.giayDo, 'center', { outline: PAL.denSon });
        const dr = { x: r.x + 10, y: r.y + 14 + Math.round(ns * 1.5), w: r.w - 20 };
        lines(ctx, c.desc, dr, Math.round(u * 1.05), PAL.giayDo, 5);
        if (!c.ok) { fill(ctx, { x: r.x + 3, y: r.y + 3, w: r.w - 6, h: r.h - 6 }, PAL.denSon, 0.55); txt(ctx, c.soon ? MT.soon : MT.lock, r.x + r.w / 2, r.y + r.h - 20 - Math.round(u * 2.6), Math.round(u * 1.5), PAL.vangKim, 'center'); if (!c.soon) lines(ctx, c.why, { x: r.x + 10, y: r.y + r.h - 12 - Math.round(u * 1.15 * 2), w: r.w - 20 }, Math.round(u * 1.05), PAL.giayDo, 2); }
        else if (c.why) txt(ctx, c.why, r.x + r.w / 2, r.y + r.h - 12 - Math.round(u * 1.05), Math.round(u * 1.05), PAL.laXanh, 'center');
      });
    }
    function pointer(e) {
      if (e.type === 'move') { hov = L.rects.findIndex(r => inR(r, e.x, e.y)); return; }
      if (e.type === 'down' && inR(backRect(), e.x, e.y)) { back = true; snd('button'); return; }
      if (e.type === 'up') { if (back) { back = false; if (inR(backRect(), e.x, e.y)) go('title'); return; } const i = L.rects.findIndex(r => inR(r, e.x, e.y)); if (i >= 0) pick(i); }
    }
    function key_(e) { if (e.key === 'esc') go('title'); else if (e.key === 'enter' || e.key === 'space') pick(0); }
    return { enter: enter, exit() {}, resize() { key = ''; }, update(dt) { tt += dt; }, draw: draw, pointer: pointer, key: key_ };
  })();

  // ================================================================ START (Khởi đầu + Chiếu)
  const Start = (() => {
    let mode = 'thuong', si = 0, ch = 1, tt = 0, L = null, key = '', btns = Btns(), back = false, drag = null;
    const ids = () => META().STARTS, open = () => TL.Profile.starts(P()), chMax = () => TL.Profile.chieuMax(P());
    function lay() {
      const g = G(), sf = g.safe, k = [g.w, g.h, g.dpr].join();
      if (k === key) return; key = k;
      const X0 = sf.l + 12, X1 = g.w - sf.r - 12, Y0 = sf.t + 54, Y1 = g.h - sf.b - 10, W = X1 - X0, u = base(), gap = 8, n = ids().length;
      const short = g.h < 500, cols = W > 520 ? n : 3, rows = Math.ceil(n / cols), cw = Math.min(150, (W - gap * (cols - 1)) / cols);
      const sh = clamp(Math.round((Y1 - Y0) * (short ? 0.3 : 0.2)), 54, 120), bh = short ? 44 : 52, descH = Math.round(u * 1.2) * 2 + 10, cbh = short ? 38 : 44;
      let y = Y0;
      const rects = ids().map((id, i) => ({ x: Math.round(X0 + (W - cols * cw - (cols - 1) * gap) / 2 + (i % cols) * (cw + gap)), y: Math.round(y + Math.floor(i / cols) * (sh + gap)), w: Math.round(cw), h: sh }));
      y += rows * (sh + gap);
      const descR = { x: X0, y: y, w: W, h: descH }; y += descH + 6;
      const lw = Math.min(W / 6 - 6, 120), ch0 = (W - 6 * lw - 5 * 6) / 2, chRects = [1, 2, 3, 4, 5, 6].map(i => ({ x: Math.round(X0 + ch0 + (i - 1) * (lw + 6)), y: Math.round(y), w: Math.round(lw), h: cbh }));
      y += cbh + 4;
      const chD = { x: X0, y: y, w: W, h: Math.round(u * 1.2) + 6 };
      const bw = Math.min(280, W), go_ = { x: Math.round(g.w / 2 - bw / 2), y: Math.round(Math.min(Y1 - bh, Math.max(y + chD.h + 6, Y1 - bh))), w: Math.round(bw), h: bh };
      L = { u: u, rects: rects, descR: descR, chRects: chRects, chD: chD, go: go_ };
      btns.list = [{ id: 'go', label: MT.go, r: go_ }];
    }
    function enter(a) {
      mode = (a && a.mode) || 'thuong'; tt = 0; key = ''; back = false; btns = Btns();
      const lc = last && !last.daily ? last : null;
      si = Math.max(0, ids().indexOf(lc ? lc.start : 'mac_dinh')); if (!open().includes(ids()[si])) si = 0;
      ch = clamp(lc ? lc.chieu || 1 : chMax(), 1, chMax());
      if (TL.BG) TL.BG.setMood('title'); lay();
    }
    const startOk = i => open().includes(ids()[i]);
    function setSi(i) { i = clamp(i, 0, ids().length - 1); if (i !== si) { si = i; snd('button'); } }
    function setCh(c) { c = clamp(c, 1, 6); if (c <= chMax() && c !== ch) { ch = c; snd('button'); } }
    function start() { if (!startOk(si)) { snd('nope'); return; } begin({ mode: mode, start: ids()[si], chieu: ch }); }
    function draw(ctx) {
      lay(); head(ctx, MT.title, tt); backBtn(ctx, back);
      const u = L.u;
      ids().forEach((id, i) => {
        const r = L.rects[i], ok = startOk(i), q = pop(tt, i), sel = i === si, nm = MM.starts[id][0];
        const rr = { x: r.x, y: r.y - (sel ? 4 : 0), w: r.w, h: r.h };
        if (q < 0.15) return;
        A.panel(ctx, rr, { fill: ok ? PAL.nauCanhGian : PAL.denSon, border: sel ? PAL.vangKim : PAL.nauCanhGian, radius: 5, bw: sel ? 3 : 2 });
        txt(ctx, nm, rr.x + rr.w / 2, rr.y + Math.round(rr.h * 0.3), fit(nm, Math.round(u * 1.5), rr.w - 10, 10), ok ? PAL.vangKim : PAL.giayDo, 'center');
        if (!ok) { fill(ctx, { x: rr.x + 2, y: rr.y + 2, w: rr.w - 4, h: rr.h - 4 }, PAL.denSon, 0.55); txt(ctx, MT.lock, rr.x + rr.w / 2, rr.y + rr.h - Math.round(u * 1.5) - 6, Math.round(u * 1.05), PAL.vangKim, 'center'); }
      });
      const d = startOk(si) ? MM.starts[ids()[si]][1] : MT.lockStart;
      lines(ctx, d, { x: L.descR.x, y: L.descR.y, w: L.descR.w }, Math.round(u * 1.2), PAL.giayDo, 2);
      L.chRects.forEach((r, i) => {
        const c = i + 1, ok = c <= chMax(), lbl = c === 6 ? (r.w < 80 ? 'Trên' : MM.chieu[6]) : String(c);
        A.button(ctx, r, lbl.length > 3 ? fit(lbl, 14, r.w - 8, 9) < 14 ? lbl : lbl : lbl, !ok ? 'disabled' : c === ch ? 'hover' : 'idle');
      });
      txt(ctx, ch <= chMax() ? MM.chieu[ch] + ': ' + MM.chieuDesc[ch] : MT.lockChieu, G().w / 2, L.chD.y, fit(MM.chieu[ch] + ': ' + MM.chieuDesc[ch], Math.round(u * 1.2), G().w - 24, 10), PAL.giayDo, 'center');
      btns.draw(ctx);
    }
    function pointer(e) {
      if (e.type === 'down' && inR(backRect(), e.x, e.y)) { back = true; snd('button'); return; }
      if (e.type === 'up' && back) { back = false; if (inR(backRect(), e.x, e.y)) go('modes'); return; }
      if (e.type === 'down') { drag = { x: e.x, si: si }; }
      if (e.type === 'move' && drag && Math.abs(e.x - drag.x) > 0) { const dx = e.x - drag.x; if (inR({ x: 0, y: L.rects[0].y - 8, w: G().w, h: L.rects[0].h + 16 }, e.x, e.y) && Math.abs(dx) > 70) { setSi(si + (dx < 0 ? 1 : -1)); drag.x = e.x; drag.moved = true; } }
      if (e.type === 'up') {
        const moved = drag && drag.moved; drag = null; if (moved) return;
        const i = L.rects.findIndex(r => inR(r, e.x, e.y)); if (i >= 0) { setSi(i); return; }
        const c = L.chRects.findIndex(r => inR(r, e.x, e.y)); if (c >= 0) { setCh(c + 1); return; }
      }
      btns.pointer(e, id => { if (id === 'go') start(); });
    }
    function key_(e) { const k = e.key; if (k === 'left') setSi(si - 1); else if (k === 'right') setSi(si + 1); else if (k === 'up') setCh(ch + 1); else if (k === 'down') setCh(ch - 1); else if (k === 'enter' || k === 'space') start(); else if (k === 'esc') go('modes'); }
    return { enter: enter, exit() {}, resize() { key = ''; }, update(dt) { tt += dt; lay(); }, draw: draw, pointer: pointer, key: key_ };
  })();

  // ================================================================ CÂY MAI
  const Mai = (() => {
    let L = null, key = '', tt = 0, sel = null, back = false, btns = Btns(), note = '';
    const tree = () => META().TREE, byId = id => tree().find(n => n.id === id);
    const BR = ['noi_dung', 'khoi_dau', 'tien_ich'];
    function place() {   // lane/depth of every node inside its branch; a child takes its parent's lane when free, else the next free one
      const pos = {};
      BR.forEach(br => {
        const used = {};
        tree().filter(n => n.br === br).forEach(n => {
          const depth = n.req ? pos[n.req].depth + 1 : 0; let lane = n.req ? pos[n.req].lane : 0;
          while (used[depth + ':' + lane]) lane++;
          used[depth + ':' + lane] = true; pos[n.id] = { lane: lane, depth: depth };
        });
        pos['_' + br] = Math.max.apply(null, tree().filter(n => n.br === br).map(n => pos[n.id].lane)) + 1;
      });
      return pos;
    }
    function lay() {
      const g = G(), sf = g.safe, k = [g.w, g.h, g.dpr, sel].join();
      if (k === key) return; key = k;
      const X0 = sf.l + 10, X1 = g.w - sf.r - 10, Y0 = sf.t + 98, Y1 = g.h - sf.b - 10, W = X1 - X0, u = base(), short = g.h < 500;
      const pH = short ? 70 : 108, avail = Y1 - Y0 - pH - 8, pos = place(), maxD = 3, bw = W / 3;
      const nr = clamp(Math.min(bw / 4.4, avail / (maxD * 2.4)), 16, 30), th = Math.min(avail, Math.round(nr * 2 + (maxD - 1) * nr * 2.9)), tree0 = { x: X0, y: Y0 + Math.round((avail - th) / 2), w: W, h: th }, nodes = {};
      tree().forEach(n => {
        const b = BR.indexOf(n.br), q = pos[n.id], lanes = pos['_' + n.br], lw = (bw - 8) / lanes;
        nodes[n.id] = { x: Math.round(X0 + b * bw + 4 + lw * (q.lane + 0.5)), y: Math.round(tree0.y + tree0.h - nr - q.depth * ((tree0.h - nr * 2) / (maxD - 1))), r: nr };
      });
      const panel = { x: X0, y: Y1 - pH, w: W, h: pH }, pb = { x: panel.x + panel.w - 118, y: panel.y + panel.h - 46, w: 108, h: 38 };
      L = { u: u, tree: tree0, nodes: nodes, bw: bw, X0: X0, panel: panel, pb: pb, short: short };
      btns.list = sel ? [{ id: 'buy', label: MT.mai.buy, r: pb, on: TL.Profile.canBuy(P(), sel).ok }] : [];
    }
    function enter() { if (TL.BG) TL.BG.setMood('title'); tt = 0; key = ''; sel = null; back = false; btns = Btns(); note = ''; lay(); }
    function buy() {
      if (!sel) return; const p = P(), r = TL.Profile.buy(p, sel);
      if (!r.ok) { snd('nope'); return; }
      TL.Profile.save(p); snd('gong', { vol: 0.7 }); const nd = L.nodes[sel]; FX.confetti(nd.x, nd.y, 18); key = '';
    }
    function blossom(ctx, x, y, r, k) {
      ctx.fillStyle = PAL.giayDo; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 0.55 * k, y + Math.sin(a) * r * 0.55 * k, r * 0.5 * k, 0, 7); ctx.fill(); }
      ctx.fillStyle = PAL.vangKim; ctx.beginPath(); ctx.arc(x, y, r * 0.3 * k, 0, 7); ctx.fill();
    }
    function draw(ctx) {
      lay(); const p = P(), lv = TL.Profile.level(p.xp), u = L.u, g = G();
      head(ctx, MT.mai.title, tt); backBtn(ctx, back);
      txt(ctx, MT.mai.have.replace('%d', TL.Profile.mai(p)) + '   ' + MT.mai.lvl.replace('%d', lv.level), g.w / 2, g.safe.t + 10 + Math.round(clamp(g.h / 12, 20, 40) * 1.2), Math.round(u * 1.2), PAL.giayDo, 'center');
      // trunk + branches
      ctx.save(); ctx.lineCap = 'butt'; ctx.strokeStyle = PAL.nauCanhGian; ctx.lineWidth = 6;
      BR.forEach((br, b) => {
        const bx = L.X0 + b * L.bw + L.bw / 2, by = L.tree.y + L.tree.h;
        ctx.beginPath(); ctx.moveTo(bx, by + 6); ctx.lineTo(bx, by - 2); ctx.stroke();
        tree().filter(n => n.br === br).forEach(n => { const a = L.nodes[n.id], q = n.req ? L.nodes[n.req] : { x: bx, y: by }; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x, a.y); ctx.lineTo(a.x, a.y); ctx.stroke(); });
        txt(ctx, MM.br[br], bx, L.tree.y - Math.round(u * 1.4) - 2, Math.round(u * 1.1), PAL.vangKim, 'center');
      });
      ctx.restore();
      tree().forEach((n, i) => {
        const a = L.nodes[n.id], q = pop(tt, i * 0.5), own = !!p.nodes[n.id], cb = TL.Profile.canBuy(p, n.id), s = q;
        if (s <= 0.02) return; const r = a.r * s;
        if (n.id === sel) { ctx.strokeStyle = PAL.vangKim; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(a.x, a.y, r + 5, 0, 7); ctx.stroke(); }
        if (own) blossom(ctx, a.x, a.y, r * 1.15, 1);
        else {
          ctx.fillStyle = cb.ok ? PAL.doSon : PAL.denSon; ctx.beginPath(); ctx.arc(a.x, a.y, r, 0, 7); ctx.fill(); ctx.strokeStyle = cb.ok ? PAL.vangKim : PAL.nauCanhGian; ctx.lineWidth = 3; ctx.stroke();
          txt(ctx, String(n.cost), a.x, a.y - Math.round(u * 0.65), Math.round(u * 1.3), cb.ok ? PAL.giayDo : PAL.nauCanhGian, 'center');
        }
      });
      const P_ = L.panel; A.panel(ctx, P_, { fill: PAL.nauCanhGian, border: PAL.vangKim, radius: 5 });
      if (sel) {
        const n = byId(sel), nm = MM.nodes[sel], cb = TL.Profile.canBuy(p, sel), own = !!p.nodes[sel];
        txt(ctx, nm[0], P_.x + 12, P_.y + 8, Math.round(u * 1.5), PAL.vangKim, 'left');
        lines(ctx, nm[1], { x: P_.x + 12 + (P_.w - 140) / 2, y: P_.y + 8 + Math.round(u * 1.9), w: P_.w - 150 }, Math.round(u * 1.05), PAL.giayDo, 2);
        const st = own ? MT.mai.owned : cb.ok ? MT.mai.cost.replace('%d', n.cost) : cb.why === 'req' ? MT.mai.need : MT.mai.poor;
        txt(ctx, st, P_.x + P_.w - 14, P_.y + 8, Math.round(u * 1.1), cb.ok ? PAL.laXanh : PAL.giayDo, 'right');
        if (!own) btns.draw(ctx);
      } else txt(ctx, MT.hint2 || 'Chạm một nút để xem.', P_.x + P_.w / 2, P_.y + P_.h / 2 - Math.round(u * 0.6), Math.round(u * 1.1), PAL.giayDo, 'center');
    }
    function pointer(e) {
      if (e.type === 'down' && inR(backRect(), e.x, e.y)) { back = true; snd('button'); return; }
      if (e.type === 'up' && back) { back = false; if (inR(backRect(), e.x, e.y)) go('title'); return; }
      if (btns.pointer(e, id => { if (id === 'buy') buy(); })) return;
      if (e.type === 'up') { const hit = tree().find(n => { const a = L.nodes[n.id]; return (e.x - a.x) * (e.x - a.x) + (e.y - a.y) * (e.y - a.y) <= (a.r + 8) * (a.r + 8); }); if (hit) { sel = hit.id; key = ''; snd('button'); } }
    }
    function key_(e) { if (e.key === 'esc') go('title'); else if ((e.key === 'enter' || e.key === 'space') && sel) buy(); }
    return { enter: enter, exit() {}, resize() { key = ''; }, update(dt) { tt += dt; lay(); }, draw: draw, pointer: pointer, key: key_ };
  })();

  Object.assign(TL.Screens, { modes: Modes, start: Start, mai: Mai });
})(globalThis.TL = globalThis.TL || {});
