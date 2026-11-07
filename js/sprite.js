/* js/sprite.js  (owner FX) springy card sprites. Needs TL.CFG and TL.FX; call FX.update(dt) every frame too (tweens/timers).
 *   Sprite.create({tex, x, y, scale}) -> s {T, V, selected, hover, ptr, sway, dead, tex, scale}  T/V = {x,y,rot,sx,sy}
 *   s.update(dt) / s.draw(ctx)        spring V->T, lean, hover tilt, sway, lift, shadow, flip, juice, dissolve
 *   s.hit(x, y) -> bool               point in the visual card (rotated, incl. lift)
 *   s.juice(a)  s.flip(tex, delay)    wobble / width-squash flip to a new texture
 *   s.moveTo(x, y, dur, rot, delay)   tween T (dur/speed); V springs after it
 *   s.deal(from{x,y}, delay, faceTex) fly from `from` to the current T with a flip; call after Sprite.fan
 *   s.dissolve(dur, onDone)           per-art-pixel noise burn (vang kim then do son edge); sets dead when done
 *   Sprite.fan(list, rect, {overlap, curve, dur})  arc layout in rect (overlaps when crowded); dur>0 tweens instead of snapping
 *   Sprite.hover(list, x, y) -> s|null  sets hover + ptr on the top card under the pointer (no x = clear all)
 *   Sprite.pick(list, x, y) -> s|null  top card under the point (hovered first, then last-drawn first)
 *   Sprite.drawAll(ctx, list)         draw list in order, hovered card last
 * Units: px = CSS px; one art pixel = s.scale / dpr px. Reduced motion (FX.reducedMotion) removes sway and tilt.
 */
