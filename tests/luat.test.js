/* tests/luat.test.js  "Luật bài" pages agree with the real rules (marks come from Cards.detect/beats), texts exist, ids valid. */
const fs = require('fs'), vm = require('vm'), path = require('path'); const assert = require('assert');
const ctx = { TL: {}, console, Math, localStorage: { getItem() { return null; }, setItem() {} } }; ctx.globalThis = ctx; vm.createContext(ctx);
for (const f of ['config', 'data', 'cards', 'luat']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'), ctx, { filename: f });
const TL = ctx.TL, C = TL.Cards, P = TL.Luat._pages();
assert.strictEqual(P.length, 9, '9 pages'); assert.strictEqual(TL.DATA.TEXT.luat.pages.length, 9);
P.forEach(p => { assert(p.title && p.say, p.k + ' has text'); assert(p.say.length <= 100, p.k + ' say short: ' + p.say.length);
  p.groups.forEach(g => { (g.cards || []).forEach(id => assert(Number.isInteger(id) && id >= 0 && id < 52, p.k + ' card id ' + id)); if (g.say) assert(g.say.length <= 90); }); });
const by = k => P.find(p => p.k === k);
const want = { sanh: [true, true, false, false], doiThong: [true, true, false, false] };
['sanh', 'doiThong'].forEach(k => by(k).groups.forEach((g, i) => assert.strictEqual(!!C.detect(g.cards) && C.detect(g.cards).type === g.want, want[k][i], k + ' group ' + i)));
const de = by('de'); const J = JSON.stringify; assert.strictEqual(J(de.groups.slice(1).map(g => g.ok)), J([true, false, false]));
const bo = by('bo').groups.map(g => C.detect(g.cards).type); assert.strictEqual(J(bo), J(['rac', 'doi', 'sam', 'tuquy']));
const ch = by('chatHeo').groups, t = ch.filter(g => g.target), z = ch.filter(g => g.chat);
const m = z.map(c => t.map(x => C.beats(C.detect(c.cards), C.detect(x.cards)) === 'chat'));
assert.strictEqual(J(m), J([[true, true, true], [true, false, false], [true, true, true]]), 'chặt table');
assert.strictEqual(TL.Luat._cmp(12 * 4, 3 * 4), '2 lớn hơn 6.');
assert.strictEqual(TL.Luat._cmp(4, 7), '4 cơ lớn hơn 4 bích.');
console.log('luat.test ok');
