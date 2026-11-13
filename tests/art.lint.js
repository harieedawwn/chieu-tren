// node tests/art.lint.js : R5 portrait lint. Every 32x40 figure has the declared size and only palette chars, the K outline is closed
// (no coloured pixel touches transparency, except the bottom row that the frame crops), and there are no stray single pixels
// (a pixel with no 8-neighbour of its own colour) unless the figure marked it as a deliberate highlight (b._ok).
globalThis.TL = {};
['config', 'data', 'content', 'art', 'art2', 'art3', 'art4'].forEach(f => require('../js/' + f + '.js'));
const A = TL.Art; let bad = 0;
const W = 32, H = 40, T = new Set(['.KNRGBPLXY']);
A._ids4.forEach(function (id) {
  const b = A._fig4(id), ok = new Set((b._ok || []).map(p => p[0] + ',' + p[1])), at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? '.' : b.d[y * W + x];
  if (b.w !== W || b.h !== H) { bad++; console.log('SIZE', id, b.w, b.h); return; }
  const p = A._buf4(id); if (p.w !== 48 || p.h !== 48) { bad++; console.log('PORTRAIT SIZE', id); }
  let filled = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = at(x, y);
    if (A._chars.indexOf(c) < 0) { bad++; console.log('CHAR', id, x, y, JSON.stringify(c)); continue; }
    if (c === '.') continue;
    filled++;
    if (c !== 'K') for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + d[0], ny = y + d[1];
      if (ny >= H) continue;                                    // bottom rows are cropped by the frame
      if (at(nx, ny) === '.') { bad++; console.log('OPEN OUTLINE', id, x, y, c); break; }
    }
    let same = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if ((i || j) && at(x + i, y + j) === c) same++;
    if (!same && !ok.has(x + ',' + y)) { bad++; console.log('STRAY PIXEL', id, x, y, c); }
  }
  if (filled < 400) { bad++; console.log('TOO EMPTY', id, filled); }
});
console.log(A._ids4.length + ' portraits linted, ' + bad + ' problems'); process.exit(bad ? 1 : 0);
