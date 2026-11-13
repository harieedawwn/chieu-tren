/* tools/make-icons.js  node tools/make-icons.js : renders assets/icon-192.png, icon-512.png and icon-maskable-512.png from the game's own art
 * (A.logoIcon from js/logo.js, integer scale, no smoothing). Needs Playwright + Chromium. */
const path = require('path'), fs = require('fs'); const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  await p.goto('file://' + path.join(__dirname, '..', 'index.html')); await p.waitForFunction(() => window.__ready, null, { timeout: 20000 });
  const out = await p.evaluate(() => {
    const A = TL.Art, P = TL.CFG.PAL, card = A.card(51), por = A.portrait('ong_tao');
    const icon = (n, safe) => A.logoIcon(n, safe).toDataURL('image/png');
    const small = n => { const c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d'); x.fillStyle = TL.CFG.PAL.denSon; if (n > 64) x.fillRect(0, 0, n, n); x.drawImage(A.logoAt(n), 0, 0); return c.toDataURL('image/png'); };
    return { f32: small(32), f64: small(64), t180: small(180), a192: icon(192, 1), a512: icon(512, 0.94), m512: icon(512, 0.7), cw: 96, ch: 96, pw: 0 };
  });
  const w = (f, d) => fs.writeFileSync(path.join(__dirname, '..', 'assets', f), Buffer.from(d.split(',')[1], 'base64'));
  w('icon-192.png', out.a192); w('icon-512.png', out.a512); w('icon-maskable-512.png', out.m512);
  w('favicon-32.png', out.f32); w('favicon-64.png', out.f64); w('apple-touch-icon.png', out.t180);
  console.log('icons written (card ' + out.cw + 'x' + out.ch + ')'); await b.close();
})();
