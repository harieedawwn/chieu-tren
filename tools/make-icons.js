/* tools/make-icons.js  node tools/make-icons.js : renders assets/icon-192.png, icon-512.png and icon-maskable-512.png from the game's own art
 * (heo cơ card + Ông Táo portrait on đen son with a vàng kim frame, integer scale, no smoothing). Needs Playwright + Chromium. */
const path = require('path'), fs = require('fs'); const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  await p.goto('file://' + path.join(__dirname, '..', 'index.html')); await p.waitForFunction(() => window.__ready, null, { timeout: 20000 });
  const out = await p.evaluate(() => {
    const A = TL.Art, P = TL.CFG.PAL, card = A.card(51), por = A.portrait('ong_tao');
    function icon(n, safe) {   // safe = fraction of the icon that holds the art (maskable keeps it inside the 80% safe zone)
      const c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
      x.fillStyle = P.denSon; x.fillRect(0, 0, n, n);
      const u = Math.max(1, Math.floor(n * safe / 64)), m = Math.round(n * (1 - safe) / 2);
      if (!safe || safe > 0.85) { const f = Math.max(2, Math.round(n / 48)); x.fillStyle = P.vangKim; x.fillRect(f * 2, f * 2, n - f * 4, f); x.fillRect(f * 2, n - f * 3, n - f * 4, f); x.fillRect(f * 2, f * 2, f, n - f * 4); x.fillRect(n - f * 3, f * 2, f, n - f * 4); }
      const cw = card.width * u, ch = card.height * u, cx = Math.round((n - cw) / 2), cy = Math.round((n - ch) / 2);
      x.fillStyle = P.doSon; x.fillRect(cx - u * 2, cy - u * 2, cw + u * 4, ch + u * 4);
      x.drawImage(card, cx, cy, cw, ch);
      return c.toDataURL('image/png');
    }
    return { a192: icon(192, 0.9), a512: icon(512, 0.9), m512: icon(512, 0.62), cw: card.width, ch: card.height, pw: por.width };
  });
  const w = (f, d) => fs.writeFileSync(path.join(__dirname, '..', 'assets', f), Buffer.from(d.split(',')[1], 'base64'));
  w('icon-192.png', out.a192); w('icon-512.png', out.a512); w('icon-maskable-512.png', out.m512);
  console.log('icons written (card ' + out.cw + 'x' + out.ch + ')'); await b.close();
})();
