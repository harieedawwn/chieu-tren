/* tools/profile.js  node tools/profile.js [rate=6] [seconds=12] [url-extra]  CPU-profile the auto-run at 915x412 DPR3 and print the top self-time functions (ms) + frame-body cost. */
const path = require('path'); const { chromium } = require('playwright');
(async () => {
  const rate = +process.argv[2] || 6, secs = +process.argv[3] || 12, extra = process.argv[4] || '';
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 915, height: 412 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  const p = await ctx.newPage(), c = await ctx.newCDPSession(p);
  await p.goto('file://' + path.join(__dirname, '..', 'index.html') + '?auto&seed=1&perf' + extra);
  await p.waitForFunction(() => window.__ready); await c.send('Emulation.setCPUThrottlingRate', { rate });
  await c.send('Profiler.enable'); await c.send('Profiler.start'); await p.waitForTimeout(secs * 1000);
  const { profile } = await c.send('Profiler.stop'), self = {}, byId = {}; profile.nodes.forEach(n => byId[n.id] = n);
  const dt = profile.timeDeltas; profile.samples.forEach((id, i) => { const f = byId[id].callFrame, k = f.functionName + ' ' + f.url.split('/').pop() + ':' + f.lineNumber; self[k] = (self[k] || 0) + dt[i] / 1000; });
  // inclusive time per function
  const parent = {}; profile.nodes.forEach(n => (n.children || []).forEach(ch => parent[ch] = n.id)); const inc = {};
  profile.samples.forEach((id, i) => { const seen = new Set(); for (let n = id; n; n = parent[n]) { const f = byId[n].callFrame, k = f.functionName + ' ' + f.url.split('/').pop() + ':' + f.lineNumber; if (!seen.has(k)) { seen.add(k); inc[k] = (inc[k] || 0) + dt[i] / 1000; } } });
  console.log('--- inclusive');
  Object.entries(inc).filter(e => /\.js/.test(e[0])).sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([k, v]) => console.log(v.toFixed(0).padStart(6) + ' ms  ' + k));
  console.log('--- self');
  const tot = Object.values(self).reduce((a, v) => a + v, 0);
  Object.entries(self).sort((a, b) => b[1] - a[1]).slice(0, 18).forEach(([k, v]) => console.log((v / tot * 100).toFixed(1).padStart(5) + '%  ' + v.toFixed(0).padStart(6) + ' ms  ' + k));
  await b.close();
})();
