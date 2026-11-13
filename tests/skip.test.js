/* tests/skip.test.js  FX.skipTap: first tap fast-forwards (eased, <0.3 s to full 8x), second tap jumps to the end state; results identical. */
const fs = require('fs'), vm = require('vm'), path = require('path'); const assert = require('assert');
const ctx = { TL: {}, console, Math }; ctx.globalThis = ctx; vm.createContext(ctx);
for (const f of ['config', 'fx']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8'), ctx, { filename: f });
const FX = ctx.TL.FX;
function run(mode) {
  FX.reset(); const log = [], o = { v: 0 };
  FX.queue.add(() => { log.push('a'); return 1; }, 0.5); FX.queue.add(() => { log.push('b'); FX.tween(o, { v: 10 }, 2, 'out'); return 2; }, 1); FX.queue.add(() => { log.push('c'); return 0; }, 0.5);
  FX.after(3, () => log.push('t'));
  let t = 0;
  if (mode === 'none') { while (FX.queue.busy() && t < 60) { FX.update(0.05); t += 0.05; } while (o.v < 10 && t < 60) { FX.update(0.05); t += 0.05; } return { log: log, v: o.v, t: t }; }
  FX.update(0.05); assert(FX.skipTap(), 'busy -> consumed');
  if (mode === 'ff') { for (let i = 0; i < 6; i++) FX.update(0.05); assert(FX.turbo > 7.5, 'eased to ~8x within 0.3 s: ' + FX.turbo); t = 0.35; while ((FX.queue.busy() || o.v < 10) && t < 60) { FX.update(0.05); t += 0.05; } }
  else { FX.update(0.05); assert(FX.skipTap()); assert(!FX.queue.busy(), 'second tap flushes the queue'); }
  return { log: log, v: o.v, t: t };
}
const a = run('none'), b = run('ff'), c = run('flush');
assert.deepStrictEqual(b.log.sort(), a.log.sort()); assert.deepStrictEqual(c.log.sort(), a.log.sort()); assert.strictEqual(b.v, 10); assert.strictEqual(c.v, 10);
assert(b.t < a.t / 2, 'fast-forward is faster: ' + b.t + ' vs ' + a.t);
FX.reset(); assert(!FX.skipTap(), 'idle -> not consumed'); assert.strictEqual(FX.turbo, 1);
console.log('skip.test ok');
