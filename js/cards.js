/* js/cards.js  (owner RULES) deck, combos, beats. Pure logic, no DOM.
 * API  (card id 0-51, rank = id>>2 (0..12 = 3..A,2), suit = id&3 (♠♣♦♥); Combo = {type, cards asc, top, len})
 *   TL.Cards.makeDeck()                  -> [{id, rank, suit}] x 52
 *   TL.Cards.label(id)                   -> "10♦"
 *   TL.Cards.sortHand(ids, 'rank'|'suit')-> new sorted array
 *   TL.Cards.isHeo(id)                   -> true for any 2
 *   TL.Cards.detect(ids)                 -> Combo | null (rac doi sam tuquy sanh doithong; null on dupes/heo in runs)
 *   TL.Cards.beats(combo, onTable, mods) -> false | 'beat' | 'chat'; onTable null = leading; mods.noChat blocks 'chat'
 *   TL.Cards.legalPlays(hand, onTable, mods) -> Combo[] every distinct playable combo, weakest first, chat last
 */
(function (TL) {
  'use strict';
  const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'], SUITS = '♠♣♦♥';
  const asc = (a, b) => a - b;
  const isHeo = id => (id >> 2) === 12;
  const makeDeck = () => Array.from({ length: 52 }, (_, id) => ({ id: id, rank: id >> 2, suit: id & 3 }));
  const label = id => RANKS[id >> 2] + SUITS[id & 3];
  const sortHand = (ids, mode) => ids.slice().sort(mode === 'suit' ? (a, b) => (a & 3) - (b & 3) || a - b : asc);
  const mk = (type, c) => ({ type: type, cards: c, top: c[c.length - 1], len: c.length });

  function detect(ids) {
    if (!Array.isArray(ids) || !ids.length) return null;
    const c = ids.slice().sort(asc), n = c.length, r = c.map(x => x >> 2);
    if (c.some((x, i) => !Number.isInteger(x) || x < 0 || x > 51 || (i && x === c[i - 1]))) return null;
    if (n <= 4 && r.every(x => x === r[0])) return mk(['', 'rac', 'doi', 'sam', 'tuquy'][n], c);
    if (r.includes(12)) return null;
    if (n >= 3 && r.every((x, i) => x === r[0] + i)) return mk('sanh', c);
    if (n >= 6 && n % 2 === 0 && r.every((x, i) => x === r[0] + (i >> 1))) return mk('doithong', c);
    return null;
  }

  function beats(c, t, mods) {
    if (!t) return 'beat';
    const single = t.type === 'rac' || t.type === 'doi', heoT = single && isHeo(t.top), dt3 = t.type === 'doithong' && t.len === 6;
    let r = false;
    if (c.type === t.type && c.len === t.len && c.top > t.top) r = c.type === 'tuquy' ? 'chat' : 'beat';
    else if (c.type === 'tuquy') r = heoT || dt3 ? 'chat' : false;
    else if (c.type === 'doithong' && c.len >= 8) r = heoT || dt3 || t.type === 'tuquy' ? 'chat' : false;
    else if (c.type === 'doithong' && c.len === 6) r = t.type === 'rac' && heoT ? 'chat' : false;
    return r === 'chat' && mods && mods.noChat ? false : r;
  }

  const comb = (a, k) => k === 0 ? [[]] : a.length < k ? [] : comb(a.slice(1), k - 1).map(x => [a[0]].concat(x)).concat(comb(a.slice(1), k));
  const prod = ls => ls.reduce((acc, l) => acc.flatMap(p => l.map(x => p.concat(x))), [[]]);

  function legalPlays(hand, t, mods) {
    const by = Array.from({ length: 13 }, () => []), sets = [];
    hand.slice().sort(asc).forEach(x => by[x >> 2].push(x));
    by.forEach(a => { for (let k = 1; k <= 4; k++) sets.push(...comb(a, k)); });
    for (let s = 0; s < 12; s++) for (let e = s; e < 12 && by[e].length; e++) if (e - s >= 2) sets.push(...prod(by.slice(s, e + 1)));
    for (let s = 0; s < 12; s++) {
      for (let e = s; e < 12 && by[e].length >= 2; e++) if (e - s >= 2) sets.push(...prod(by.slice(s, e + 1).map(a => comb(a, 2))));
    }
    const out = [];
    sets.forEach(ids => { const c = detect(ids), k = c && beats(c, t, mods); if (k) out.push({ c: c, w: k === 'chat' ? 2 : c.type === 'tuquy' || c.type === 'doithong' ? 1 : 0 }); });
    return out.sort((a, b) => a.w - b.w || a.c.len - b.c.len || a.c.top - b.c.top).map(o => o.c);
  }

  TL.Cards = { makeDeck: makeDeck, label: label, sortHand: sortHand, detect: detect, beats: beats, legalPlays: legalPlays, isHeo: isHeo };
})(globalThis.TL = globalThis.TL || {});
