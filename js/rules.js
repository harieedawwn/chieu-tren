/* js/rules.js  (owner RULES) ván engine, SPEC §5 and §8. Pure logic, no DOM, randomness only via opts.rng. Needs config, cards.
 * API  (state = VanState per SPEC §4; every call mutates state and appends the returned events to state.log)
 *   TL.Rules.newVan({rng, handSize?, leader?, mods, scoreFn, hands?}) -> VanState  (initial events already in state.log)
 *   TL.Rules.play(state, seat, cardIds) -> Event[]   [] and no change if illegal (turn, hand, combo, beat, noChat)
 *   TL.Rules.pass(state, seat)          -> Event[]   [] and no change if illegal (leader, mustBeat, turn)
 *   TL.Rules.legal(state, seat)         -> {plays: Combo[], canPass}   empty when not seat's turn or ván over
 *   TL.Rules.view(state, seat)          -> View (own hand only; no hands/log); legal/canPass filled on seat's turn
 *   TL.Rules.winner(state)              -> 0 | 1 | null
 *   TL.Rules.swap(state, seat, cardIds, rng) -> Event[]  {type:'swap', seat, out, in}; swaps 1..3 own cards with cards not dealt this ván; own turn only; [] if illegal
 * mods: passMax (seat 0 may pass at most this many times a ván while it has a legal play; set by Run for Vua Bài), noChat, mustBeat, oppLeads, sameSuitStraight (sảnh needs one suit), noHeoFinish (last play may not contain a heo), twoVans (read by Run)
 * state.reveal = [bool, bool]: reveal[seat] true -> view(state, seat).oppHand (only then present) = the opponent's whole hand; both cleared when a hũ is taken (event 'vong').
 * state.peek = id[] opponent cards shown by Thầy bói (set by Run.startVan, else []).
 * scoreFn(seat, combo, {chat, target, pot, lead}) -> Score; rules adds score.total to the pot and applies the chặt multiplier.
 */
