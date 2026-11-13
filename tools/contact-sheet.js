/* tools/contact-sheet.js  node tools/contact-sheet.js out.png [scale=3] : draws every R5 portrait at 1x and Nx on one sheet (Playwright). */
const path = require('path'), { chromium } = require('playwright');
(async () => {
  const out = process.argv[2] || 'contact.png', S = +process.argv[3] || 3, root = path.join(__dirname, '..');
  const br = await chromium.launch(), pg = await br.newPage({ viewport: { width: 1000, height: 520 } });
  await pg.setContent('<body style="margin:0;background:#2a1a14"><canvas id=c></canvas></body>');
  for (const f of ['config', 'data', 'content', 'art', 'art2', 'art3', 'art4']) await pg.addScriptTag({ path: path.join(root, 'js', f + '.js') });
  await pg.evaluate(async S => {
    await TL.Art.init(); const ids = TL.Art._ids4, c = document.getElementById('c'), cols = 5, cell = 48 * S + 16;
    c.width = cols * cell; c.height = Math.ceil(ids.length / cols) * (48 * S + 56); const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    ids.forEach((id, i) => { const px = (i % cols) * cell + 8, py = Math.floor(i / cols) * (48 * S + 56) + 8; x.drawImage(TL.Art.portrait(id), px, py, 48 * S, 48 * S); x.drawImage(TL.Art.portrait(id), px, py + 48 * S + 4, 48, 48); x.fillStyle = '#fff'; x.font = '12px sans-serif'; x.fillText(id, px + 56, py + 48 * S + 30); });
  }, S);
  await pg.locator('#c').screenshot({ path: out }); await br.close();
})();
