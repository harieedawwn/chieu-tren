/* js/trans.js  (owner SCREENS) shared screen transitions. Needs config, art, fx. No logic state outside the transition itself.
 * API  TL.Trans.go(name, args?, kind?)  kind 'chieu' (trải chiếu: a cói roll sweeps left->right unrolling a chiếu hoa over the screen, a second roll follows rolling it up; default) | 'lac' (lacquer dither sweep) | 'bai' (card backs fly over the screen, then away) | 'an' (boss seal: dark fade + stamp ring)
 *      TL.Trans.busy() -> bool (input is ignored while true)   TL.Trans.update(dt)   TL.Trans.draw(ctx)
 * Time CFG.TRANS.cover + CFG.TRANS.reveal (350-700 ms total), easing outExpo (cover) and outBack (cards); the screen switches when the cover is full.
 * ?auto and reducedMotion: no sweep, plain fast fade (reducedMotion) or immediate switch (?auto).
 */
(function (TL) {
  'use strict';
  const CFG = TL.CFG, PAL = CFG.PAL;
  CFG.TRANS = { cover: 0.36, reveal: 0.34, reduced: 0.18, cols: 12 };
  const outExpo = t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  let st = null;
  const G = () => TL.Game;

  function go(name, args, kind) {
    const g = G();
    if (st) return;
    if (g.flags.auto || !g.ctx) { g.setScreen(name, args); return; }
    const red = !!(g.settings && g.settings.reducedMotion);
    st = { name: name, args: args, kind: red ? 'fade' : (kind || 'chieu'), t: 0, done: false, cover: red ? CFG.TRANS.reduced : CFG.TRANS.cover, reveal: red ? CFG.TRANS.reduced : CFG.TRANS.reveal };
    try { TL.Audio && TL.Audio.play(st.kind === 'bai' ? 'shuffle' : 'button', { vol: 0.5 }); } catch (e) {}
  }
  function update(dt) {
    if (!st) return;
    st.t += dt;
    if (!st.done && st.t >= st.cover) { st.done = true; const s = st; G().setScreen(s.name, s.args); }
    if (st && st.t >= st.cover + st.reveal) st = null;
  }
  // p = cover amount 0..1 (1 = screen fully hidden)
  function amount() { return st.t < st.cover ? clamp(st.t / st.cover, 0, 1) : 1 - clamp((st.t - st.cover) / st.reveal, 0, 1); }
  // ---- 'chieu': a rolled cói mat sweeps left -> right, unrolling a patterned mat over the old screen, then a second roll
  // follows and rolls it back up, revealing the new screen. Mat face, roll face and shadow are cached bitmaps (R3).
  const inOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const MC = { key: '', mat: null, roll: null, shade: null, R: 0 };
  function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; }
  function buildChieu(w, h) {
    const key = w + 'x' + h; if (MC.key === key) return MC;
    const u = Math.max(2, Math.min(5, Math.round(Math.min(w, h) / 110))), B = u * 4;
    const LIGHT = '#E8C886', MID = PAL.vangKim, DARK = '#A97A30', LINE = 'rgba(74,36,24,0.35)';
    const [mat, m] = mkCanvas(w, h);
    // basket weave: 4-strand blocks alternate horizontal / vertical
    for (let by = 0; by * B < h; by++) for (let bx = 0; bx * B < w; bx++) {
      const x0 = bx * B, y0 = by * B, hor = (bx + by) % 2 === 0;
      for (let i = 0; i < 4; i++) {
        m.fillStyle = i % 2 ? MID : LIGHT;
        if (hor) m.fillRect(x0, y0 + i * u, B, u); else m.fillRect(x0 + i * u, y0, u, B);
      }
      m.fillStyle = DARK; if (hor) m.fillRect(x0 + B - 1, y0, 1, B); else m.fillRect(x0, y0 + B - 1, B, 1);
    }
    m.fillStyle = LINE; for (let y = 0; y < h; y += B * 2) m.fillRect(0, y, w, 1);
    // chiếu hoa border: red bands with a gold zig-zag and green piping, top and bottom
    const band = (y) => {
      const bh = u * 6;
      m.fillStyle = PAL.laXanh; m.fillRect(0, y - u, w, u); m.fillRect(0, y + bh, w, u);
      m.fillStyle = PAL.doSon; m.fillRect(0, y, w, bh);
      m.fillStyle = PAL.vangKim;
      for (let x = 0; x < w; x += u * 6) for (let i = 0; i < 3; i++) { m.fillRect(x + i * u, y + u + i * u, u, u); m.fillRect(x + (5 - i) * u, y + u + i * u, u, u); }
      for (let x = u * 3; x < w; x += u * 6) m.fillRect(x - u, y + bh - 2 * u, u * 3, u);
    };
    const inset = Math.round(Math.min(h * 0.09, u * 12)); band(inset); band(h - inset - u * 6);
    // centre medallion: red lozenge with gold rim and the game name
    const cx = Math.round(w / 2), cy = Math.round(h / 2), R = Math.round(Math.min(w, h) * 0.2);
    const loz = (r, col) => { m.fillStyle = col; for (let dy = -r; dy <= r; dy += u) { const hw = r - Math.abs(dy); m.fillRect(cx - hw, cy + dy, hw * 2 + u, u); } };
    loz(R + u * 3, PAL.nauCanhGian); loz(R + u * 2, PAL.vangKim); loz(R, PAL.doSon); loz(Math.round(R * 0.82), PAL.nauCanhGian); loz(Math.round(R * 0.82) - u, PAL.doSon);
    m.fillStyle = PAL.vangKim; for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) m.fillRect(cx + dx * (R + u * 6) - u, cy + dy * (R + u * 6) - u, u * 3, u * 3);
    try {
      const A = TL.Art; let sz = Math.max(10, Math.round(R * 0.4));
      while (sz > 10 && A.textWidth('Chiếu Trên', sz) > R * 1.4) sz--;
      A.textC(m, 'Chiếu Trên', cx, cy, { size: sz, color: PAL.vangKim, outline: PAL.denSon, align: 'center' });
    } catch (e) {}
    // roll face: a vertical cylinder in hard pixel bands (dark rim, straw body, highlight), with spiral seam ticks
    const RR = Math.max(18, Math.round(Math.min(w, h) * 0.07)), rw = RR * 2;
    const [roll, r] = mkCanvas(rw, h);
    const bands = [[0, 0.08, PAL.nauCanhGian], [0.08, 0.2, DARK], [0.2, 0.42, MID], [0.42, 0.58, LIGHT], [0.58, 0.66, '#F4E2B0'], [0.66, 0.84, MID], [0.84, 0.93, DARK], [0.93, 1, PAL.nauCanhGian]];
    for (const [a, b, c] of bands) { r.fillStyle = c; r.fillRect(Math.round(a * rw), 0, Math.ceil((b - a) * rw), h); }
    r.fillStyle = 'rgba(74,36,24,0.45)'; for (let y = 0; y < h; y += u * 3) r.fillRect(Math.round(rw * 0.12), y, Math.round(rw * 0.76), 1);
    r.fillStyle = PAL.doSon; for (const y of [inset, h - inset - u * 6]) r.fillRect(0, y, rw, u * 6);
    r.fillStyle = PAL.vangKim; for (const y of [inset, h - inset - u * 6]) { r.fillRect(0, y + u * 2, rw, u); r.fillRect(0, y + u * 4, rw, u); }
    // soft shadow the roll casts ahead of it (stepped alpha so it stays crisp)
    const sw = RR * 2; const [shade, sx] = mkCanvas(sw, 1);
    for (let i = 0; i < 6; i++) { sx.fillStyle = 'rgba(27,20,18,' + (0.42 * (1 - i / 6)).toFixed(3) + ')'; sx.fillRect(Math.round(i * sw / 6), 0, Math.ceil(sw / 6), 1); }
    MC.key = key; MC.mat = mat; MC.roll = roll; MC.shade = shade; MC.R = RR;
    return MC;
  }
  function drawChieu(ctx, w, h, covering, p) {
    const C = buildChieu(w, h), R0 = C.R;
    // covering: roll travels left -> right, mat laid on [0, x], roll thins as it unrolls
    // revealing: a fresh roll enters at the left and travels right, rolling the mat up; mat stays on [x, w], roll fattens
    const e = inOut(covering ? p : 1 - p), R = Math.max(4, Math.round(R0 * (covering ? 1 - 0.55 * e : 0.45 + 0.55 * e)));
    const x = Math.round(-R0 + (w + R0 * 2) * e);
    if (covering) {
      if (x > 0) ctx.drawImage(C.mat, 0, 0, Math.min(w, x), h, 0, 0, Math.min(w, x), h);
      if (x + R < w) ctx.drawImage(C.shade, x + R, 0, R * 2, h);
    } else {
      if (x < w) { const a = Math.max(0, x); ctx.drawImage(C.mat, a, 0, w - a, h, a, 0, w - a, h); }
      if (x - R > 0) { ctx.save(); ctx.scale(-1, 1); ctx.drawImage(C.shade, -(x - R), 0, R * 2, h); ctx.restore(); }
    }
    ctx.drawImage(C.roll, x - R, 0, R * 2, h);
  }
  function draw(ctx) {
    if (!st) return;
    const g = G(), w = g.w, h = g.h, covering = st.t < st.cover, p = amount(), k = st.kind;
    ctx.save(); ctx.imageSmoothingEnabled = false;
    if (k === 'fade') { ctx.globalAlpha = p; ctx.fillStyle = PAL.denSon; ctx.fillRect(0, 0, w, h); }
    else if (k === 'an') {
      ctx.globalAlpha = Math.min(1, p * 1.2); ctx.fillStyle = PAL.denSon; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1;
      const r = Math.min(w, h) * 0.22 * outExpo(p); ctx.strokeStyle = PAL.vangKim; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(w / 2, h / 2, Math.max(1, r), 0, Math.PI * 2); ctx.stroke();
    } else if (k === 'bai') {
      const back = TL.Art && TL.Art.back && TL.Art.back(), n = 8, cw = Math.ceil(w / n) + 8, ch = Math.ceil(cw * 1.35);
      ctx.fillStyle = PAL.denSon; ctx.globalAlpha = p * 0.85; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1;
      for (let r = 0; r < Math.ceil(h / ch) + 1; r++) for (let c = 0; c < n; c++) {
        const d = (c / n) * 0.5 + (r % 2) * 0.1, q = clamp((p - d) / 0.5, 0, 1), ox = (covering ? -1 : 1) * (1 - outExpo(q)) * w * 0.6;
        if (q <= 0) continue;
        const x = Math.round(c * (cw - 8) + (covering ? ox : -ox)), y = r * ch - 10;
        if (back) ctx.drawImage(back, x, y, cw, ch); else { ctx.fillStyle = PAL.doSon; ctx.fillRect(x, y, cw - 2, ch - 2); }
      }
    } else if (k === 'chieu') { drawChieu(ctx, w, h, covering, p);     } else {   // 'lac': lacquer columns with a dithered leading edge
      const n = CFG.TRANS.cols, cw = Math.ceil(w / n);
      for (let c = 0; c < n; c++) {
        const d = covering ? c / n : (n - 1 - c) / n, q = outExpo(clamp((p - d * 0.45) / 0.55, 0, 1)), hh = Math.round(h * q);
        if (hh <= 0) continue;
        ctx.fillStyle = c % 2 ? PAL.denSon : PAL.nauCanhGian; ctx.fillRect(c * cw, 0, cw + 1, hh);
        ctx.fillStyle = PAL.doSon; for (let x = 0; x < cw; x += 8) ctx.fillRect(c * cw + x + (c % 2) * 4, hh, 4, 4);
        ctx.fillStyle = PAL.vangKim; ctx.fillRect(c * cw, Math.max(0, hh - 3), cw + 1, 3);
      }
    }
    ctx.restore();
  }
  TL.Trans = { go: go, busy: () => !!st, update: update, draw: draw };
})(globalThis.TL = globalThis.TL || {});
