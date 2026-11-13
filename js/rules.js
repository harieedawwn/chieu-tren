/* js/rules.js  (owner RULES) ván engine, SPEC §5 and §8. Pure logic, no DOM, randomness only via opts.rng. Needs config, cards.
 * API  (state = VanState per SPEC §4; every call mutates state and appends the returned events to state.log)
 *   TL.Rules.newVan({rng, handSize?, leader?, mods, scoreFn, hands?}) -> VanState  (initial events already in state.log)
 *   TL.Rules.play(state, seat, cardIds) -> Event[]   [] and no change if illegal (turn, hand, combo, beat, noChat)
 *   TL.Rules.pass(state, seat)          -> Event[]   [] and no change if illegal (leader, mustBeat, turn)
 *   TL.Rules.legal(state, seat)         -> {plays: Combo[], canPass}   empty when not seat's turn or ván over
 *   TL.Rules.view(state, seat)          -> View (own hand only; no hands/log); legal/canPass filled on seat's turn
 *   TL.Rules.winner(state)              -> 0 | 1 | null
 *   TL.Rules.swap(state, seat, cardIds, rng) -> Event[]  {type:'swap', seat, out, in}; swaps 1..3 own cards with cards not dealt this ván; own turn only; [] if illegal
 * opts.seats = 2 | 4 (default 2; 4 -> CFG.HAND_SIZE_4 cards each, seat 0 = player, 1-3 = AI in turn order). Passing leaves the current vòng; the vòng ends when one seat has not passed (it takes the hũ and leads).
 *   A ván ends when a seat is out of cards: it wins and collects from every other seat (event vanEnd: left[], heo[] per seat, congN = seats with no play, cong = congN > 0).
 *   state.seats, state.passed[seat] (passed in the current vòng); view adds seats, counts[] (cards per seat), passed[]; oppCount = fewest cards among the other seats; oppHands (4 seats) only while revealed.
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
    const cn = s.plays.filter((p, i) => i !== w && p === 0).length;
    return { type: 'vanEnd', winner: w, left: s.hands.map(h => h.length), heo: s.hands.map(heoN), congN: cn,
      cong: cn > 0, toiTrang: tt, pot: pot };
  }

  function newVan(o) {
    const N = o.seats === 4 ? 4 : 2, n = o.handSize || (N === 4 ? CFG.HAND_SIZE_4 || CFG.HAND_SIZE : CFG.HAND_SIZE), d = Array.from({ length: 52 }, (_, i) => i), mods = o.mods || {};
    if (!o.hands) for (let i = 51; i > 0; i--) { const j = Math.floor(o.rng() * (i + 1)); const t = d[i]; d[i] = d[j]; d[j] = t; }
    const hands = o.hands ? o.hands.map(h => h.slice().sort(asc)) : Array.from({ length: N }, (_, i) => d.slice(i * n, (i + 1) * n).sort(asc));   // o.hands = fixed deal (tutorial)
    const low = Math.min(...hands.map(h => h[0]));
    const leader = mods.oppLeads ? 1 : Number.isInteger(o.leader) && o.leader >= 0 && o.leader < N ? o.leader : hands.findIndex(h => h.includes(low));
    const s = { hands: hands, table: null, vongPlays: [], pot: 0, turn: leader, leader: leader, mods: mods, plays: hands.map(() => 0), played: [],
      log: [], passes: hands.map(() => 0), over: false, winner: null, toiTrang: null, reveal: hands.map(() => false), peek: [], seats: N, passed: hands.map(() => false), scoreFn: o.scoreFn || zero };
    const evs = [{ type: 'deal', hands: hands.map(h => h.slice()), leader: leader }];
    const quad = hands.findIndex(h => [48, 49, 50, 51].every(x => h.includes(x)));
    if (quad >= 0) {
      s.toiTrang = quad;
      evs.push({ type: 'toiTrang', seat: quad, cards: [48, 49, 50, 51] }, vanEnd(s, quad, 0, true));
    } else evs.push({ type: 'turn', seat: leader, lead: true });
    emit(s, evs);
    return s;
  }

  const nextSeat = (s, seat) => { for (let k = 1; k <= s.seats; k++) { const x = (seat + k) % s.seats; if (!s.passed[x]) return x; } return seat; };

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
      s.reveal = s.reveal.map(() => false);
      evs.push({ type: 'vong', winner: seat, pot: pot, combo: c }, vanEnd(s, seat, pot, false));
    } else { s.turn = nextSeat(s, seat); evs.push({ type: 'turn', seat: s.turn, lead: false }); }
    return emit(s, evs);
  }

  function pass(s, seat) {
    if (!legal(s, seat).canPass) return [];
    s.passes[seat]++; s.passed[seat] = true;
    const evs = [{ type: 'pass', seat: seat }], left = s.passed.map((p, i) => p ? -1 : i).filter(i => i >= 0);
    if (left.length > 1) { s.turn = nextSeat(s, seat); evs.push({ type: 'turn', seat: s.turn, lead: false }); return emit(s, evs); }
    const w = left[0];
    evs.push({ type: 'vong', winner: w, pot: s.pot, combo: s.table.combo }, { type: 'turn', seat: w, lead: true });
    s.pot = 0; s.table = null; s.vongPlays = []; s.turn = w; s.reveal = s.reveal.map(() => false); s.passed = s.passed.map(() => false);
    return emit(s, evs);
  }

  function view(s, seat) {
    const l = legal(s, seat);
    const others = s.hands.map((h, i) => i).filter(i => i !== seat), v = { seat: seat, hand: s.hands[seat].slice(), oppCount: Math.min(...others.map(i => s.hands[i].length)), table: s.table && { combo: s.table.combo, seat: s.table.seat },
      pot: s.pot, turn: s.turn, lead: s.table === null, played: s.played.slice(), plays: s.plays.slice(), mods: s.mods, legal: l.plays, canPass: l.canPass };
    if (s.seats > 2) { v.seats = s.seats; v.counts = s.hands.map(h => h.length); v.passed = s.passed.slice(); }
    if (s.reveal[seat]) { if (s.seats > 2) v.oppHands = others.map(i => s.hands[i].slice()); else v.oppHand = s.hands[1 - seat].slice(); }
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
