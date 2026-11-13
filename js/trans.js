/* js/trans.js  (owner SCREENS) shared screen transitions. Needs config, art, fx. No logic state outside the transition itself.
 * API  TL.Trans.go(name, args?, kind?)  kind 'lac' (lacquer dither sweep, default) | 'bai' (card backs fly over the screen, then away) | 'an' (boss seal: dark fade + stamp ring)
 *      TL.Trans.busy() -> bool (input is ignored while true)   TL.Trans.update(dt)   TL.Trans.draw(ctx)
 * Time CFG.TRANS.cover + CFG.TRANS.reveal (350-700 ms total), easing outExpo (cover) and outBack (cards); the screen switches when the cover is full.
 * ?auto and reducedMotion: no sweep, plain fast fade (reducedMotion) or immediate switch (?auto).
 */
(function (TL) {
  'use strict';
  const CFG = TL.CFG, PAL = CFG.PAL;
  CFG.TRANS = { cover: 0.3, reveal: 0.32, reduced: 0.18, cols: 12 };
  const outExpo = t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  let st = null;
  const G = () => TL.Game;

  function go(name, args, kind) {
    const g = G();
    if (st) return;
    if (g.flags.auto || !g.ctx) { g.setScreen(name, args); return; }
    const red = !!(g.settings && g.settings.reducedMotion);
    st = { name: name, args: args, kind: red ? 'fade' : (kind || 'lac'), t: 0, done: false, cover: red ? CFG.TRANS.reduced : CFG.TRANS.cover, reveal: red ? CFG.TRANS.reduced : CFG.TRANS.reveal };
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
    } else {   // 'lac': lacquer columns with a dithered leading edge
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
