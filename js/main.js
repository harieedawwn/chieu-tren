/* js/main.js  (owner HUD) boot, canvas sizing, loop, input, settings, screen switching. Loads last.
 * API  TL.Game = {ctx, w, h, dpr, scale, safe, run, settings{sound,speed,scanlines,reducedMotion,sort 'rank'|'suit'}, screen, setScreen(name,args), saveSettings(), applySettings(), autoResult}
 *   w, h = CSS px of the canvas; ctx is pre-scaled by dpr, smoothing off; scale = integer art scale from HUD.layout(w,h).cardH.
 *   setScreen('title'|'table'|'shop'|'end'|'settings'|'back', args): 'settings' opens as an overlay over the paused screen, 'back' closes it.
 *   Screen = {enter(args), exit(), update(dt), draw(ctx), pointer({type:'down'|'move'|'up', x, y, id}), key({key:'enter'|'space'|'h'|'s'|'esc'|'left'|'right'|'up'|'down'})}
 *   Frame: FX.update, screen.update, BG.render, clear, (shake offset) screen.draw, overlay.draw, FX.draw. dt is clamped to 1/20 s.
 * The tutorial (tutorial.js) is drawn last and gets pointer/key first while it runs.
 * Flags: ?hud (fake mid-game HUD, no game) ?auto ?seed=N (read by the screens). Errors show a Vietnamese overlay (boot.js) instead of a blank page.
 */