(function (TL) {
  'use strict';
  const CFG = TL.CFG, M = CFG.MOTION, PAL = CFG.PAL, FX = TL.FX;
  const TAU = Math.PI * 2, RAD = Math.PI / 180;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const hasDoc = typeof document !== 'undefined';

  // ---------- dissolve (fixed noise threshold map, per art pixel) ----------
  const noiseCache = {};
  function noiseMap(w, h) {
    const key = w + 'x' + h;
    if (noiseCache[key]) return noiseCache[key];
    const rng = TL.makeRng(0x5EED1E57), cell = 6, g = M.dissolve.grain || 2;
    const gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2, coarse = [];
    for (let i = 0; i < gw * gh; i++) coarse.push(rng());
    const fw = Math.ceil(w / g), fh = Math.ceil(h / g), fine = [];
    for (let i = 0; i < fw * fh; i++) fine.push(rng());
    const raw = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const fx = x / cell, fy = y / cell, ix = Math.floor(fx), iy = Math.floor(fy);
      let tx = fx - ix, ty = fy - iy; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      const a = coarse[iy * gw + ix], b = coarse[iy * gw + ix + 1], c = coarse[(iy + 1) * gw + ix], d = coarse[(iy + 1) * gw + ix + 1];
      const cv = (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
      raw[y * w + x] = 0.65 * cv + 0.35 * fine[Math.floor(y / g) * fw + Math.floor(x / g)];
    }
    const idx = Array.from({ length: w * h }, (_, i) => i).sort((p, q) => raw[p] - raw[q]);
    const thr = new Float32Array(w * h);
    for (let k = 0; k < idx.length; k++) thr[idx[k]] = (k + 0.5) / idx.length;   // uniform 0..1, so progress = fraction burned
    return (noiseCache[key] = thr);
  }
  const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  function makeDissolver(tex) {
    if (!hasDoc || !tex) return null;
    const w = tex.width, h = tex.height;
    let data;
    try {
      const src = document.createElement('canvas'); src.width = w; src.height = h;
      const sg = src.getContext('2d'); sg.drawImage(tex, 0, 0);
      data = sg.getImageData(0, 0, w, h).data;
    } catch (e) { return null; }
    const out = document.createElement('canvas'); out.width = w; out.height = h;
    const og = out.getContext('2d'), img = og.createImageData(w, h), thr = noiseMap(w, h);
    const gold = rgb(PAL.vangKim), red = rgb(PAL.doSon), E = M.dissolve.edge;
    let last = -1;
    return {
      canvas: out,
      render(p) {
        if (p === last) return; last = p;
        const cut = p * (1 + E), o = img.data;
        for (let i = 0, n = w * h; i < n; i++) {
          const j = i * 4, t = thr[i];
          if (data[j + 3] === 0 || t <= cut - E) { o[j + 3] = 0; continue; }
          if (t > cut) { o[j] = data[j]; o[j + 1] = data[j + 1]; o[j + 2] = data[j + 2]; o[j + 3] = data[j + 3]; continue; }
          const c = t > cut - E * 0.5 ? gold : red;       // solid -> vang kim -> do son -> gone
          o[j] = c[0]; o[j + 1] = c[1]; o[j + 2] = c[2]; o[j + 3] = 255;
        }
        og.putImageData(img, 0, 0);
      },
    };
  }

  // ---------- shadow silhouettes (cached per texture) ----------
  const silo = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function silhouette(src) {
    if (!hasDoc || !src) return null;
    let c = silo && silo.get(src);
    if (c) return c;
    c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const g = c.getContext('2d'); g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
    if (silo) silo.set(src, c);
    return c;
  }

  // ---------- sprite ----------
  const spr = (v) => ({ x: v, v: 0 });
  function create(o) {
    o = o || {};
    const x = o.x || 0, y = o.y || 0;
    const s = {
      tex: o.tex || null, scale: o.scale || (TL.Game && TL.Game.scale) || 2,
      T: { x: x, y: y, rot: 0, sx: 1, sy: 1 }, V: { x: x, y: y, rot: 0, sx: 1, sy: 1 },
      selected: false, hover: false, ptr: null, sway: true, phase: 0, dead: false, fx: 1, dp: 0, dis: null,
      _sp: { x: spr(x), y: spr(y), rot: spr(0), sx: spr(1), sy: spr(1) },
      _hs: spr(1), _lf: spr(0), _tx: spr(0), _ty: spr(0), _dpr: (TL.Game && TL.Game.dpr) || 1, _sel: false, _dp: -1,
    };
    return Object.assign(s, methods);
  }
  const methods = {
    unit() { return this.scale / this._dpr; },
    size() { const t = this.tex || { width: 48, height: 64 }, u = this.unit(); return { w: t.width * u, h: t.height * u }; },
    update(dt) {
      if (!(dt > 0)) return;
      dt = Math.min(dt, 0.1);
      const k = M.spring, st = this._sp, T = this.T, V = this.V;
      for (const c of ['x', 'y', 'rot', 'sx', 'sy']) { FX.springStep(st[c], T[c], dt, k.freq, k.zeta); V[c] = st[c].x; }
      const H = M.hover, on = this.hover && !this.dead;
      FX.springStep(this._hs, on ? H.scale : 1, dt, k.freq, H.zeta);
      FX.springStep(this._lf, this.selected ? 1 : 0, dt, k.freq, 0.6);
      let tx = 0, ty = 0;
      if (on && this.ptr && !FX.reducedMotion) {
        const sz = this.size();
        tx = clamp((this.ptr.x - V.x) / (sz.w / 2), -1, 1); ty = clamp((this.ptr.y - V.y) / (sz.h / 2), -1, 1);
      }
      FX.springStep(this._tx, tx, dt, k.freq, 0.7); FX.springStep(this._ty, ty, dt, k.freq, 0.7);
      if (this.selected !== this._sel) { if (this.selected) this.juice(0.6); this._sel = this.selected; }
    },
    draw(ctx) {
      if (this.dead || !this.tex) return;
      const dpr = ctx.getTransform().a || 1; this._dpr = dpr;
      const u = this.scale / dpr, tex = this.tex, w = tex.width * u, h = tex.height * u;
      const V = this.V, st = this._sp, hs = this._hs.x, H = M.hover;
      const hk = clamp((hs - 1) / (H.scale - 1), 0, 1.4), lk = this._lf.x, lift = lk * M.lift;
      const j = FX.juiceOf(this);
      const lean = clamp(st.x.v * M.lean.perVel, -M.lean.max, M.lean.max);
      const sw = FX.reducedMotion || !this.sway ? 0 : 1 - clamp(hk, 0, 1);
      const ph = TAU * M.sway.speed * FX.time + this.phase;
      const oy = Math.sin(ph) * M.sway.amp * sw, rot = (V.rot + lean + Math.cos(ph) * M.sway.rot * sw + j.r) * RAD;
      const sxT = V.sx * hs * j.s, syT = V.sy * hs * j.s;
      let src = tex;
      if (this.dis) { this.dis.render(this.dp); src = this.dis.canvas; }
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      // flat offset shadow on the ground; the card rises away from it
      const off = u * 2 * (1 + (H.shadow - 1) * hk) + lk * lift * 0.0;
      ctx.save();
      ctx.globalAlpha = 0.4 * (this.dis ? 1 - this.dp : 1);
      ctx.translate(V.x + off * 0.5, V.y + oy + off); ctx.rotate(rot); ctx.scale(sxT * this.fx, syT);
      const sil = silhouette(src);
      if (sil) ctx.drawImage(sil, -w / 2, -h / 2, w, h); else { ctx.fillStyle = '#000'; ctx.fillRect(-w / 2, -h / 2, w, h); }
      ctx.restore();
      // card with pseudo-3D tilt toward the pointer
      ctx.translate(V.x, V.y + oy - lift); ctx.rotate(rot);
      if (!FX.reducedMotion) {
        const ay = this._tx.x * H.tilt * RAD, ax = -this._ty.x * H.tilt * RAD;
        ctx.transform(Math.cos(ay), Math.sin(ay) * 0.14, -Math.sin(ax) * 0.14, Math.cos(ax), 0, 0);
      }
      ctx.scale(sxT * this.fx, syT);
      ctx.drawImage(src, -w / 2, -h / 2, w, h);
      ctx.restore();
    },
    hit(x, y) {
      if (this.dead || !this.tex) return false;
      const V = this.V, sz = this.size(), a = -V.rot * RAD;
      const dx = x - V.x, dy = y - (V.y - this._lf.x * M.lift);
      const rx = dx * Math.cos(a) - dy * Math.sin(a), ry = dx * Math.sin(a) + dy * Math.cos(a);
      return Math.abs(rx) <= sz.w * V.sx * this._hs.x / 2 && Math.abs(ry) <= sz.h * V.sy * this._hs.x / 2;
    },
    juice(a) { FX.juice(this, a == null ? 1 : a); },
    flip(tex, delay) {
      const half = M.deal.flip / 2;
      FX.tween(this, { fx: 0 }, half, 'inout', {
        delay: delay || 0,
        onDone: () => { this.tex = tex; FX.tween(this, { fx: 1 }, half, 'inout'); },
      });
    },
    moveTo(x, y, dur, rot, delay) {
      const p = { x: x, y: y };
      if (rot != null) p.rot = rot;
      FX.tween(this.T, p, dur == null ? M.play.fly : dur, 'out', { delay: delay || 0 });
    },
    deal(from, delay, faceTex) {
      const T = this.T, fin = { x: T.x, y: T.y, rot: T.rot }, st = this._sp;
      const r0 = (Math.random() * 2 - 1) * 6;
      T.x = from.x; T.y = from.y; T.rot = r0;
      st.x.x = from.x; st.y.x = from.y; st.rot.x = r0; st.x.v = st.y.v = st.rot.v = 0;
      this.V.x = from.x; this.V.y = from.y; this.V.rot = r0;
      this.sway = false;
      FX.after(delay || 0, () => {
        this.moveTo(fin.x, fin.y, M.deal.fly, fin.rot);
        if (faceTex) this.flip(faceTex, Math.max(0, (M.deal.fly - M.deal.flip) / 2));
        FX.after(M.deal.fly, () => { this.sway = true; });
      });
    },
    dissolve(dur, onDone) {
      this.selected = false; this.hover = false;
      this.dis = makeDissolver(this.tex); this.dp = 0;
      FX.tween(this, { dp: 1 }, dur == null ? M.dissolve.dur : dur, 'linear', {
        onDone: () => { this.dead = true; if (onDone) onDone(this); },
      });
    },
  };

  // ---------- list helpers ----------
  function fan(list, rect, o) {
    o = o || {};
    const n = list.length;
    if (!n) return;
    const overlap = o.overlap != null ? o.overlap : CFG.LAYOUT.handOverlap, curve = o.curve != null ? o.curve : 1;
    const sz = list[0].size(), cw = sz.w, ch = sz.h;
    const pref = cw * (1 - overlap);
    let sp = 0;
    if (n > 1) sp = (n - 1) * pref + cw <= rect.w ? pref : Math.max(cw * 0.1, (rect.w - cw) / (n - 1));
    const x0 = rect.x + rect.w / 2 - (sp * (n - 1)) / 2, cy = rect.y + rect.h / 2;
    const spread = clamp(0.5 * (n - 1), 0, 4.5) * curve;
    list.forEach((s, i) => {
      const u = n > 1 ? (i - (n - 1) / 2) / ((n - 1) / 2) : 0;
      const x = x0 + i * sp, y = cy + curve * ch * 0.08 * u * u, rot = u * spread;
      s.phase = i * M.sway.phase;
      if (o.dur > 0) s.moveTo(x, y, o.dur, rot);
      else { s.T.x = x; s.T.y = y; s.T.rot = rot; }
    });
  }
  function pick(list, x, y) {
    for (const s of list) if (s.hover && s.hit(x, y)) return s;
    for (let i = list.length - 1; i >= 0; i--) if (list[i].hit(x, y)) return list[i];
    return null;
  }
  function hover(list, x, y) {
    const hit = x == null ? null : pick(list, x, y);
    for (const s of list) { s.hover = s === hit; if (s.hover) s.ptr = { x: x, y: y }; }
    return hit;
  }
  function drawAll(ctx, list) {
    for (const s of list) if (!s.hover) s.draw(ctx);
    for (const s of list) if (s.hover) s.draw(ctx);
  }

  TL.Sprite = { create: create, fan: fan, pick: pick, hover: hover, drawAll: drawAll };
})(globalThis.TL = globalThis.TL || {});
