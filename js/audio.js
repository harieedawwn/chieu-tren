/* js/audio.js  (owner ATMOS) - procedural Tet card-table sound, Web Audio only, no files, no music.
 * API  TL.Audio
 *   unlock()                      create/resume the AudioContext; call on first pointer/key (also self-attached to input events)
 *   play(name, {pitch, vol})      play a cue; pitch multiplies frequency (tick climbs: pitch = (1 + tickStep) ^ n); no-op before unlock/while muted
 *   setMuted(b)                   mute/unmute the master bus (Game.settings.sound = !muted)
 *   setVolume(v)                  master volume 0..1 (default 0.8)
 *   muted / volume / names        read-only: state, array of every cue name
 *   renderOffline(name, o, secs)  Promise<AudioBuffer> offline render of one cue (tests, no unlock needed)
 * Cues: deal flip select place tick mult chat vong venhat thua stamp button hover coin buy sell dissolve gong shuffle
 * Graph: voices -> comp -> master -> limiter -> soft clip -> out; UI cues bypass comp. Reverb send = small room.
 * Units: seconds, Hz. No DOM except input listeners for unlock. Works on iOS/Android and Zalo/Facebook/Messenger in-app browsers.
 */
(function (TL) {
  'use strict';
  var root = globalThis;
  var AC = root.AudioContext || root.webkitAudioContext;
  var OAC = root.OfflineAudioContext || root.webkitOfflineAudioContext;
  var R = {};
  var rnd = function (a, b) { return a + Math.random() * (b - a); };
  var vary = function (x, pct) { return x * (1 + rnd(-pct, pct)); };

  /* ---------- graph ---------- */
  function makeNoise(ctx, kind) {
    var len = Math.floor(ctx.sampleRate * 2), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (var i = 0; i < len; i++) {
      var white = Math.random() * 2 - 1;
      if (kind === 'pink') {
        b0 = 0.99886 * b0 + white * 0.0555179; b1 = 0.99332 * b1 + white * 0.0750759; b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856; b4 = 0.55000 * b4 + white * 0.5329522; b5 = -0.7616 * b5 - white * 0.0168980;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11; b6 = white * 0.115926;
      } else if (kind === 'brown') { last = (last + 0.02 * white) / 1.02; d[i] = last * 3.5; }
      else d[i] = white;
    }
    return buf;
  }
  function makeIR(ctx, seconds, decay) {
    var len = Math.floor(ctx.sampleRate * seconds), buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var c = 0; c < 2; c++) {
      var d = buf.getChannelData(c), lp = 0;
      for (var i = 0; i < len; i++) {
        var t = i / ctx.sampleRate, n = Math.random() * 2 - 1;
        lp += (n - lp) * (0.55 - 0.4 * Math.min(1, t / seconds));
        d[i] = lp * Math.exp(-t / decay) * (t < 0.004 ? t / 0.004 : 1);
      }
      [0.009, 0.017, 0.026, 0.038].forEach(function (er, k) { var j = Math.floor((er + c * 0.003) * ctx.sampleRate); if (j < len) d[j] += 0.5 / (k + 1); });
    }
    return buf;
  }
  function curve(fn) {
    var n = 1024, c = new Float32Array(n);
    for (var i = 0; i < n; i++) c[i] = fn(i / (n - 1) * 2 - 1);
    return c;
  }
  function build(ctx) {
    var g = { ctx: ctx };
    g.master = ctx.createGain();
    g.limiter = ctx.createDynamicsCompressor();
    g.limiter.threshold.value = -4; g.limiter.knee.value = 0; g.limiter.ratio.value = 20; g.limiter.attack.value = 0.001; g.limiter.release.value = 0.08;
    g.clip = ctx.createWaveShaper();   // last safety: never above about -0.2 dBFS
    g.clip.curve = curve(function (x) { return 0.97 * Math.tanh(x / 0.97); });
    g.comp = ctx.createDynamicsCompressor();
    g.comp.threshold.value = -16; g.comp.knee.value = 8; g.comp.ratio.value = 3; g.comp.attack.value = 0.004; g.comp.release.value = 0.2;
    g.comp.connect(g.master); g.master.connect(g.limiter); g.limiter.connect(g.clip); g.clip.connect(ctx.destination);
    g.sfx = ctx.createGain(); g.sfx.connect(g.comp);
    g.ui = ctx.createGain(); g.ui.connect(g.master);
    g.verb = ctx.createConvolver(); g.verb.buffer = makeIR(ctx, 1.5, 0.3);
    g.verbIn = ctx.createGain(); g.verbIn.gain.value = 0.2;
    g.verbIn.connect(g.verb); g.verb.connect(g.comp);
    g.noise = { white: makeNoise(ctx, 'white'), pink: makeNoise(ctx, 'pink'), brown: makeNoise(ctx, 'brown') };
    g.drv = curve(function (x) { return Math.tanh(2.6 * x) / Math.tanh(2.6); });
    return g;
  }

  /* ---------- per-voice toolkit ---------- */
  function Voice(g, bus, o) {
    var ctx = g.ctx;
    this.ctx = ctx; this.g = g; this.o = o; this.p = o.pitch || 1; this.end = ctx.currentTime;
    this.out = ctx.createGain(); this.out.gain.value = o.vol == null ? 1 : o.vol;
    this.out.connect(bus === 'ui' ? g.ui : g.sfx);
    this.send = ctx.createGain(); this.send.gain.value = bus === 'ui' ? 0 : 0.6;
    this.out.connect(this.send); this.send.connect(g.verbIn);
  }
  Voice.prototype.chain = function (src, nodes, dest) {
    var n = src; for (var i = 0; i < nodes.length; i++) { n.connect(nodes[i]); n = nodes[i]; } n.connect(dest || this.out); return n;
  };
  Voice.prototype.filter = function (type, freq, Q, gain) {
    var f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (Q != null) f.Q.value = Q; if (gain != null) f.gain.value = gain; return f;
  };
  Voice.prototype.drive = function () { var s = this.ctx.createWaveShaper(); s.curve = this.g.drv; s.oversample = '2x'; return s; };
  Voice.prototype.envGain = function (t, attack, peak, tau, hold) {
    var e = this.ctx.createGain(), gg = e.gain; hold = hold || 0;
    gg.setValueAtTime(0, t); gg.linearRampToValueAtTime(peak, t + attack);
    if (hold) gg.setValueAtTime(peak, t + attack + hold);
    gg.setTargetAtTime(0, t + attack + hold, tau);
    var stop = t + attack + hold + tau * 7;
    if (stop > this.end) this.end = stop;
    return { node: e, stop: stop };
  };
  /* filtered noise burst. o: {type, attack, tau, gain, hold, filters, rate, drive, wet} */
  Voice.prototype.noise = function (t, o) {
    var src = this.ctx.createBufferSource(); src.buffer = this.g.noise[o.type || 'white']; src.loop = true;
    src.playbackRate.value = (o.rate || 1) * Math.sqrt(this.p);
    var env = this.envGain(t, o.attack || 0.001, o.gain == null ? 1 : o.gain, o.tau || 0.05, o.hold);
    var nodes = (o.filters || []).slice(); if (o.drive) nodes.push(this.drive()); nodes.push(env.node);
    var last = this.chain(src, nodes, this.out);
    if (o.wet) { var w = this.ctx.createGain(); w.gain.value = o.wet; last.connect(w); w.connect(this.g.verbIn); }
    src.start(t, rnd(0, 1.5)); src.stop(env.stop);
    return { src: src, env: env, filters: o.filters || [] };
  };
  /* pitched oscillator, optional glide f0 -> f1 over glide seconds */
  Voice.prototype.tone = function (t, o) {
    var osc = this.ctx.createOscillator(); osc.type = o.type || 'sine';
    var f0 = o.f0 * this.p; osc.frequency.setValueAtTime(f0, t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1 * this.p), t + (o.glide || 0.1));
    var env = this.envGain(t, o.attack || 0.002, o.gain == null ? 1 : o.gain, o.tau || 0.1, o.hold);
    var nodes = (o.filters || []).slice(); if (o.drive) nodes.push(this.drive()); nodes.push(env.node);
    this.chain(osc, nodes, this.out);
    if (o.wet) { var w = this.ctx.createGain(); w.gain.value = o.wet; env.node.connect(w); w.connect(this.g.verbIn); }
    osc.start(t); osc.stop(env.stop);
    return osc;
  };
  Voice.prototype.partials = function (t, base, ratios, amps, taus, gain, beat) {
    for (var i = 0; i < ratios.length; i++) {
      var f = base * ratios[i];
      if (f * this.p > 16000) continue;
      this.tone(t, { f0: vary(f, 0.004), attack: 0.0008, tau: taus[i], gain: amps[i] * gain });
      if (beat) this.tone(t, { f0: f + beat * (i + 1) * 0.5, attack: 0.0008, tau: taus[i] * 0.9, gain: amps[i] * gain * 0.5 });
    }
  };
  Voice.prototype.grains = function (t, count, span, o) {
    for (var i = 0; i < count; i++) {
      var tt = t + Math.pow(Math.random(), o.skew || 1) * span;
      this.noise(tt, { type: 'white', tau: rnd(o.tauMin || 0.003, o.tauMax || 0.012), gain: rnd(0.4, 1) * o.gain,
        filters: [this.filter('bandpass', rnd(o.fMin, o.fMax) * this.p, o.Q || 1.2)] });
    }
  };

  /* ---------- building blocks ---------- */
  function tap(a, t, f, g, q) { a.noise(t, { type: 'white', attack: 0.0004, tau: 0.003, gain: g, filters: [a.filter('bandpass', f * a.p, q || 1.6)] }); }
  function thud(a, t, f, g, tau) { a.noise(t, { type: 'pink', attack: 0.001, tau: tau || 0.018, gain: g, filters: [a.filter('lowpass', f)] }); }
  function swish(a, t, f0, f1, dur, g, type) {
    var n = a.noise(t, { type: type || 'pink', attack: dur * 0.4, tau: dur * 0.25, gain: g, filters: [a.filter('bandpass', f0, 1.4)] });
    n.filters[0].frequency.exponentialRampToValueAtTime(f1, t + dur);
  }
  // hand drum (trong): skin slap + falling body + rim click + room
  function drum(a, t, f, g, tau) {
    a.noise(t, { type: 'white', attack: 0.0005, tau: 0.012, gain: 0.55 * g, filters: [a.filter('bandpass', 1700, 1.1)] });
    a.noise(t, { type: 'white', attack: 0.0003, tau: 0.004, gain: 0.35 * g, filters: [a.filter('highpass', 2800)] });
    a.tone(t, { f0: f, f1: f * 0.52, glide: 0.11, attack: 0.001, tau: tau, gain: 1.0 * g, drive: true, wet: 0.35 });
    a.noise(t, { type: 'brown', attack: 0.002, tau: tau * 0.9, gain: 0.7 * g, filters: [a.filter('lowpass', 420)], drive: true, wet: 0.5 });
  }
  // coin / metal clink, short and damped
  function clink(a, t, f, g) {
    a.noise(t, { type: 'white', attack: 0.0003, tau: 0.003, gain: 0.5 * g, filters: [a.filter('highpass', 3500)] });
    a.partials(t, f, [1, 2.32, 4.25, 6.63], [1, 0.7, 0.45, 0.25], [0.05, 0.034, 0.022, 0.014], 0.35 * g, 2.3);
  }
  // gong: inharmonic cluster that blooms, hand-struck thump, wash. k: {g, len, pitch}
  function gong(a, t, k) {
    var base = vary(118, 0.04) * (k.pitch || 1);
    var RT = [1, 1.62, 2.35, 2.99, 3.8, 4.7, 5.9], A = [1, 0.85, 0.7, 0.5, 0.4, 0.3, 0.2];
    var T = [0.5, 0.42, 0.34, 0.27, 0.2, 0.15, 0.11], AT = [0.012, 0.03, 0.05, 0.07, 0.09, 0.1, 0.12];
    for (var i = 0; i < RT.length; i++) {
      var f = base * RT[i];
      a.tone(t, { f0: vary(f, 0.003), attack: AT[i], tau: T[i] * k.len, gain: A[i] * k.g * 0.3 });
      a.tone(t, { f0: f + (i + 1) * 0.9, attack: AT[i], tau: T[i] * k.len * 0.9, gain: A[i] * k.g * 0.15 });
    }
    a.noise(t, { type: 'brown', attack: 0.01, tau: 0.12, gain: 0.8 * k.g, filters: [a.filter('lowpass', 520)], drive: true, wet: 0.4 });
    a.noise(t, { type: 'pink', attack: 0.12, tau: 0.32 * k.len, gain: 0.3 * k.g, filters: [a.filter('bandpass', base * 5 * a.p, 0.7)], wet: 0.7 });
    a.noise(t, { type: 'white', attack: 0.0005, tau: 0.006, gain: 0.35 * k.g, filters: [a.filter('highpass', 3000)] });
  }
  // single firecracker
  function cracker(a, t, g) {
    a.noise(t, { type: 'white', attack: 0.0002, tau: rnd(0.004, 0.008), gain: g, filters: [a.filter('highpass', rnd(1200, 2000)), a.filter('peaking', rnd(2800, 4200), 1, 6)], drive: true });
    a.noise(t, { type: 'white', attack: 0.0004, tau: 0.03, gain: g * 0.35, filters: [a.filter('bandpass', rnd(700, 1400), 1)], wet: 0.4 });
    a.tone(t, { f0: rnd(180, 260), f1: 90, glide: 0.03, tau: 0.02, gain: g * 0.25 });
  }

  /* ---------- cues: fn(a: Voice, t, o) -> end time ---------- */
  var LEVEL = {
    deal: 0.63, flip: 1.22, shuffle: 0.34, select: 3.2, place: 0.4,
    tick: 1.9, mult: 0.29, chat: 1.2, vong: 0.24, venhat: 0.49,
    thua: 0.29, stamp: 0.97, button: 1.19, hover: 0.65, coin: 0.155,
    buy: 0.15, sell: 0.17, dissolve: 0.46, gong: 0.7
  };
  function def(name, meta, fn) { R[name] = { fn: fn, bus: meta.bus, max: meta.max || 4, pv: meta.pv, level: LEVEL[name] }; }

  def('deal', { max: 6 }, function (a, t) {                    // one card slid across the mat
    swish(a, t, 1400, 3800, 0.075, 0.8);
    a.noise(t + 0.06, { type: 'pink', attack: 0.002, tau: 0.022, gain: 0.45, filters: [a.filter('lowpass', 900)] });
    tap(a, t + 0.06, 2400, 0.25, 1.2);
    return a.end;
  });
  def('flip', { max: 4 }, function (a, t) {                    // card turned over
    swish(a, t, 2500, 5500, 0.05, 0.7);
    tap(a, t + 0.045, 3800, 0.5);
    thud(a, t + 0.045, 700, 0.25, 0.012);
    return a.end;
  });
  def('shuffle', { max: 2 }, function (a, t) {                 // riffle: accelerating card flicks, then squaring the deck
    var n = 30, dur = 0.55;
    a.noise(t, { type: 'pink', attack: 0.05, tau: 0.1, hold: 0.38, gain: 0.25, filters: [a.filter('bandpass', 1300 * a.p, 0.6)] });
    for (var i = 0; i < n; i++) {
      var tt = t + dur * Math.pow(i / n, 1.4);
      a.noise(tt, { type: 'white', attack: 0.0004, tau: rnd(0.003, 0.007), gain: rnd(0.4, 1), filters: [a.filter('bandpass', rnd(1800, 5500) * a.p, 1.3)] });
    }
    thud(a, t + dur + 0.03, 800, 0.9, 0.03);
    tap(a, t + dur + 0.03, 2200, 0.5, 1.2);
    return a.end;
  });
  def('select', { max: 4 }, function (a, t) {                  // fingertip lifts a card
    tap(a, t, 3200, 0.8, 2);
    thud(a, t, 600, 0.35, 0.012);
    return a.end;
  });
  def('place', { max: 5 }, function (a, t) {                   // card slapped on the mat
    swish(a, t, 1800, 3400, 0.04, 0.35);
    var s = t + 0.035;
    a.noise(s, { type: 'white', attack: 0.0004, tau: 0.004, gain: 0.5, filters: [a.filter('highpass', 1800)] });
    a.noise(s, { type: 'pink', attack: 0.001, tau: 0.035, gain: 0.9, filters: [a.filter('lowpass', 1100)] });
    a.tone(s, { f0: 120, f1: 70, glide: 0.05, tau: 0.035, gain: 0.5 });
    return a.end;
  });
  def('tick', { max: 5, pv: 0.012 }, function (a, t) {         // mo / wood clapper; a.p climbs along the scoring chain
    var p = a.p;
    a.noise(t, { type: 'white', attack: 0.0003, tau: 0.0025, gain: 0.7, filters: [a.filter('highpass', 2500)] });
    [[640, 0.075, 1.0], [1180, 0.045, 0.8], [1900, 0.03, 0.5]].forEach(function (m) {
      a.noise(t, { type: 'white', attack: 0.0005, tau: m[1], gain: m[2] * 1.1, filters: [a.filter('bandpass', m[0] * p, 9)] });
    });
    a.tone(t, { f0: 330, f1: 260, glide: 0.03, tau: 0.025, gain: 0.3 });
    return a.end;
  });
  def('mult', { max: 3 }, function (a, t) {                    // The step: hollow drum thump plus a wood knock
    a.tone(t, { f0: 190, f1: 120, glide: 0.08, tau: 0.09, gain: 1.0, drive: true });
    a.noise(t, { type: 'pink', attack: 0.001, tau: 0.05, gain: 0.6, filters: [a.filter('lowpass', 600)] });
    a.noise(t, { type: 'white', attack: 0.0005, tau: 0.05, gain: 0.9, filters: [a.filter('bandpass', 1100 * a.p, 8)] });
    tap(a, t, 3500, 0.4);
    return a.end;
  });
  def('chat', { max: 2, pv: 0.03 }, function (a, t) {          // firecracker string, a last big bang, then a gong
    var n = 16, tt = t;
    for (var i = 0; i < n; i++) { cracker(a, tt, rnd(0.5, 1) * (0.7 + 0.3 * i / n)); tt += rnd(0.018, 0.05) * (1 - 0.3 * i / n); }
    cracker(a, tt + 0.02, 1.35);
    a.noise(tt + 0.02, { type: 'brown', attack: 0.002, tau: 0.08, gain: 0.8, filters: [a.filter('lowpass', 500)], drive: true, wet: 0.5 });
    gong(a, tt + 0.07, { g: 0.85, len: 1 });
    return a.end;
  });
  def('vong', { max: 3 }, function (a, t) {                    // vong won: cards swept in, small drum
    swish(a, t, 900, 2800, 0.14, 0.45);
    drum(a, t + 0.11, 170, 0.8, 0.12);
    tap(a, t + 0.24, 1700, 0.5, 5);
    return a.end;
  });
  def('venhat', { max: 2, pv: 0.03 }, function (a, t) {        // van won: a few big drum hits
    drum(a, t, 105, 1.0, 0.2);
    drum(a, t + 0.26, 118, 0.95, 0.18);
    drum(a, t + 0.55, 92, 1.3, 0.3);
    a.noise(t + 0.55, { type: 'pink', attack: 0.01, tau: 0.35, gain: 0.3, filters: [a.filter('lowpass', 700)], wet: 1 });
    return a.end;
  });
  def('thua', { max: 2, pv: 0.03 }, function (a, t) {          // van lost: dull low hits, sagging
    drum(a, t, 80, 1.1, 0.3);
    drum(a, t + 0.3, 62, 0.8, 0.35);
    a.tone(t + 0.3, { f0: 110, f1: 40, glide: 0.5, tau: 0.25, gain: 0.5, drive: true });
    a.noise(t, { type: 'brown', attack: 0.01, tau: 0.4, gain: 0.5, filters: [a.filter('lowpass', 300)], wet: 0.6 });
    return a.end;
  });
  def('stamp', { max: 3 }, function (a, t) {                   // seal slammed onto paper
    a.noise(t, { type: 'brown', attack: 0.001, tau: 0.06, gain: 1.0, filters: [a.filter('lowpass', 500)], drive: true, wet: 0.3 });
    a.tone(t, { f0: 95, f1: 55, glide: 0.06, tau: 0.05, gain: 0.9, drive: true });
    a.noise(t, { type: 'white', attack: 0.0004, tau: 0.004, gain: 0.6, filters: [a.filter('highpass', 2200)] });
    a.noise(t, { type: 'white', attack: 0.0006, tau: 0.06, gain: 0.8, filters: [a.filter('bandpass', 280 * a.p, 7)] });
    swish(a, t + 0.05, 1500, 2600, 0.06, 0.15);
    return a.end;
  });
  def('button', { bus: 'ui', max: 4 }, function (a, t) { tap(a, t, 3000, 0.9); thud(a, t, 500, 0.35); return a.end; });
  def('hover', { bus: 'ui', max: 2 }, function (a, t) { tap(a, t, 5200, 0.6, 2); return a.end; });
  def('coin', { max: 4 }, function (a, t) {                    // li xi gained: paper rustle, two clinks
    swish(a, t, 1200, 3000, 0.09, 0.3);
    clink(a, t + 0.07, vary(2600, 0.06), 1);
    clink(a, t + 0.14, vary(3200, 0.06), 0.8);
    return a.end;
  });
  def('buy', { max: 3 }, function (a, t) {                     // coins down, till knock
    swish(a, t, 1000, 2600, 0.08, 0.3);
    clink(a, t + 0.06, vary(2500, 0.05), 1);
    clink(a, t + 0.12, vary(3100, 0.05), 0.9);
    thud(a, t + 0.17, 500, 0.8, 0.03);
    a.noise(t + 0.17, { type: 'white', attack: 0.0006, tau: 0.04, gain: 0.7, filters: [a.filter('bandpass', 380 * a.p, 7)] });
    return a.end;
  });
  def('sell', { max: 3 }, function (a, t) {                    // coins poured out, falling
    for (var i = 0; i < 4; i++) clink(a, t + i * 0.055 + rnd(0, 0.01), vary(3400 - i * 380, 0.05), 0.9 - i * 0.1);
    swish(a, t + 0.2, 2600, 900, 0.1, 0.25);
    return a.end;
  });
  def('dissolve', { max: 3 }, function (a, t) {                // paper burning away: hiss and crackle
    a.noise(t, { type: 'pink', attack: 0.06, tau: 0.3, hold: 0.25, gain: 0.5, filters: [a.filter('bandpass', 2800 * a.p, 0.8)], wet: 0.3 });
    a.grains(t, 28, 0.8, { gain: 0.5, fMin: 1800, fMax: 6500, skew: 0.8, tauMin: 0.002, tauMax: 0.01 });
    a.noise(t, { type: 'brown', attack: 0.05, tau: 0.3, gain: 0.3, filters: [a.filter('lowpass', 500)] });
    return a.end;
  });
  def('gong', { max: 2, pv: 0.03 }, function (a, t) { gong(a, t, { g: 1, len: 1.1 }); return a.end; });

  /* ---------- engine ---------- */
  var ctx = null, g = null, voices = [], muted = false, vol = 0.8, unlocked = false, attached = false;
  var EVS = ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'click', 'keydown'];

  function applyVol() { if (g) g.master.gain.setTargetAtTime(muted ? 0 : vol, ctx.currentTime, 0.02); }
  function ensure() {
    if (!AC) return false;
    if (!ctx) {
      try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { try { ctx = new AC(); } catch (e2) { ctx = null; return false; } }
      g = build(ctx); applyVol();
      ctx.onstatechange = function () {           // iOS: 'interrupted' after calls or tab switches; ask for the next tap again
        if (ctx.state === 'running') detach(); else if (unlocked) attach();
      };
    }
    return true;
  }
  function onGesture() { unlock(); if (ctx && ctx.state === 'running') detach(); }
  function attach() {
    if (attached || !root.document) return;
    attached = true; EVS.forEach(function (e) { root.document.addEventListener(e, onGesture, true); });
  }
  function detach() {
    if (!attached || !root.document) return;
    attached = false; EVS.forEach(function (e) { root.document.removeEventListener(e, onGesture, true); });
  }
  function unlock() {
    if (!ensure()) return;
    try { if (ctx.state !== 'running') { var p = ctx.resume(); if (p && p.catch) p.catch(function () {}); } } catch (e) {}
    try { var b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); } catch (e) {}  // iOS / webview unlock
    unlocked = true;
  }
  function kill(rec, now) {
    try { rec.v.out.gain.cancelScheduledValues(now); rec.v.out.gain.setTargetAtTime(0, now, 0.008); } catch (e) {}
    var i = voices.indexOf(rec); if (i > -1) voices.splice(i, 1);
  }
  function playOn(gr, list, name, r, o, t) {
    var now = gr.ctx.currentTime;
    for (var i = list.length - 1; i >= 0; i--) if (list[i].end < now) list.splice(i, 1);
    var same = list.filter(function (v) { return v.name === name; });
    if (same.length >= r.max) kill(same[0], now);
    if (list.length >= 32) kill(list[0], now);
    var opts = {};
    opts.pitch = Math.max(0.4, Math.min(3, (o.pitch || 1))) * vary(1, r.pv == null ? 0.05 : r.pv);
    opts.vol = (o.vol == null ? 1 : o.vol) * r.level * vary(1, 0.1);
    var v = new Voice(gr, r.bus || 'sfx', opts);
    var end = r.fn(v, t, opts) || v.end;
    var rec = { name: name, v: v, end: end }; list.push(rec);
    return rec;
  }

  if (root.document) {
    attach();
    root.document.addEventListener('visibilitychange', function () {
      if (!ctx) return;
      try {
        if (root.document.hidden) ctx.suspend();
        else if (unlocked) { attach(); var p = ctx.resume(); if (p && p.catch) p.catch(function () {}); }
      } catch (e) {}
    });
    root.addEventListener('pageshow', function () { if (unlocked && ctx && ctx.state !== 'running') attach(); });
  }

  var Audio = {
    unlock: unlock,
    play: function (name, o) {
      var r = R[name];
      if (!r) { if (root.console) console.warn('Audio: unknown cue ' + name); return null; }
      if (!ctx || muted || ctx.state !== 'running') return null;
      return playOn(g, voices, name, r, o || {}, ctx.currentTime + 0.005);
    },
    setMuted: function (b) { muted = !!b; applyVol(); },
    setVolume: function (v) { vol = Math.max(0, Math.min(1, +v || 0)); applyVol(); },
    renderOffline: function (name, o, seconds, sampleRate) {
      sampleRate = sampleRate || 48000; seconds = seconds || 3;
      var c = new OAC(2, Math.ceil(seconds * sampleRate), sampleRate);
      var gr = build(c); gr.master.gain.value = 0.8;
      playOn(gr, [], name, R[name], o || {}, 0.01);
      return c.startRendering();
    }
  };
  Object.defineProperty(Audio, 'muted', { get: function () { return muted; } });
  Object.defineProperty(Audio, 'volume', { get: function () { return vol; } });
  Object.defineProperty(Audio, 'names', { get: function () { return Object.keys(R); } });
  TL.Audio = Audio;
})(globalThis.TL = globalThis.TL || {});
