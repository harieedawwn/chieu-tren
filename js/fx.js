/* js/fx.js  (owner FX) motion layer: queue, tweens, counters, popups, stamps, shake, confetti, flames. No DOM at load.
 * Call FX.update(dt) once per frame BEFORE sprites; FX.draw(ctx) last, inside the shake offset (ctx.translate(FX.offset)).
 *   FX.speed, FX.reducedMotion, FX.offset{x,y}, FX.time, FX.view{w,h} (default: canvas size), FX.pixel (css px per art px if no Game)
 *   FX.update(dt) / FX.draw(ctx) / FX.reset()       step all / draw flames+confetti+popups+stamps / clear everything
 *   FX.queue.add(fn, delay)   run fn after delay s (/speed), once earlier items are done; fn may return a hold time in s
 *   FX.queue.busy() / FX.queue.clear()
 *   FX.after(delay, fn)       parallel one-shot timer (/speed)
 *   FX.tween(obj, props, dur, ease, {delay,onDone})  ease 'out'|'back'|'inout'|'spring'|'linear' -> {cancel()}; same keys steal
 *   FX.counter(obj, key, to, dur)   tween a number and juice on change; show TL.fmt(obj[key])
 *   FX.juice(obj, a) / FX.juiceOf(obj) -> {s, r}   damped scale + rotation wobble (read it when drawing obj)
 *   FX.popup(text, x, y, kind 'diem'|'the'|'xthe'|'gold'|'bad')   FX.stamp(text, kind 'good'|'bad'|'gold', x?, y?)
 *   FX.shake(px)   FX.confetti(x, y, n)   FX.flame(rect, on)
 *   FX.shakeFor(score) -> px   FX.stepGap(nSteps) -> s   FX.tickPitch(i) -> pitch multiplier
 *   FX.springStep(s{x,v}, target, dt, freq, zeta)   FX.ease{linear,out,back,inout,spring,outBack(t,s)}   (pure, used by sprite.js)
 *   FX.text(ctx, str, x, y, opts{size,color,align,outline,shadow})  TL.Art.text if present, else fallback; y = vertical middle
 *   FX.artPx() -> css px per art pixel
 */
