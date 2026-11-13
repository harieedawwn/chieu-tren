/* js/bg.js  (owner ATMOS) - slow lacquer swirl background + optional scanline overlay.
 * API  TL.BG
 *   init(canvas)       bind the #bg canvas (WebGL; falls back to a static dithered 2D pattern); sets its backing store to a low-res size
 *   setMood(name)      'ban'|'boss'|'shop'|'title'; colours, band areas and speed ease over ~1 s
 *   setKhi(lv)         Khi the 0..3: multiplies flow speed by CFG.KHI.bg[lv]; setMood also takes CFG.MOODS names (ba_noi chu_ba ong_sau co_hai bac_chin di_ut giao_thua daily vo_tan)
 *   pulse(a)           briefly speed the flow up (a = 0..1, scaled by CFG.MOTION.bg.pulse, decays by CFG.MOTION.bg.decay per s)
 *   crt(on)            toggle the scanline overlay (own fixed div, thin dark line every 3 device px, no curvature/vignette)
 *   render(t)          draw one frame; t = seconds (any clock); reads canvas CSS size each call; does nothing while the tab is hidden
 * Look: domain-warped noise, posterized into 3 flat bands from CFG.PAL with a 4x4 Bayer dither, drawn at about 1/4 resolution
 *       (integer device-px scale, at most 360 px wide) and shown with nearest-neighbour upscaling. Low contrast on purpose.
 * Reads TL.CFG.PAL, TL.CFG.BG.swirl, TL.CFG.MOTION.bg when present (own defaults otherwise). Mood colours are fixed here (job brief).
 */
