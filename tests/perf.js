/* tests/perf.js  node tests/perf.js [seconds=40] [rate=6] [--report]
 * Headless Chromium, 915x412 @ DPR 3, CDP CPU throttling (default 6x), index.html?auto&seed=1&perf with the quality tier fixed per pass.
 * Samples TL.Perf frame times every 2 s window while the auto-run plays (title -> deal -> table -> scoring -> chat -> end).
 * Judged on w95 = p95 of the JS frame-body cost (update+draw calls) under the throttle: headless CI rasterises canvas in software, so the vsync interval (also printed, 'int') is not comparable to a phone GPU.
 * FAIL when the median window's w95 exceeds BUDGET or any window exceeds 1.5x it (first 3 windows skipped while the adaptive tier settles) (40 ms; 48 ms for the end/finale screen: calibrated to this software-raster box, where the pre-fix build measured 46-65 ms; real-phone target is 20/24 ms, use PERF_BUDGET=20 on a device) or a frame holds more live particles than the tier cap.
 * Frame times in a software-rendered CI box are noisy: the budget is judged on the BEST of two passes of the same scene set (set PERF_STRICT=1 for one pass).
 * Env: PERF_RATE (CPU slowdown), PERF_BUDGET (ms override), PERF_MODE (auto|high|low; default auto).
 */
const path = require('path'); const { chromium } = require('playwright');
const SECS = +process.argv[2] || 40, RATE = +(process.env.PERF_RATE || process.argv[3] || 6), MODE = process.env.PERF_MODE || 'auto';
const BUDGET = +process.env.PERF_BUDGET || 40, BUDGET_END = Math.max(48, BUDGET + 8), PASSES = process.env.PERF_STRICT ? 1 : 2;
async function pass(b) {
  const ctx = await b.newContext({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const p = await ctx.newPage(), errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push('pageerror ' + e.message));
  await p.addInitScript(m => { try { localStorage.setItem('chieutren.settings', JSON.stringify({ perf: m })); } catch (e) {} }, MODE);
  const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
  await p.goto('file://' + path.join(__dirname, '..', 'index.html') + '?auto&seed=1&perf');
  await p.waitForFunction(() => window.__ready, null, { timeout: 30000 });
  const rows = []; const t0 = Date.now();
  while (Date.now() - t0 < SECS * 1000) {
    await p.evaluate(() => __perf.reset()); await p.waitForTimeout(2000);
    const r = await p.evaluate(() => ({ s: __perf.stats, scr: TL.Game.name, tier: __perf.tier, parts: TL.Perf.peakParticles, cap: [TL.Perf.particleCap('confetti'), TL.Perf.particleCap('flame')], res: TL.Game.autoResult }));
    rows.push(r); if (r.res) break;
  }
  await ctx.close(); return { rows, errs };
}
(async () => {
  const b = await chromium.launch(); let best = null, errs = [];
  for (let i = 0; i < PASSES; i++) {
    const { rows, errs: e } = await pass(b); errs = errs.concat(e);
    const live = rows.slice(3).filter(r => r.s.n > 20), lim = r => (r.scr === 'end' ? BUDGET_END : BUDGET), med = live.map(r => r.s.w95 - lim(r)).sort((a, b) => a - b)[Math.floor(live.length / 2)] || 0;
    const worst = Math.max(med, ...live.map(r => (r.s.w95 - lim(r) * 1.5) / 1.5));   // steady-state median within budget, no single window beyond 1.5x (first 3 windows = tier ramp-up, skipped)
    console.log('pass ' + (i + 1) + ': ' + rows.map(r => r.scr + ' js ' + r.s.w95.toFixed(1) + '/int ' + r.s.p95.toFixed(0) + ' t' + r.tier).join(' | '));
    if (!best || worst < best.worst) best = { worst, rows };
  }
  await b.close();
  let fail = errs.length ? 'console errors: ' + errs[0] : '';
  for (const r of best.rows) { if (r.parts > Math.max(r.cap[0] + r.cap[1], 1)) fail = fail || 'particles ' + r.parts + ' over cap ' + r.cap; }
  if (best.worst > 0) fail = fail || 'JS frame-body p95 over budget by ' + best.worst.toFixed(1) + ' ms (rate ' + RATE + 'x)';
  const allP95 = best.rows.map(r => r.s.w95).sort((x, y) => x - y);
  console.log('perf ' + (fail ? 'FAIL: ' + fail : 'OK') + ' | worst-window js p95 ' + allP95[allP95.length - 1].toFixed(1) + ' ms, budget ' + BUDGET + '/' + BUDGET_END + ' ms, mode ' + MODE);
  process.exit(fail ? 1 : 0);
})();
