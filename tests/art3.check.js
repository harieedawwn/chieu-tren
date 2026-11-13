// node tests/art3.check.js : every art3 buffer has the right size and only palette chars (no DOM needed)
globalThis.TL = {};
['config', 'data', 'content', 'art', 'art2', 'art3'].forEach(f => require('../js/' + f + '.js'));
const A = TL.Art, SZ = { qn: [48, 64], opp: [48, 48], que: [48, 64], pack: [48, 64] }; let bad = 0, n = 0;
['qn'].forEach(function (kind) {
  A._ids3.forEach(function (id) {
    const b = A._buf3(id); n++;
    if (b.w !== SZ[kind][0] || b.h !== SZ[kind][1]) { bad++; console.log('SIZE', kind, id, b.w, b.h); }
    if (b.d.length !== b.w * b.h) { bad++; console.log('LEN', kind, id); }
    for (let y = 0; y < b.h; y++) { let c = 0; for (let x = 0; x < b.w; x++) { const ch = b.d[y * b.w + x]; if (A._chars.indexOf(ch) < 0) { bad++; console.log('CHAR', kind, id, 'row', y, JSON.stringify(ch)); } if (ch !== '.') c++; } if (!c && kind !== 'qn') { /* transparent rows only allowed outside */ } }
    for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) { const ch = b.d[y * b.w + x]; if (ch === undefined) { bad++; console.log('HOLE', kind, id, x, y); } }
    // name bar must be blank-ready: x5-42 y47-58 filled with R / G edge
    for (let y = 47; y <= 58; y++) for (let x = 5; x <= 42; x++) { const ch = b.d[y * b.w + x]; if (ch !== 'R' && ch !== 'G') { bad++; console.log('BAR', kind, id, x, y, ch); y = 99; break; } }
  });
});
if (n !== 13) { bad++; console.log('want 13 buffers'); }
console.log(n + ' art3 buffers checked, ' + bad + ' problems'); process.exit(bad ? 1 : 0);
