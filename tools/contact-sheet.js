/* tools/contact-sheet.js  node tools/contact-sheet.js out.png [scale=3] [opp|qn=opp] : draws every R5 portrait (opp = 13 opponents/bosses, qn = 33 Quý nhân + Báu vật cards) at 1x and Nx on one sheet (Playwright). */
const path = require('path'), { chromium } = require('playwright');
(async () => {
  const out = process.argv[2] || 'contact.png', S = +process.argv[3] || 3, which = process.argv[4] || 'opp', root = path.join(__dirname, '..');
  const br = await chromium.launch(), pg = await br.newPage({ viewport: { width: 1000, height: 520 } });
  await pg.setContent('<body style="margin:0;background:#2a1a14"><canvas id=c></canvas></body>');
  for (const f of ['config', 'data', 'content', 'art', 'art2', 'art3', 'art4', 'art5']) await pg.addScriptTag({ path: path.join(root, 'js', f + '.js') });
  await pg.evaluate(async ([S, which]) => {
    await TL.Art.init(); const qn = which === 'qn', ids = qn ? TL.Art._ids5 : TL.Art._ids4, fn = qn ? 'quyNhan' : 'portrait', H = qn ? 64 : 48;
    const c = document.getElementById('c'), cols = qn ? 6 : 5, cw = 48 * S + 16, ch = H * S + H + 30; c.width = cols * cw; c.height = Math.ceil(ids.length / cols) * ch;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    ids.forEach((id, i) => { const px = (i % cols) * cw + 8, py = Math.floor(i / cols) * ch + 8; x.drawImage(TL.Art[fn](id), px, py, 48 * S, H * S); x.drawImage(TL.Art[fn](id), px, py + H * S + 4, 48, H); x.fillStyle = '#fff'; x.font = '12px sans-serif'; x.fillText(id, px + 56, py + H * S + 30); });
  }, [S, which]);
  await pg.locator('#c').screenshot({ path: out }); await br.close();
})();
