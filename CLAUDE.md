# Chiếu Trên — project notes for Claude
Tiến Lên miền Nam 1v1 roguelike (Tết theme), plain HTML + canvas, no build step, no dependencies. Vietnamese UI. Glossary and rules: SPEC.md; design: DESIGN.md; plan/progress: PLAN.md.

## Session protocol
Read PLAN.md first and follow its "Session protocol" (one step per session, checks, tick, commit, push `HEAD:main`, 5-line Vietnamese report).
After any change to game files: `node tools/build-pwa.js` (tests/pwa.check.js fails on a stale sw.js) and bump `?v=` in index.html when scripts change.

## Checks
All `tests/*.test.js` / `*.check.js`, `node tests/headless.js 1` (auto-run, zero console errors), Playwright screenshots at 844×390, 390×844, 1280×720, 915×412, 932×430.
Run node tests/perf.js before every commit that touches rendering, fx, sprites, background or screens; a failing perf test blocks the commit.

## Performance rules (R3)
- Static shapes (panels, slots, button faces) and text go through offscreen bitmap caches (art.js `blit`, `textBitmap`); extend them, don't draw per frame.
- No getImageData / per-pixel work, `shadowBlur` or `ctx.filter` in the frame loop; canvas DPR ceiling is `Perf.dprCap()` (2 at most).
- Particles, popups, confetti are pooled with a cap from `Perf.particleCap(kind)`; never allocate past it.
- Background: WebGL at 30 fps, paused while `FX.zoom !== 1`, resolution by tier (`BG.setQuality`).
- Adaptive tier (js/perf.js): high/mid/low from frame p95 (down at >22 ms for 2 s, up after 10 s <15 ms); setting "Hiệu năng" Tự động/Cao/Tiết kiệm. `?perf` shows the overlay, `window.__perf` exposes stats.
- Tools: `node tools/profile.js [rate] [secs]` CPU-profiles the auto-run under throttling; `node tests/perf.js [secs]` is the gate (budget calibrated to the software-raster CI box; `PERF_BUDGET=20` on a real device).
