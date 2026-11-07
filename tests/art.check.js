// node tests/art.check.js : every grid row has the declared width and only palette chars
globalThis.TL = {};
require('../js/config.js'); require('../js/data.js'); require('../js/art.js');
const A = TL.Art; let bad = 0, n = 0;
Object.keys(A._grids).forEach(function (k) {
  const g = A._grids[k]; n++;
  g.rows.forEach(function (r, i) {
    if (r.length !== g.w) { bad++; console.log('WIDTH', k, 'row', i, 'is', r.length, 'want', g.w, JSON.stringify(r)); }
    for (const ch of r) if (A._chars.indexOf(ch) < 0) { bad++; console.log('CHAR', k, 'row', i, JSON.stringify(ch)); }
  });
});
console.log(n + ' grids checked, ' + bad + ' problems');
process.exit(bad ? 1 : 0);