(function (TL) {
  'use strict';
  var doc = globalThis.document;

  var DEF_PAL = { denSon: '#1B1412', nauCanhGian: '#4A2418', doSon: '#A3271F', vangKim: '#D9A441', menLam: '#2E5E8C', giayDo: '#EADCC0', laXanh: '#5B7040' };
  function cfg() { return TL.CFG || {}; }
  function pal() { return (cfg().PAL) || DEF_PAL; }
  function hex(h) { return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]; }
  function mix(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
  function P(k) { return hex(pal()[k] || DEF_PAL[k]); }

  // bands dark -> light. thr = [dark/mid edge, mid/light edge] on the 0..1 noise (light band is the smallest area). speed = flow multiplier.
  function moods() {
    var den = P('denSon'), nau = P('nauCanhGian'), red = P('doSon');
    var m = {
      ban:   { c: [den, nau, mix(red, nau, 0.3)],                thr: [0.48, 0.80], speed: 1.0 },
      boss:  { c: [den, mix(red, den, 0.55), mix(red, den, 0.2)], thr: [0.40, 0.76], speed: 1.7 },
      shop:  { c: [den, nau, mix(P('menLam'), nau, 0.3)],        thr: [0.48, 0.80], speed: 1.0 },
      title: { c: [den, nau, mix(P('vangKim'), nau, 0.45)],         thr: [0.52, 0.86], speed: 0.9 }
    };
    var MO = cfg().MOODS || {};   // special palettes (CFG.MOODS, hex colours): ba_noi chu_ba ong_sau co_hai bac_chin di_ut giao_thua daily vo_tan
    Object.keys(MO).forEach(function (k) { m[k] = { c: MO[k].c.map(hex), thr: MO[k].thr.slice(), speed: MO[k].speed }; });
    return m;
  }

  var VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var FS = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH', 'precision highp float;', '#else', 'precision mediump float;', '#endif',
    'uniform vec2 uRes;uniform float uT;uniform float uSwirl;',
    'uniform vec3 uC0;uniform vec3 uC1;uniform vec3 uC2;uniform vec2 uThr;',
    'float h(vec2 i){return fract(sin(dot(i,vec2(127.1,311.7)))*43758.5453);}',
    'float vn(vec2 x){vec2 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);',
    ' return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}',
    'float fbm(vec2 x){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*vn(x);x=x*2.02+vec2(17.3,9.1);a*=.5;}return s;}',
    'float b2(vec2 a){a=floor(a);return fract(a.x/2.+a.y*a.y*.75);}',
    'float b4(vec2 a){return b2(.5*a)*.25+b2(a);}',
    'void main(){',
    ' vec2 uv=gl_FragCoord.xy/uRes;vec2 c=(uv-.5)*vec2(uRes.x/uRes.y,1.);',
    ' float r=length(c);float ang=uSwirl*uT*.9+.55*r+.35*sin(uT*.07);',
    ' float cs=cos(ang),sn=sin(ang);vec2 p=mat2(cs,-sn,sn,cs)*c*2.3;',
    ' vec2 q=vec2(fbm(p+vec2(0.,uT*.11)),fbm(p+vec2(5.2,1.3)-uT*.09));',
    ' vec2 w=vec2(fbm(p+3.*q+vec2(1.7,9.2)+.15*uT),fbm(p+3.*q+vec2(8.3,2.8)+.126*uT));',
    ' float f=fbm(p+3.*w);',
    ' f=clamp((f-.2)*1.55+.0,0.,1.);',
    ' float d=(b4(gl_FragCoord.xy)-.47)*.2;',
    ' float v=f+d;',
    ' vec3 col=v<uThr.x?uC0:(v<uThr.y?uC1:uC2);',
    ' gl_FragColor=vec4(col,1.);}'
  ].join('\n');

  var S = {
    canvas: null, gl: null, prog: null, loc: null, buf: null, ctx2d: null, mode: 'none',
    mood: 'ban', khiMul: 1, cur: null, from: null, to: null, ease: 1,
    phase: 0, lastT: null, boost: 0, lowW: 0, lowH: 0, cssW: 0, cssH: 0, dpr: 0,
    field: null, dirty: true, crtOn: false, crtEl: null, lost: false
  };

  function snapshot(m) { return { c: [m.c[0].slice(), m.c[1].slice(), m.c[2].slice()], thr: m.thr.slice(), speed: m.speed }; }

  function compile(gl, type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { var e = gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error(e); }
    return s;
  }
  function setupGL(gl) {
    var pr = gl.createProgram();
    gl.attachShader(pr, compile(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(pr, compile(gl, gl.FRAGMENT_SHADER, FS));
    gl.bindAttribLocation(pr, 0, 'p'); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    gl.useProgram(pr);
    S.prog = pr;
    S.loc = {};
    ['uRes', 'uT', 'uSwirl', 'uC0', 'uC1', 'uC2', 'uThr'].forEach(function (n) { S.loc[n] = gl.getUniformLocation(pr, n); });
    S.buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, S.buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
  }

  function init(canvas) {
    S.canvas = canvas;
    var st = canvas.style;
    if (!st.width) st.width = '100%';
    if (!st.height) st.height = '100%';
    if (!st.display) st.display = 'block';
    st.imageRendering = 'pixelated';
    if (!st.imageRendering || st.imageRendering === 'auto') st.imageRendering = 'crisp-edges';
    st.imageRendering = 'pixelated';
    var M = moods();
    S.cur = snapshot(M[S.mood] || M.ban); S.to = S.cur; S.from = S.cur; S.ease = 1;
    var gl = null;
    try { gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'low-power' }) || canvas.getContext('experimental-webgl'); } catch (e) { gl = null; }
    if (gl) {
      try { setupGL(gl); S.gl = gl; S.mode = 'gl'; } catch (e) { S.gl = null; gl = null; }
    }
    if (!S.gl) {
      // a canvas that already produced a failed webgl context cannot give 2D; swap in a fresh canvas element if needed
      var c2 = null; try { c2 = canvas.getContext('2d'); } catch (e) { c2 = null; }
      if (!c2 && canvas.parentNode) {
        var nc = canvas.cloneNode(false); canvas.parentNode.replaceChild(nc, canvas); S.canvas = nc; c2 = nc.getContext('2d');
      }
      S.ctx2d = c2; S.mode = c2 ? '2d' : 'none';
    }
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); S.lost = true; }, false);
    canvas.addEventListener('webglcontextrestored', function () {
      try { setupGL(S.gl); S.lost = false; S.dirty = true; } catch (e) { S.mode = 'none'; }
    }, false);
    S.dirty = true; S.lastT = null;
    if (S.crtOn) crt(true);
  }

  function setMood(name) {
    var M = moods();
    if (!M[name] || name === S.mood && S.ease >= 1) { if (M[name]) S.mood = name; return; }
    S.from = snapshot(S.cur || M[name]);
    S.to = snapshot(M[name]);
    S.mood = name; S.ease = 0; S.dirty = true;
  }

  function setKhi(lv) { var t = (cfg().KHI || {}).bg; S.khiMul = t ? t[Math.max(0, Math.min(t.length - 1, lv | 0))] : 1; }

  function pulse(a) {
    var m = (cfg().MOTION || {}).bg || { pulse: 2.5 };
    var v = Math.max(0, +a || 0) * m.pulse;
    if (v > S.boost) S.boost = v;
  }

  function sizeCheck() {
    var cv = S.canvas;
    var cw = cv.clientWidth || (globalThis.innerWidth || 800), ch = cv.clientHeight || (globalThis.innerHeight || 600);
    var dpr = globalThis.devicePixelRatio || 1;
    if (cw === S.cssW && ch === S.cssH && dpr === S.dpr) return false;
    S.cssW = cw; S.cssH = ch; S.dpr = dpr;
    var devW = Math.max(1, Math.round(cw * dpr)), devH = Math.max(1, Math.round(ch * dpr));
    var ps = Math.max(4, Math.ceil(devW / [360, 270, 200][S.qual || 0]));          // integer device px per bg pixel: about 1/4 resolution, at most 360 wide
    var w = Math.max(1, Math.ceil(devW / ps)), h = Math.max(1, Math.ceil(devH / ps));
    if (w !== cv.width || h !== cv.height) { cv.width = w; cv.height = h; }
    S.lowW = w; S.lowH = h; S.field = null; S.dirty = true;
    // canvas is stretched to the CSS box; the last partial bg pixel is cropped by overflow of the stretch (at most ps-1 device px)
    if (S.gl && !S.lost) S.gl.viewport(0, 0, w, h);
    return true;
  }

  /* ---- 2D fallback: static dithered pattern from cheap sines, recoloured only while the mood eases ---- */
  var BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function buildField() {
    var w = S.lowW, h = S.lowH, f = new Float32Array(w * h), asp = w / h;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var u = (x / w - 0.5) * asp * 4.4, v = (y / h - 0.5) * 4.4;
      var q = Math.sin(u * 1.3 + Math.sin(v * 1.7 + 1.2) * 1.4) + Math.sin(v * 1.1 + Math.sin(u * 0.9 + 3.1) * 1.6) + 0.5 * Math.sin((u + v) * 2.3 + Math.sin(u * 2.1) * 1.1);
      f[y * w + x] = Math.min(1, Math.max(0, (q / 4.6 + 0.5 - 0.2) * 1.55));
    }
    S.field = f;
  }
  function draw2d() {
    if (!S.ctx2d) return;
    if (!S.field) buildField();
    var w = S.lowW, h = S.lowH, cur = S.cur;
    var img = S.ctx2d.createImageData(w, h), d = img.data, f = S.field;
    var c = cur.c.map(function (a) { return [Math.round(a[0] * 255), Math.round(a[1] * 255), Math.round(a[2] * 255)]; });
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var v = f[y * w + x] + (BAYER4[(y & 3) * 4 + (x & 3)] / 16 - 0.47) * 0.2;
      var col = v < cur.thr[0] ? c[0] : (v < cur.thr[1] ? c[1] : c[2]), o = (y * w + x) * 4;
      d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
    }
    S.ctx2d.putImageData(img, 0, 0);
  }

  function render(t) {
    if (!S.canvas || S.mode === 'none') return;
    if (doc && doc.hidden) { S.lastT = null; return; }             // tab hidden: draw nothing, no time jump on return
    var dt = S.lastT == null ? 0 : Math.max(0, Math.min(0.1, t - S.lastT));
    S.lastT = t;
    if (S.mode === 'gl' && !S.dirty) { S.acc = (S.acc || 0) + dt; if (S.acc < 1 / 30 - 0.002) return; dt = S.acc; S.acc = 0; }   // 30 fps flow is enough for a slow swirl
    sizeCheck();
    var m = (cfg().MOTION || {}).bg || { decay: 1.8, base: 1 };
    // ease mood (about 1 s, smoothstep)
    var changed = false;
    if (S.ease < 1) {
      S.ease = Math.min(1, S.ease + dt / 1.0);
      var k = S.ease * S.ease * (3 - 2 * S.ease);
      S.cur = { c: [mix(S.from.c[0], S.to.c[0], k), mix(S.from.c[1], S.to.c[1], k), mix(S.from.c[2], S.to.c[2], k)],
        thr: [S.from.thr[0] + (S.to.thr[0] - S.from.thr[0]) * k, S.from.thr[1] + (S.to.thr[1] - S.from.thr[1]) * k],
        speed: S.from.speed + (S.to.speed - S.from.speed) * k };
      changed = true;
    }
    S.boost *= Math.exp(-(m.decay || 1.8) * dt);
    if (S.boost < 0.001) S.boost = 0;
    S.phase += dt * (m.base == null ? 1 : m.base) * S.cur.speed * (1 + S.boost) * S.khiMul;

    if (S.mode === 'gl') {
      if (S.lost || S.gl.isContextLost()) return;
      var gl = S.gl, c = S.cur;
      gl.uniform2f(S.loc.uRes, S.lowW, S.lowH);
      gl.uniform1f(S.loc.uT, S.phase);
      gl.uniform1f(S.loc.uSwirl, (cfg().BG || {}).swirl == null ? 0.15 : cfg().BG.swirl);
      gl.uniform3f(S.loc.uC0, c.c[0][0], c.c[0][1], c.c[0][2]);
      gl.uniform3f(S.loc.uC1, c.c[1][0], c.c[1][1], c.c[1][2]);
      gl.uniform3f(S.loc.uC2, c.c[2][0], c.c[2][1], c.c[2][2]);
      gl.uniform2f(S.loc.uThr, c.thr[0], c.thr[1]);
      gl.drawArrays(gl.TRIANGLES, 0, 3); S.dirty = false;
    } else if (changed || S.dirty) {
      draw2d(); S.dirty = false;
    }
  }

  /* ---- scanlines: separate fixed overlay, 1 dark device-px line every 3 device px, 6% black ---- */
  function crtImage() {
    var c = doc.createElement('canvas'); c.width = 1; c.height = 3;
    var x = c.getContext('2d'); x.fillStyle = 'rgba(0,0,0,0.06)'; x.fillRect(0, 0, 1, 1);
    return c.toDataURL('image/png');
  }
  function crtSize() {
    if (!S.crtEl) return;
    var d = globalThis.devicePixelRatio || 1;
    S.crtEl.style.backgroundSize = (1 / d) + 'px ' + (3 / d) + 'px';
  }
  function crt(on) {
    S.crtOn = !!on;
    if (!doc || !doc.body) return;
    if (!S.crtEl) {
      var el = doc.createElement('div');
      el.setAttribute('aria-hidden', 'true');
      var s = el.style;
      s.position = 'fixed'; s.left = '0'; s.top = '0'; s.right = '0'; s.bottom = '0'; s.pointerEvents = 'none'; s.zIndex = '2147483000';
      s.backgroundImage = 'url(' + crtImage() + ')'; s.backgroundRepeat = 'repeat'; s.imageRendering = 'pixelated'; s.display = 'none';
      doc.body.appendChild(el); S.crtEl = el;
      globalThis.addEventListener('resize', crtSize);
    }
    crtSize();
    S.crtEl.style.display = S.crtOn ? 'block' : 'none';
  }

  function setQuality(q) { q = q | 0; if (q === S.qual) return; S.qual = q; S.cssW = 0; }   // next sizeCheck rebuilds the low-res buffer
  TL.BG = { setQuality: setQuality, init: init, setMood: setMood, setKhi: setKhi, pulse: pulse, crt: crt, render: render };
})(globalThis.TL = globalThis.TL || {});
