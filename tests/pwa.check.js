/* tests/pwa.check.js  node tests/pwa.check.js : manifest fields, icons exist, sw.js is current. */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const root = path.join(__dirname, '..'); let bad = 0;
const ok = (c, m) => { if (!c) { bad++; console.log('FAIL: ' + m); } };
const m = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
ok(m.name === 'Chiếu Trên', 'name'); ok(m.display === 'fullscreen', 'display'); ok(m.orientation === 'any', 'orientation');
ok(m.start_url === './' && m.scope === './', 'start_url/scope must be relative for the /chieu-tren/ subpath');
ok(m.theme_color === '#1B1412' && m.background_color === '#1B1412', 'colours');
ok(m.icons.some(i => i.sizes === '192x192') && m.icons.some(i => i.sizes === '512x512' && i.purpose === 'any') && m.icons.some(i => i.purpose === 'maskable'), 'icons');
m.icons.forEach(i => ok(fs.existsSync(path.join(root, i.src)), 'icon file ' + i.src));
ok(/rel="manifest"/.test(fs.readFileSync(path.join(root, 'index.html'), 'utf8')), 'index.html links the manifest');
const r = cp.spawnSync('node', [path.join(root, 'tools', 'build-pwa.js'), '--check'], { encoding: 'utf8' });
ok(r.status === 0, 'sw.js stale: ' + r.stdout);
console.log(bad ? bad + ' failed' : 'ok: pwa checks passed'); process.exit(bad ? 1 : 0);