(function (TL) {
  'use strict';
  const CFG = TL.CFG, $ = s => document.querySelector(s);
  const q = new URLSearchParams(location.search);
  const Game = TL.Game = {
    ctx: null, w: 640, h: 360, dpr: 1, scale: 2, safe: { t: 0, r: 0, b: 0, l: 0 }, run: null, screen: null, overlay: null, name: '', autoResult: null,
    settings: { sound: true, speed: 1, scanlines: false, reducedMotion: false, sort: 'rank', perf: 'auto' }, paused: false, flags: { hud: q.has('hud'), auto: q.has('auto'), endless: q.has('endless'), seed: q.has('seed') ? +q.get('seed') : null },
  };
  const guard = (fn, label) => (window.Boot ? Boot.guard(fn, label) : fn);

  function fatal(err) {
    if (window.Boot && Boot.fatal) { Boot.fatal(err); return; }
    try { console.error(err); } catch (e) {}
    const o = document.createElement('div');
    o.style.cssText = 'position:fixed;inset:0;z-index:99;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;background:#1B1412;color:#EADCC0;font:16px/1.5 sans-serif;text-align:center';
    o.innerHTML = '<b style="font-size:20px">Chiếu Trên gặp lỗi</b><span></span><button style="min-height:48px;padding:0 24px;font:bold 16px sans-serif">Tải lại</button>';
    o.querySelector('span').textContent = String(err && err.message || err);
    o.querySelector('button').onclick = () => location.reload();
    document.body.appendChild(o);
  }
  TL.fatal = fatal;

  // ---------------------------------------------------------------- settings
  function loadSettings() {
    const d = { sound: true, speed: 1, scanlines: false, reducedMotion: false, sort: 'rank', perf: 'auto' };
    try { d.reducedMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}
    let o = null;
    try { o = JSON.parse(localStorage.getItem(CFG.STORAGE.settings)); } catch (e) { o = null; }
    if (o && typeof o === 'object') {
      if (typeof o.sound === 'boolean') d.sound = o.sound;
      if (CFG.MOTION.speeds.indexOf(o.speed) >= 0) d.speed = o.speed;
      if (typeof o.scanlines === 'boolean') d.scanlines = o.scanlines;
      if (typeof o.reducedMotion === 'boolean') d.reducedMotion = o.reducedMotion;
      if (o.sort === 'rank' || o.sort === 'suit') d.sort = o.sort;
      if (o.perf === 'auto' || o.perf === 'high' || o.perf === 'low') d.perf = o.perf;
    }
    Game.settings = d;
  }
  Game.saveSettings = function () { try { localStorage.setItem(CFG.STORAGE.settings, JSON.stringify(Game.settings)); return true; } catch (e) { return false; } };
  Game.applySettings = function () {
    const s = Game.settings;
    if (TL.Audio && TL.Audio.setMuted) TL.Audio.setMuted(!s.sound || Game.paused);
    if (TL.FX) { TL.FX.speed = Game.flags.auto ? CFG.AUTO_SPEED : s.speed; TL.FX.reducedMotion = s.reducedMotion; }
    if (TL.BG && TL.BG.crt) TL.BG.crt(s.scanlines);
    if (TL.Perf) TL.Perf.setMode(s.perf);
  };

  // ---------------------------------------------------------------- canvas sizing
  let canvas, ctx, app, lastSize = '';
  function readSafe() {
    const cs = getComputedStyle(document.documentElement), v = n => parseFloat(cs.getPropertyValue(n)) || 0;
    Game.safe = { t: v('--sat'), r: v('--sar'), b: v('--sab'), l: v('--sal') };
  }
  Game.requestResize = function () { lastSize = ''; };
  function resize() {
    const r = app.getBoundingClientRect(), w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    const dpr = Math.min(window.devicePixelRatio || 1, TL.Perf ? TL.Perf.dprCap() : 2), key = w + 'x' + h + 'x' + dpr;
    if (key === lastSize) return;
    lastSize = key; readSafe();
    Game.w = w; Game.h = h; Game.dpr = dpr;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    if (TL.HUD) { const ch = TL.HUD.layout(w, h, Game.safe).cardH; Game.scale = TL.HUD.scaleFor(ch, dpr); if (TL.FX) TL.FX.cardH = ch; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false;
    if (TL.FX) TL.FX.view = { w: w, h: h };
    if (Game.screen && Game.screen.resize) Game.screen.resize(w, h);
    if (Game.overlay && Game.overlay.resize) Game.overlay.resize(w, h);
  }

  // ---------------------------------------------------------------- screens
  function fallbackScreen(msg) {
    return {
      enter() { if (TL.BG) TL.BG.setMood('title'); }, exit() {}, update() {},
      draw(c) { TL.Art.text(c, 'Chiếu Trên', Game.w / 2, Game.h / 2 - 30, { size: 28, align: 'center', color: CFG.PAL.vangKim }); TL.Art.text(c, msg, Game.w / 2, Game.h / 2 + 8, { size: 14, align: 'center' }); },
      pointer() {}, key() {},
    };
  }
  function resolve(name) {
    if (Game.flags.hud && name !== 'settings') return TL.HUD.demoScreen();
    const S = TL.Screens || {};
    if (S[name]) return S[name];
    return fallbackScreen('Màn "' + name + '" chưa có.');
  }
  Game.setScreen = function (name, args) {
    if (name === 'back') { if (Game.overlay) { try { Game.overlay.exit && Game.overlay.exit(); } catch (e) { fatal(e); } Game.overlay = null; } return; }
    if (name === 'settings') {
      if (Game.overlay) return;
      const s = (TL.Screens || {}).settings; if (!s) return;
      Game.overlay = s; s.enter && s.enter(args); return;
    }
    if (Game.overlay) Game.overlay = null;
    if (Game.screen && Game.screen.exit) Game.screen.exit();
    Game.name = name; Game.screen = resolve(name);
    if (Game.screen.enter) Game.screen.enter(args);
    if (Game.screen.resize) Game.screen.resize(Game.w, Game.h);
  };
  const top = () => Game.overlay || Game.screen;

  // ---------------------------------------------------------------- input
  const KEYS = { Enter: 'enter', ' ': 'space', Spacebar: 'space', h: 'h', H: 'h', s: 's', S: 's', Escape: 'esc', ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
  function unlock() { try { if (TL.Audio && TL.Audio.unlock) TL.Audio.unlock(); } catch (e) {} }
  function bindInput() {
    const pos = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const send = (type, e) => {
      const s = top(); if (!s || !s.pointer || (TL.Trans && TL.Trans.busy())) return; const p = pos(e);
      if (TL.Tutorial && TL.Tutorial.on() && !Game.overlay && TL.Tutorial.pointer({ type: type, x: p.x, y: p.y, id: e.pointerId })) return;
      s.pointer({ type: type, x: p.x, y: p.y, id: e.pointerId }); };
    canvas.addEventListener('pointerdown', guard(e => { e.preventDefault(); unlock(); try { canvas.setPointerCapture(e.pointerId); } catch (x) {} send('down', e); }, 'pointer'));
    canvas.addEventListener('pointermove', guard(e => { send('move', e); }, 'pointer'));
    const up = guard(e => { e.preventDefault(); send('up', e); }, 'pointer');
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') send('move', { clientX: -999, clientY: -999, pointerId: e.pointerId }); });
    ['touchstart', 'touchmove', 'touchend'].forEach(t => canvas.addEventListener(t, e => { if (e.cancelable) e.preventDefault(); }, { passive: false }));
    ['gesturestart', 'gesturechange', 'gestureend', 'contextmenu', 'dragstart', 'selectstart'].forEach(t => document.addEventListener(t, e => e.preventDefault()));
    document.addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
    window.addEventListener('keydown', guard(e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = KEYS[e.key]; if (!k) return;
      e.preventDefault(); unlock(); if (e.repeat) return;
      if (TL.Tutorial && TL.Tutorial.on() && !Game.overlay && TL.Tutorial.key(k)) return;
      const s = top(); if (s && s.key && !(TL.Trans && TL.Trans.busy())) s.key({ key: k });
    }, 'key'));
    window.addEventListener('pointerdown', unlock, { once: true, passive: true });
  }

  // ---------------------------------------------------------------- loop
  let clock = 0;
  const frame = guard(function (dt) {
    const t0 = performance.now();
    if (TL.Perf) TL.Perf.sample(dt);
    dt = Math.min(dt, 1 / 20); clock += dt;
    resize();
    const FX = TL.FX;
    if (FX) FX.update(dt);
    if (TL.Trans) TL.Trans.update(dt);
    if (Game.screen && Game.screen.update && !Game.overlay) Game.screen.update(dt);
    if (Game.overlay && Game.overlay.update) Game.overlay.update(dt);
    if (TL.BG && !(FX && FX.zoom !== 1)) TL.BG.render(clock);   // background pauses while the finale zooms
    ctx.setTransform(Game.dpr, 0, 0, Game.dpr, 0, 0); ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, Game.w, Game.h);
    ctx.save();
    if (FX && FX.offset) ctx.translate(FX.offset.x, FX.offset.y);
    if (FX && FX.zoom !== 1) { ctx.translate(Game.w / 2, Game.h / 2); ctx.scale(FX.zoom, FX.zoom); ctx.translate(-Game.w / 2, -Game.h / 2); }
    if (Game.screen && Game.screen.draw) Game.screen.draw(ctx);
    if (Game.overlay && Game.overlay.draw) Game.overlay.draw(ctx);
    if (FX) FX.draw(ctx);
    ctx.restore();
    if (TL.Trans) TL.Trans.draw(ctx);
    if (TL.Perf && TL.Perf.on) TL.Perf.draw(ctx, Game.w, Game.h);
    if (TL.Tutorial && TL.Tutorial.on()) TL.Tutorial.draw(ctx, dt);
    if (TL.Perf) TL.Perf.work(performance.now() - t0);
    const l = $('#loading'); if (l && !l.hidden) l.hidden = true;
  }, 'frame');

  function pause(on) { Game.paused = on; Game.applySettings(); }

  // ---------------------------------------------------------------- start
  function start() {
    app = $('#app'); canvas = $('#game'); ctx = Game.ctx = canvas.getContext('2d');
    loadSettings();
    if (TL.Perf) TL.Perf.on = q.has('perf');
    const bg = $('#bg');
    if (TL.BG && bg) { try { TL.BG.init(bg); } catch (e) { fatal(e); return; } }
    bindInput();
    const timeout = new Promise(res => setTimeout(res, 4000));
    const art = TL.Art ? TL.Art.init() : Promise.resolve(false);
    Promise.race([art, timeout]).then(() => {
      // art.js registers its own 'GameFont' (VT323) after ours and would win; keep the font embedded in style.css
      try {
        const drop = [];
        document.fonts.forEach(f => { if (/GameFont/.test(f.family) && f.unicodeRange && f.unicodeRange !== 'U+0-10FFFF') drop.push(f); });
        drop.forEach(f => document.fonts.delete(f));
      } catch (e) {}
      return document.fonts.load('900 20px GameFont', 'Chiếu Trên ơưặễộừ').catch(() => null).then(() => { try { TL.Art.resetText(); } catch (e) {} });
    }).then(guard(() => {
      resize(); Game.applySettings();
      Game.setScreen(Game.flags.hud ? 'table' : (TL.Screens && TL.Screens.title ? 'title' : 'table'));
      if (window.Boot) { Boot.onPause(() => pause(true)); Boot.onResume(() => pause(false)); }
      new ResizeObserver(() => resize()).observe(app);
      window.addEventListener('resize', resize); window.addEventListener('orientationchange', () => setTimeout(resize, 250));
      if (window.visualViewport) visualViewport.addEventListener('resize', resize);
      window.__ready = true;
      if (window.Boot) Boot.loop(frame);
      else { let prev = 0; const tick = now => { try { frame(Math.min((now - (prev || now)) / 1000, 0.1)); } catch (e) { fatal(e); return; } prev = now; requestAnimationFrame(tick); }; requestAnimationFrame(tick); }
    }, 'init')).catch(fatal);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', guard(start, 'init')); else guard(start, 'init')();
})(globalThis.TL = globalThis.TL || {});
