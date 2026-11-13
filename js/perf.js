/* js/perf.js  frame-time meter + adaptive quality. Loads before main.js. No DOM at load.
 * API  TL.Perf
 *   mode 'auto'|'high'|'low'   (Game.settings.perf)   tier 0 cao | 1 vừa | 2 thấp (what the rest of the game reads)
 *   sample(rawDtSeconds)       call once per frame with the unclamped frame time; updates stats and, in auto mode, the tier
 *   stats() -> {fps, p50, p95, max, w95, tier, n}   frame interval ms over the last ~2 s; w95 = p95 of the JS frame-body cost (work())
 *   work(ms)                   main.js reports how long update+draw took
 *   setMode(m)                 apply a setting; fixes the tier unless 'auto'
 *   draw(ctx, w, h)            small overlay (only with ?perf)
 *   particleCap(kind) -> max live particles for 'confetti'|'flame' at this tier
 *   window.__perf = {stats, tier, log[]}   log keeps tier changes; peakParticles tracks the largest live count a frame saw
 * Rules: tier drops when p95 > 22 ms for 2 s; rises again after 10 s with p95 < 15 ms. Tier effects: FX.quality (particles, shake), BG.setQuality (resolution, 30 fps).
 */
(function (TL) {
  'use strict';
  const CAP = { confetti: [500, 220, 90], flame: [400, 160, 60] };
  const Perf = TL.Perf = {
    mode: 'auto', tier: 0, on: false, log: [], peakParticles: 0, ring: new Float32Array(120), wr: new Float32Array(120), wi: 0, wn: 0, n: 0, i: 0, badT: 0, goodT: 0, t: 0, _s: null,
    dprCap() { return [2, 2, 1.5][Perf.tier]; },   // canvas backing-store ceiling per tier
    particleCap(kind) { return CAP[kind][Perf.tier]; },
    setMode(m) {
      Perf.mode = m === 'high' || m === 'low' ? m : 'auto';
      if (Perf.mode === 'high') setTier(0, 'mode'); else if (Perf.mode === 'low') setTier(2, 'mode');
      Perf.badT = Perf.goodT = 0;
    },
    stats() {
      if (Perf._s && Perf._s.at === Perf.t) return Perf._s;
      const n = Math.min(Perf.n, Perf.ring.length), a = Array.from(Perf.ring.subarray(0, n)).sort((x, y) => x - y);
      const q = p => (n ? a[Math.min(n - 1, Math.floor(p * n))] : 0), avg = n ? a.reduce((s, v) => s + v, 0) / n : 0;
      return (Perf._s = { at: Perf.t, fps: avg ? Math.round(1000 / avg) : 0, p50: q(0.5), p95: q(0.95), max: n ? a[n - 1] : 0, w95: w95(), tier: Perf.tier, n: n });
    },
    sample(dt) {
      const ms = dt * 1000;
      if (!(ms > 0) || ms > 1000) return;       // tab switch / first frame: not a rendering cost
      Perf.ring[Perf.i] = ms; Perf.i = (Perf.i + 1) % Perf.ring.length; Perf.n++; Perf.t++;
      if (Perf.mode !== 'auto' || Perf.n < 40) return;
      const p95 = Perf.stats().p95;
      if (p95 > 22) { Perf.badT += dt; Perf.goodT = 0; } else if (p95 < 15) { Perf.goodT += dt; Perf.badT = 0; } else { Perf.badT = Perf.goodT = 0; }
      if (Perf.badT > 2 && Perf.tier < 2) { setTier(Perf.tier + 1, 'p95 ' + p95.toFixed(1)); Perf.badT = 0; Perf.n = 0; }
      else if (Perf.goodT > 10 && Perf.tier > 0) { setTier(Perf.tier - 1, 'p95 ' + p95.toFixed(1)); Perf.goodT = 0; Perf.n = 0; }
    },
    work(ms) { Perf.wr[Perf.wi] = ms; Perf.wi = (Perf.wi + 1) % Perf.wr.length; Perf.wn++; },   // JS cost of one frame body (update + draw calls, not raster)
    count(n) { if (n > Perf.peakParticles) Perf.peakParticles = n; },
    draw(ctx, w, h) {
      if (!Perf.on) return;
      const s = Perf.stats(), t = ['cao', 'vừa', 'thấp'][Perf.tier] + (Perf.mode === 'auto' ? ' (tự động)' : '');
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(4, 4, 168, 44);
      ctx.fillStyle = '#9f9'; ctx.font = '11px monospace'; ctx.textBaseline = 'top';
      ctx.fillText(s.fps + ' fps  p50 ' + s.p50.toFixed(1) + '  p95 ' + s.p95.toFixed(1), 8, 8);
      ctx.fillText('js p95 ' + s.w95.toFixed(1) + '  hạt ' + Perf.peakParticles, 8, 20);
      ctx.fillText('bậc: ' + t, 8, 32);
      ctx.restore();
    },
  };
  function w95() { const n = Math.min(Perf.wn, Perf.wr.length); if (!n) return 0; const a = Array.from(Perf.wr.subarray(0, n)).sort((x, y) => x - y); return a[Math.min(n - 1, Math.floor(0.95 * n))]; }
  function setTier(t, why) {
    if (t === Perf.tier) return;
    Perf.tier = t; Perf.log.push({ tier: t, why: why });
    if (TL.FX) TL.FX.quality = t;
    if (TL.Game && TL.Game.requestResize) TL.Game.requestResize();
    if (TL.BG && TL.BG.setQuality) TL.BG.setQuality(t);
  }
  globalThis.__perf = { get stats() { return Perf.stats(); }, get tier() { return Perf.tier; }, get log() { return Perf.log; }, get work() { return Perf.stats().w95; }, get peakParticles() { return Perf.peakParticles; }, reset() { Perf.wn = 0; Perf.wi = 0; Perf.peakParticles = 0; } };
})(globalThis.TL = globalThis.TL || {});
