/* tests/headless.js  node tests/headless.js [seed=1] [extra query] : headless Chromium runs index.html?auto&seed=N to the end screen; fails on console errors. */
const path = require('path'); const { chromium } = require('playwright');
(async () => {
  const seed = process.argv[2] || '1', extra = process.argv[3] || '';
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1280, height: 720 } }), errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push('pageerror ' + e.message));
  await p.goto('file://' + path.join(__dirname, '..', 'index.html') + '?auto&seed=' + seed + extra);
  let res = null; const t0 = Date.now();
  while (Date.now() - t0 < (+process.env.CAP || 170000)) { res = await p.evaluate(() => globalThis.TL && TL.Game && TL.Game.autoResult || null); if (res) break; await p.waitForTimeout(500); }
  const st = await p.evaluate(() => TL.Game && TL.Game.run ? [TL.Game.run.chang, TL.Game.run.ban, TL.Game.run.phase] : null).catch(() => null); console.log('seed ' + seed + ' at ' + JSON.stringify(st) + ' result: ' + JSON.stringify(res && res.result) + ' errors: ' + errs.length); errs.slice(0, 5).forEach(e => console.log('  ' + e));
  await b.close(); process.exit(res && !errs.length ? 0 : 1);
})();