(function (TL) {
  'use strict';
  const CFG = TL.CFG, M = CFG.MOTION, PAL = CFG.PAL;
  const TAU = Math.PI * 2;
  const FX = { speed: 1, reducedMotion: false, offset: { x: 0, y: 0 }, time: 0, view: null, pixel: 3, textScale: 1 };
  const sp = () => (FX.speed > 0 ? FX.speed : 1);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rnd = (a, b) => a + Math.random() * (b - a);

  // ---------- easing ----------
  function outBack(t, s) { s = s == null ? 1.70158 : s; const u = t - 1; return 1 + (s + 1) * u * u * u + s * u * u; }
  function outElastic(t) { if (t <= 0) return 0; if (t >= 1) return 1; return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1; }
  const EASE = {
    linear: (t) => t,
    out: (t) => 1 - (1 - t) * (1 - t),
    back: (t) => outBack(t),
    inout: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    spring: outElastic,
    outBack: outBack,
  };

  // ---------- exact damped spring (frame-rate independent) ----------
  function springStep(s, target, dt, freq, zeta) {
    if (!(dt > 0)) return s;
    const w = TAU * freq, d = s.x - target, v = s.v;
    if (Math.abs(zeta - 1) < 1e-3) {
      const e = Math.exp(-w * dt), c = v + w * d;
      s.x = target + (d + c * dt) * e;
      s.v = (v - w * c * dt) * e;
    } else if (zeta < 1) {
      const wd = w * Math.sqrt(1 - zeta * zeta), e = Math.exp(-zeta * w * dt);
      const B = (v + zeta * w * d) / wd, cs = Math.cos(wd * dt), sn = Math.sin(wd * dt);
      s.x = target + e * (d * cs + B * sn);
      s.v = e * (-zeta * w * (d * cs + B * sn) + wd * (-d * sn + B * cs));
    } else {
      const q = Math.sqrt(zeta * zeta - 1), r1 = -w * (zeta - q), r2 = -w * (zeta + q);
      const c2 = (v - r1 * d) / (r2 - r1), c1 = d - c2, e1 = Math.exp(r1 * dt), e2 = Math.exp(r2 * dt);
      s.x = target + c1 * e1 + c2 * e2;
      s.v = c1 * r1 * e1 + c2 * r2 * e2;
    }
    return s;
  }

  // ---------- queue (sequential) + after (parallel) ----------
  let q = [], cur = null, curTimer = 0, curFired = false;
  const queue = {
    add(fn, delay) { q.push({ fn: fn, delay: Math.max(0, delay || 0) }); },
    busy() { return !!cur || q.length > 0; },
    clear() { q = []; cur = null; curTimer = 0; curFired = false; },
  };
  function runQueue(dt) {
    let b = dt, guard = 0;
    while (guard++ < 1000) {
      if (!cur) {
        if (!q.length) break;
        cur = q.shift(); curFired = false; curTimer = cur.delay / sp();
      }
      if (curTimer > b + 1e-9) { curTimer -= b; break; }
      b -= curTimer; curTimer = 0;
      if (!curFired) {
        const item = cur; curFired = true;
        let r;
        try { r = item.fn(); } catch (e) { if (typeof console !== 'undefined') console.error(e); }
        if (cur !== item) continue;                      // fn called clear()
        curTimer = (typeof r === 'number' && r > 0 ? r : 0) / sp();
        if (curTimer <= 0) cur = null;
      } else { cur = null; }
    }
  }
  let timers = [];
  function after(delay, fn) { timers.push({ t: Math.max(0, delay || 0) / sp(), fn: fn }); }
  function runTimers(dt) {
    if (!timers.length) return;
    const due = [], keep = [];
    for (const k of timers) { k.t -= dt; (k.t <= 0 ? due : keep).push(k); }
    timers = keep;
    for (const k of due) { try { k.fn(); } catch (e) { if (typeof console !== 'undefined') console.error(e); } }
  }

  // ---------- tweens ----------
  let tweens = [];
  function begin(tw) {
    tw.started = true;
    for (const k of tw.keys) tw.from[k] = tw.obj[k];
    for (const o of tweens) {                            // a newer tween owns the keys it touches
      if (o === tw || o.obj !== tw.obj || !o.started) continue;
      o.keys = o.keys.filter((k) => tw.keys.indexOf(k) < 0);
      if (!o.keys.length) o.dead = true;
    }
  }
  function tween(obj, props, dur, ease, opts) {
    opts = opts || {};
    const tw = {
      obj: obj, to: Object.assign({}, props), from: {}, keys: Object.keys(props), t: 0,
      dur: Math.max(0, dur || 0) / sp(), delay: Math.max(0, opts.delay || 0) / sp(),
      ease: EASE[ease] || EASE.out, onDone: opts.onDone, dead: false, started: false,
      cancel() { tw.dead = true; },
    };
    tweens.push(tw);
    if (tw.delay <= 0) {
      begin(tw);
      if (tw.dur <= 0) finish(tw);
    }
    return tw;
  }
  function finish(tw) {
    for (const k of tw.keys) tw.obj[k] = tw.to[k];
    tw.dead = true;
    if (tw.onDone) { try { tw.onDone(tw.obj); } catch (e) { if (typeof console !== 'undefined') console.error(e); } }
  }
  function runTweens(dt) {
    if (!tweens.length) return;
    const list = tweens.slice();
    for (const tw of list) {
      if (tw.dead) continue;
      let d = dt;
      if (!tw.started) {
        tw.delay -= d;
        if (tw.delay > 0) continue;
        d = -tw.delay; tw.delay = 0; begin(tw);
        if (tw.dur <= 0) { finish(tw); continue; }
      }
      tw.t += d;
      const p = tw.dur > 0 ? Math.min(1, tw.t / tw.dur) : 1;
      if (p >= 1) { finish(tw); continue; }
      const e = tw.ease(p);
      for (const k of tw.keys) tw.obj[k] = tw.from[k] + (tw.to[k] - tw.from[k]) * e;
    }
    tweens = tweens.filter((t) => !t.dead);
  }

  // ---------- juice + counters ----------
  function juice(obj, a) { obj._j0 = FX.time; obj._ja = a == null ? 1 : a; }
  function juiceOf(obj) {
    if (!obj || obj._j0 == null) return { s: 1, r: 0 };
    const J = M.juice, age = (FX.time - obj._j0) * sp(), p = age / J.dur;
    if (p >= 1) return { s: 1, r: 0 };
    const env = (1 - p) * (1 - p), ph = TAU * J.freq * age;
    return { s: 1 + obj._ja * J.scale * env * Math.cos(ph), r: obj._ja * J.rot * env * Math.sin(ph) };
  }
  const pending = new WeakMap();
  function counter(obj, key, to, dur) {
    let pm = pending.get(obj); if (!pm) { pm = {}; pending.set(obj, pm); }
    const was = pm[key] != null ? pm[key] : obj[key];
    if (was === to) return null;
    pm[key] = to;
    if (typeof obj.juice === 'function') obj.juice(1); else juice(obj, 1);
    return tween(obj, { [key]: to }, dur == null ? M.counter.dur : dur, 'out', { onDone: () => { if (pm[key] === to) delete pm[key]; } });
  }

  // ---------- text ----------
  function font(size) { return 'bold ' + Math.round(size) + 'px GameFont, "Be Vietnam Pro", "Segoe UI", Roboto, sans-serif'; }
  function text(ctx, str, x, y, o) {
    o = o || {};
    if (TL.Art && typeof TL.Art.text === 'function') { TL.Art.text(ctx, str, x, y, o); return; }
    const size = o.size || 16, px = Math.max(1, Math.round(size / 12));
    ctx.save();
    ctx.font = font(size); ctx.textAlign = o.align || 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    if (o.shadow !== false) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillText(str, x + px * 1.5, y + px * 1.5); }
    if (o.outline !== false) { ctx.strokeStyle = PAL.denSon; ctx.lineWidth = px * 2; ctx.strokeText(str, x, y); }
    ctx.fillStyle = o.color || PAL.giayDo; ctx.fillText(str, x, y);
    ctx.restore();
  }
  function artPx() {
    const g = TL.Game;
    return g && g.scale && g.dpr ? g.scale / g.dpr : FX.pixel || 3;
  }
  function viewOf(ctx) {
    if (FX.view) return FX.view;
    if (TL.Game && TL.Game.w) return { w: TL.Game.w, h: TL.Game.h };
    const c = ctx.canvas || {};
    return { w: c.clientWidth || c.width || 640, h: c.clientHeight || c.height || 360 };
  }

  // ---------- popups ----------
  let popups = [];
  const POP = {
    diem: { fill: PAL.menLam, ink: PAL.giayDo, size: 1 },
    the: { fill: PAL.doSon, ink: PAL.giayDo, size: 1 },
    xthe: { fill: PAL.doSon, ink: PAL.vangKim, size: 1.3 },
    gold: { fill: PAL.vangKim, ink: PAL.denSon, size: 1.15 },
    bad: { fill: PAL.nauCanhGian, ink: PAL.giayDo, size: 1, edge: PAL.doSon },
  };
  function popup(str, x, y, kind) { popups.push({ str: String(str), x: x, y: y, kind: POP[kind] ? kind : 'gold', age: 0 }); }
  function plate(ctx, x, y, w, h, fill, edge, sh) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x + sh, y + sh, w, h);
    ctx.fillStyle = fill; ctx.fillRect(x, y, w, h);
    if (edge) { ctx.strokeStyle = edge; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2); }
  }
  function drawPopups(ctx) {
    const P = M.popup;
    for (const p of popups) {
      const k = p.age / P.dur, d = POP[p.kind];
      const size = Math.max(16, Math.round(9 * artPx())) * d.size * FX.textScale;
      const sc = k < 0.25 ? outBack(k / 0.25, P.back) : 1;
      const al = k < P.fadeAt ? 1 : Math.max(0, 1 - (k - P.fadeAt) / (1 - P.fadeAt));
      const cy = p.y - P.rise * EASE.out(Math.min(1, k / 0.8));
      ctx.font = font(size);
      const w = ctx.measureText(p.str).width + size * 0.9, h = size * 1.4;
      ctx.save();
      ctx.globalAlpha = al; ctx.translate(Math.round(p.x), Math.round(cy)); ctx.scale(sc, sc);
      plate(ctx, -w / 2, -h / 2, w, h, d.fill, d.edge, Math.max(2, Math.round(size / 7)));
      text(ctx, p.str, 0, 0, { size: size, color: d.ink, align: 'center', outline: false, shadow: false });
      ctx.restore();
    }
  }

  // ---------- stamps ----------
  let stamps = [];
  const STAMP = {
    good: { fill: PAL.doSon, ink: PAL.vangKim, edge: PAL.vangKim },
    gold: { fill: PAL.vangKim, ink: PAL.denSon, edge: PAL.doSon },
    bad: { fill: PAL.denSon, ink: PAL.doSon, edge: PAL.doSon },
  };
  function stamp(str, kind, x, y) { stamps.push({ str: String(str), kind: STAMP[kind] ? kind : 'good', x: x, y: y, age: 0, hit: false }); }
  function drawStamps(ctx) {
    const S = M.stamp, v = viewOf(ctx);
    for (const s of stamps) {
      let sc = 1, al = 1;
      if (s.age < S.in) { const k = s.age / S.in; sc = S.from + (1 - S.from) * outBack(k, 1.2); al = Math.min(1, k * 3); }
      else if (s.age > S.in + S.hold) { const k = (s.age - S.in - S.hold) / S.out; al = 1 - k; sc = 1 + 0.12 * k; }
      const d = STAMP[s.kind], size = clamp(v.w * 0.07, 24, 60) * FX.textScale;
      ctx.font = font(size);
      const w = ctx.measureText(s.str).width + size * 1.1, h = size * 1.55, lw = Math.max(3, size * 0.09);
      ctx.save();
      ctx.globalAlpha = Math.max(0, al);
      ctx.translate(Math.round(s.x != null ? s.x : v.w / 2), Math.round(s.y != null ? s.y : v.h * 0.42));
      ctx.rotate(-5 * Math.PI / 180); ctx.scale(sc, sc);
      plate(ctx, -w / 2, -h / 2, w, h, d.fill, null, Math.round(size * 0.12));
      ctx.strokeStyle = d.edge; ctx.lineWidth = lw; ctx.strokeRect(-w / 2 + lw * 1.5, -h / 2 + lw * 1.5, w - lw * 3, h - lw * 3);
      text(ctx, s.str, 0, size * 0.04, { size: size, color: d.ink, align: 'center', outline: false, shadow: false });
      ctx.restore();
    }
  }

  // ---------- shake ----------
  let amp = 0;
  function shake(px) {
    if (FX.reducedMotion || !(px > 0)) return;
    amp = Math.min(M.shake.max, Math.max(amp, px) + 0.3 * Math.min(amp, px));
  }
  const shakeFor = (score) => Math.min(M.shake.max, M.shake.perLog * Math.log(1 + Math.max(0, score) / M.shake.ref));
  const stepGap = (n) => clamp(M.play.step * Math.min(1, 5 / Math.max(1, n)), M.play.stepMin, M.play.step);
  const tickPitch = (i) => M.play.tickPitch * Math.pow(1 + M.play.tickStep, i);

  // ---------- particles ----------
  let conf = [], fl = [];
  const emitters = new Map();
  function confetti(x, y, n) {
    n = n == null ? M.confetti.n : n;
    const ps = artPx();
    for (let i = 0; i < n && conf.length < 500; i++) {
      const a = (-90 + rnd(-70, 70)) * Math.PI / 180, v = rnd(260, 640);
      conf.push({
        x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: rnd(0, TAU), vr: rnd(-6, 6),
        flap: rnd(0, TAU), fv: rnd(6, 13), ph: rnd(0, TAU), w: Math.max(5, ps * 2) * rnd(0.8, 1.3), h: Math.max(8, ps * 3.4) * rnd(0.8, 1.3),
        col: Math.random() < 0.5 ? PAL.doSon : PAL.vangKim, age: 0, life: M.confetti.life * rnd(0.8, 1.2),
      });
    }
  }
  function flame(rect, on) {
    const key = Math.round(rect.x) + ',' + Math.round(rect.y) + ',' + Math.round(rect.w) + ',' + Math.round(rect.h);
    if (!on) { emitters.delete(key); return; }
    const e = emitters.get(key);
    if (e) e.r = rect; else emitters.set(key, { r: rect, acc: Math.random() });
  }
  function runParticles(sdt) {
    const C = M.confetti, F = M.flame, drag = Math.exp(-1.9 * sdt);
    for (const c of conf) {
      c.age += sdt; c.vy += C.gravity * sdt; c.vx *= drag; c.vy *= drag;
      c.x += (c.vx + Math.sin(c.age * 7 + c.ph) * 45) * sdt; c.y += c.vy * sdt;
      c.rot += c.vr * sdt; c.flap += c.fv * sdt;
    }
    conf = conf.filter((c) => c.age < c.life);
    for (const e of emitters.values()) {
      e.acc += F.rate * clamp(e.r.w / 80, 1, 3) * sdt;
      while (e.acc >= 1 && fl.length < 400) {
        e.acc -= 1;
        fl.push({ x: e.r.x + Math.random() * e.r.w, y: e.r.y + artPx(), vx: rnd(-8, 8), vy: -F.rise * rnd(0.7, 1.3), age: 0, life: F.life * rnd(0.7, 1.2) });
      }
      if (e.acc > 3) e.acc = 0;
    }
    for (const p of fl) { p.age += sdt; p.x += p.vx * sdt; p.y += p.vy * sdt; }
    fl = fl.filter((p) => p.age < p.life);
  }
  function drawParticles(ctx) {
    const ps = artPx(), F = M.flame;
    for (const p of fl) {
      const f = p.age / p.life, s = Math.max(1, Math.round(F.size * (1 - 0.5 * f))) * ps;
      ctx.fillStyle = f < 0.4 ? PAL.vangKim : PAL.doSon;
      ctx.fillRect(Math.round(p.x / ps) * ps, Math.round(p.y / ps) * ps, s, s);
    }
    for (const c of conf) {
      const k = c.age / c.life, shrink = k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1;
      const w = Math.max(1, c.w * Math.abs(Math.cos(c.flap))), h = c.h * shrink;
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot);
      ctx.fillStyle = c.col; ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.restore();
    }
  }

  // ---------- frame ----------
  function update(dt) {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    FX.time += dt;
    runTimers(dt); runQueue(dt); runTweens(dt);
    const sdt = dt * sp();
    for (const p of popups) p.age += sdt;
    popups = popups.filter((p) => p.age < M.popup.dur);
    for (const s of stamps) {
      s.age += sdt;
      if (!s.hit && s.age >= M.stamp.in) { s.hit = true; shake(5); }
    }
    stamps = stamps.filter((s) => s.age < M.stamp.in + M.stamp.hold + M.stamp.out);
    if (FX.reducedMotion) amp = 0;
    amp *= Math.exp(-M.shake.decay * sdt);
    if (amp < 0.05) amp = 0;
    FX.offset.x = amp ? Math.round((Math.random() * 2 - 1) * amp) : 0;
    FX.offset.y = amp ? Math.round((Math.random() * 2 - 1) * amp) : 0;
    runParticles(sdt);
  }
  function draw(ctx) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    drawParticles(ctx); drawPopups(ctx); drawStamps(ctx);
    ctx.restore();
  }
  function reset() {
    queue.clear(); timers = []; tweens = []; popups = []; stamps = []; conf = []; fl = []; emitters.clear(); amp = 0;
    FX.offset.x = 0; FX.offset.y = 0;
  }

  Object.assign(FX, {
    update: update, draw: draw, reset: reset, queue: queue, after: after, tween: tween, counter: counter,
    juice: juice, juiceOf: juiceOf, popup: popup, stamp: stamp, shake: shake, confetti: confetti, flame: flame,
    shakeFor: shakeFor, stepGap: stepGap, tickPitch: tickPitch, springStep: springStep, ease: EASE,
    text: text, font: font, artPx: artPx,
  });
  TL.FX = FX;
})(globalThis.TL = globalThis.TL || {});
