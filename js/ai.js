/* js/ai.js  (owner RULES) opponent. Pure logic, no DOM; uses only the View. Needs config, cards.
 * API
 *   TL.AI.choose(view, level 1-3, rng?) -> {type:'play', cardIds} | {type:'pass'}
 *     cardIds always come from view.legal; pass only when view.canPass. Params: CFG.AI[level].
 *     rng is optional: default is a deterministic rng seeded from the view (same view -> same move).
 *     mods.noHeoFinish: dumps its heo while other cards remain (never holds them), so it is not stuck with a lone heo
 *   TL.AI.strength(hand) -> 1|2|3  Suc bai stars (CFG.SUC_BAI); 1 = Bai xau
 *   TL.AI.plan(hand) -> Combo[]  groups (sanh, đôi thông, tứ quý, sám, đôi, rác) with the fewest groups / least rác
 */
(function (TL) {
  'use strict';
  const C = TL.Cards, CFG = TL.CFG;
  const key = c => c.cards.join(','), bomb = c => c.type === 'tuquy' || c.type === 'doithong', hasHeo = c => c.cards.some(C.isHeo);
  const cost = g => g.length + 0.1 * g.filter(c => c.type === 'rac').length;

  function sanhs(by, g) {                     // take the longest run of ranks (no heo) repeatedly, one card per rank
    for (;;) {
      let best = null;
      for (let s = 0, e; s < 12; s = Math.max(e, s + 1)) {
        e = s; while (e < 12 && by[e].length) e++;
        if (e - s >= 3 && (!best || e - s > best[1] - best[0])) best = [s, e];
      }
      if (!best) return;
      g.push(C.detect(by.slice(best[0], best[1]).map(a => a.shift())));
    }
  }

  function planWith(hand, sanhFirst) {
    const by = Array.from({ length: 13 }, () => []), g = [];
    hand.forEach(x => by[x >> 2].push(x));
    by.forEach((a, r) => { if (a.length === 4) { g.push(C.detect(a)); by[r] = []; } });
    for (let s = 0, e; s < 12; s = Math.max(e, s + 1)) {
      e = s; while (e < 12 && by[e].length >= 2) e++;
      if (e - s >= 3) g.push(C.detect(by.slice(s, e).flatMap(a => a.splice(0, 2))));
    }
    if (!sanhFirst) by.forEach((a, r) => { if (a.length >= 2) { g.push(C.detect(a)); by[r] = []; } });
    sanhs(by, g);
    by.forEach(a => { if (a.length) g.push(C.detect(a)); });
    return g;
  }
  const plan = hand => { const a = planWith(hand, false), b = planWith(hand, true); return cost(a) <= cost(b) ? a : b; };

  function choose(v, level, rng) {
    const P = CFG.AI[level] || CFG.AI[1], plays = v.legal, PASS = { type: 'pass' };
    rng = rng || TL.makeRng(v.hand.reduce((h, x) => (h * 31 + x + 1) >>> 0, v.pot * 7 + v.played.length + 1));
    const mv = c => ({ type: 'play', cardIds: c.cards.slice() });
    if (!plays.length) return PASS;
    const fin = plays.find(c => c.len === v.hand.length);
    if (fin) return mv(fin);
    if (rng() < P.mistake) { const i = Math.floor(rng() * (plays.length + (v.canPass ? 1 : 0))); return i < plays.length ? mv(plays[i]) : PASS; }
    const g = plan(v.hand), urgent = v.oppCount <= 3;
    const noHeo = !!(v.mods && v.mods.noHeoFinish), heoLeft = v.hand.filter(C.isHeo).length;
    if (noHeo && heoLeft && v.hand.length - heoLeft <= 2) {     // running out of other cards: spend a heo now
      const h = plays.filter(c => hasHeo(c) && c.len < v.hand.length && c.type !== 'tuquy').sort((a, b) => a.len - b.len || a.top - b.top)[0];
      if (h) return mv(h);
    }

    if (v.lead) {
      let pool = g.filter(c => !bomb(c) && !hasHeo(c));
      if (!pool.length) pool = g.filter(c => !bomb(c));
      if (!pool.length) pool = g;
      if (P.track) {                          // keep winners (nothing unseen can beat their rank) for later
        const seen = new Set(v.hand.concat(v.played)); let maxU = -1;
        for (let i = 0; i < 52; i++) if (!seen.has(i)) maxU = Math.max(maxU, i >> 2);
        const nm = pool.filter(c => (c.top >> 2) <= maxU);
        if (nm.length) pool = nm;
      }
      pool = pool.slice().sort((a, b) => a.top - b.top);
      let pick;
      if (urgent) { const m = pool.filter(c => c.len > v.oppCount); pick = m.length ? m[0] : pool[pool.length - 1]; }
      else pick = rng() < P.leadLow ? pool[0] : pool[Math.floor(rng() * pool.length)];
      return mv(plays.find(c => key(c) === key(pick)) || plays[0]);
    }

    const heavyOK = urgent || v.pot >= P.chatMinPot;
    const cand = plays.filter(c => bomb(c) ? heavyOK : hasHeo(c) ? heavyOK || noHeo || rng() >= P.heoHold : true);
    if (!cand.length) return v.canPass ? PASS : mv(plays[0]);
    const after = c => cost(plan(v.hand.filter(x => !c.cards.includes(x))));
    let pick = cand[0], best = after(pick);
    cand.forEach(c => { const a = after(c); if (a < best - 1e-9) { pick = c; best = a; } });
    const intact = g.some(c => key(c) === key(pick));
    if (!intact && v.canPass && !urgent && v.pot <= P.chatMinPot + 100 && rng() < P.passBias) return PASS;
    return mv(pick);
  }

  function strength(hand) {                   // Suc bai: 1-3 stars from the planner (fewer groups, more control = better)
    const g = plan(hand), W = CFG.SUC_BAI, ctl = g.filter(bomb).length + hand.filter(C.isHeo).length, sc = g.length - W.CTL_W * ctl;
    return sc <= W.STAR3 ? 3 : sc >= W.STAR1 ? 1 : 2;
  }

  TL.AI = { choose: choose, plan: plan, strength: strength };
})(globalThis.TL = globalThis.TL || {});
