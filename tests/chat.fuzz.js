/* tests/chat.fuzz.js  node tests/chat.fuzz.js : 2000 seeded vans, a heo (single or đôi) on the table and a tứ quý in the player's hand, under every mod set.
 * Asserts Rules.legal offers the chặt (and the scene's selection path accepts it) unless noChat. Prints only failures and one summary line. */
const path = require('path'); const J = f => require(path.join(__dirname, '..', 'js', f));
['config', 'data', 'content', 'cards', 'rules', 'ai'].forEach(J);
const TL = globalThis.TL, C = TL.Cards, R = TL.Rules;
let n = 0, bad = 0;
const ok = (c, m) => { n++; if (!c) { bad++; if (bad < 15) console.log('FAIL: ' + m); } };
const MODS = ['noChat', 'mustBeat', 'oppLeads', 'sameSuitStraight', 'noHeoFinish'];
const key = c => c.cards.join(',');
const rng = TL.makeRng(20241);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// same checks the scene makes in refresh(): detect with the van's mods, then membership in legal plays
function sceneAccepts(st, ids) {
  const c = C.detect(ids, st.mods), leg = R.legal(st, 0);
  return !!c && leg.plays.some(p => key(p) === key(c));
}
for (let i = 0; i < 2000; i++) {
  const mods = {}; MODS.forEach((m, b) => { if ((i >> b) & 1) mods[m] = true; });
  const dbl = i % 2 === 1, qr = Math.floor(rng() * 12), quad = [0, 1, 2, 3].map(s => qr * 4 + s);   // rank 3..A, never the 2s
  const heos = shuffle([48, 49, 50, 51]).slice(0, dbl ? 2 : 1);
  const rest = shuffle(Array.from({ length: 48 }, (_, k) => k).filter(x => !quad.includes(x)));
  const h0 = quad.concat(rest.slice(0, 6)), pool = rest.slice(6);
  const h1 = heos.concat(pool.slice(0, 7));
  const s = R.newVan({ rng: TL.makeRng(i + 1), hands: [h0, h1], mods: mods, leader: 1 });
  if (s.over) continue;                                    // tới trắng on a random deal
  if (s.turn !== 1) { ok(false, 'leader should be seat 1 (mods ' + JSON.stringify(mods) + ')'); continue; }
  const evs = R.play(s, 1, heos);
  if (!evs.length) {                                       // only noHeoFinish with a lone heo may refuse; hand has 7 more cards so it must not
    ok(false, 'opp could not lead heo ' + heos + ' mods ' + JSON.stringify(mods)); continue;
  }
  if (s.over) continue;
  const lg = R.legal(s, 0), chat = lg.plays.find(p => key(p) === key(C.detect(quad)));
  const label = 'quad ' + qr + (dbl ? ' vs doi heo' : ' vs heo') + ' mods ' + JSON.stringify(mods);
  if (mods.noChat) {
    ok(!chat, 'noChat but chặt offered, ' + label);
    ok(!sceneAccepts(s, quad), 'noChat but scene accepts chặt, ' + label);
    ok(R.play(s, 0, quad).length === 0, 'noChat but play() allowed chặt, ' + label);
  } else {
    ok(!!chat, 'chặt missing from legal, ' + label);
    ok(sceneAccepts(s, quad), 'scene rejects chặt, ' + label);
    const p0 = s.pot, ev = R.play(s, 0, quad);
    ok(ev.length > 0 && ev.some(e => e.type === 'chat'), 'play() refused chặt, ' + label);
    ok(s.pot >= p0, 'pot after chặt, ' + label);
  }
}
console.log('chat.fuzz: ' + n + ' checks, ' + bad + ' failed');
process.exit(bad ? 1 : 0);