(function (TL) {
  'use strict';
  const C = TL.Cards, CFG = TL.CFG, asc = (a, b) => a - b;
  const heoN = h => h.filter(C.isHeo).length;
  const emit = (s, evs) => { s.log.push(...evs); return evs; };
  const zero = () => ({ diem: 0, the: 0, total: 0, steps: [] });

  function vanEnd(s, w, pot, tt) {
    s.over = true; s.winner = w; s.pot = 0;
    return { type: 'vanEnd', winner: w, left: [s.hands[0].length, s.hands[1].length], heo: [heoN(s.hands[0]), heoN(s.hands[1])],
      cong: s.plays[1 - w] === 0, toiTrang: tt, pot: pot };
  }

  function newVan(o) {
    const n = o.handSize || CFG.HAND_SIZE, d = Array.from({ length: 52 }, (_, i) => i), mods = o.mods || {};
    if (!o.hands) for (let i = 51; i > 0; i--) { const j = Math.floor(o.rng() * (i + 1)); const t = d[i]; d[i] = d[j]; d[j] = t; }
    const hands = o.hands ? [o.hands[0].slice().sort(asc), o.hands[1].slice().sort(asc)] : [d.slice(0, n).sort(asc), d.slice(n, 2 * n).sort(asc)];   // o.hands = fixed deal (tutorial)
    const low = Math.min(...hands[0], ...hands[1]);
    const leader = mods.oppLeads ? 1 : o.leader === 0 || o.leader === 1 ? o.leader : hands[0].includes(low) ? 0 : 1;
    const s = { hands: hands, table: null, vongPlays: [], pot: 0, turn: leader, leader: leader, mods: mods, plays: [0, 0], played: [],
      log: [], passes: [0, 0], over: false, winner: null, toiTrang: null, reveal: [false, false], peek: [], scoreFn: o.scoreFn || zero };
    const evs = [{ type: 'deal', hands: [hands[0].slice(), hands[1].slice()], leader: leader }];
    const quad = hands.findIndex(h => [48, 49, 50, 51].every(x => h.includes(x)));
    if (quad >= 0) {
      s.toiTrang = quad;
      evs.push({ type: 'toiTrang', seat: quad, cards: [48, 49, 50, 51] }, vanEnd(s, quad, 0, true));
    } else evs.push({ type: 'turn', seat: leader, lead: true });
    emit(s, evs);
    return s;
  }

  function legal(s, seat) {
    if (s.over || s.turn !== seat) return { plays: [], canPass: false };
    const plays = C.legalPlays(s.hands[seat], s.table && s.table.combo, s.mods);
    const capped = s.mods.passMax !== undefined && seat === 0 && s.passes[0] >= s.mods.passMax && plays.length > 0;
    return { plays: plays, canPass: !!s.table && !(s.mods.mustBeat && plays.length > 0) && !capped };
  }

  function play(s, seat, ids) {
    if (s.over || s.turn !== seat) return [];
    const c = C.detect(ids, s.mods);
    if (!c || !c.cards.every(x => s.hands[seat].includes(x))) return [];
    const t = s.table && s.table.combo, k = C.beats(c, t, s.mods);
    if (!k) return [];
    if (s.mods.noHeoFinish && C.finishesWithHeo(c, s.hands[seat]) && !C.legalPlays(s.hands[seat], t, s.mods).some(x => x.cards.join() === c.cards.join())) return [];
    const chat = k === 'chat', sc = s.scoreFn(seat, c, { chat: chat, target: t, pot: s.pot, lead: !t, last: s.hands[seat].length === c.cards.length });
    s.pot += sc.total;
    const evs = [{ type: 'play', seat: seat, combo: c, score: sc, pot: s.pot }];
    if (chat) {
      const x = sc.xPot ?? CFG.CHAT_X;
      s.pot *= x;
      evs.push({ type: 'chat', seat: seat, victim: s.table.seat, target: t, combo: c, xPot: x, pot: s.pot });
    }
    s.hands[seat] = s.hands[seat].filter(x => !c.cards.includes(x));
    s.plays[seat]++; s.played.push(...c.cards); s.table = { combo: c, seat: seat }; s.vongPlays.push({ seat: seat, combo: c });
    if (!s.hands[seat].length) {
      const pot = s.pot;
      s.reveal = [false, false];
      evs.push({ type: 'vong', winner: seat, pot: pot, combo: c }, vanEnd(s, seat, pot, false));
    } else { s.turn = 1 - seat; evs.push({ type: 'turn', seat: s.turn, lead: false }); }
    return emit(s, evs);
  }

  function pass(s, seat) {
    if (!legal(s, seat).canPass) return [];
    s.passes[seat]++;
    const w = 1 - seat, evs = [{ type: 'pass', seat: seat }, { type: 'vong', winner: w, pot: s.pot, combo: s.table.combo }, { type: 'turn', seat: w, lead: true }];
    s.pot = 0; s.table = null; s.vongPlays = []; s.turn = w; s.reveal = [false, false];
    return emit(s, evs);
  }

  function view(s, seat) {
    const l = legal(s, seat);
    const v = { seat: seat, hand: s.hands[seat].slice(), oppCount: s.hands[1 - seat].length, table: s.table && { combo: s.table.combo, seat: s.table.seat },
      pot: s.pot, turn: s.turn, lead: s.table === null, played: s.played.slice(), plays: s.plays.slice(), mods: s.mods, legal: l.plays, canPass: l.canPass };
    if (s.reveal[seat]) v.oppHand = s.hands[1 - seat].slice();
    return v;
  }

  function swap(s, seat, ids, rng) {
    const max = CFG.QUE ? CFG.QUE.DOI_MAX : 3;
    if (s.over || s.turn !== seat || !Array.isArray(ids) || !ids.length || ids.length > max) return [];
    const out = ids.slice().sort(asc), h = s.hands[seat];
    if (out.some((x, i) => !h.includes(x) || (i && x === out[i - 1]))) return [];
    const used = new Set(s.hands[0].concat(s.hands[1], s.played)), pool = [];
    for (let i = 0; i < 52; i++) if (!used.has(i)) pool.push(i);
    if (pool.length < out.length) return [];
    const take = [];
    for (let k = 0; k < out.length; k++) { const j = k + Math.floor(rng() * (pool.length - k)); const t = pool[k]; pool[k] = pool[j]; pool[j] = t; take.push(pool[k]); }
    s.hands[seat] = h.filter(x => !out.includes(x)).concat(take).sort(asc);
    return emit(s, [{ type: 'swap', seat: seat, out: out, in: take.slice().sort(asc) }]);
  }

  TL.Rules = { newVan: newVan, play: play, pass: pass, legal: legal, view: view, winner: s => s.winner, swap: swap };
})(globalThis.TL = globalThis.TL || {});
