/* js/khi.js  (owner FEEL) Khi the: momentum 0..3. Pure logic, no DOM. Loads after ai.js.
 *   TL.Khi.make() -> {lv}                 TL.Khi.gain(k) / lose(k) -> bool (changed)
 *   TL.Khi.onVong(k, winner)              winner 0 (player) gains, winner 1 loses a level
 *   TL.Khi.onChat(k, seat)                a chat by the player gains
 *   TL.Khi.fast(k, thinkSec, p)           confident quick play: thinkSec in [FAST_MIN, FAST_MAX] and p >= WIN_P gains
 *   TL.Khi.winProb(hand, oppCount)        estimate 0..1 from the planner: my groups vs the opponent's remaining cards
 *   TL.Khi.at(table, lv)                  table = CFG.KHI.popup|shake|... value for a level (clamped)
 * Numbers live in CFG.KHI (content.js).
 */
(function (TL) {
  'use strict';
  const K = () => TL.CFG.KHI, C = () => TL.Cards, clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  function make() { return { lv: 0 }; }
  function gain(k) { if (k.lv >= K().MAX) return false; k.lv++; return true; }
  function lose(k) { if (k.lv <= 0) return false; k.lv--; return true; }
  function onVong(k, winner) { return winner === 0 ? gain(k) : lose(k); }
  function onChat(k, seat) { return seat === 0 ? gain(k) : false; }
  function winProb(hand, oppCount) {
    const g = TL.AI.plan(hand), ctl = g.filter(c => c.type === 'tuquy' || c.type === 'doithong').length + hand.filter(C().isHeo).length;
    const oppMoves = oppCount * K().OPP_MOVES_PER_CARD, lead = oppMoves - (g.length - K().CTL_W * ctl);
    return clamp(0.5 + K().P_PER_MOVE * lead, 0, 1);
  }
  function fast(k, thinkSec, p) { return thinkSec >= K().FAST_MIN && thinkSec <= K().FAST_MAX && p >= K().WIN_P ? gain(k) : false; }
  const at = (t, lv) => t[clamp(lv | 0, 0, K().MAX)];
  TL.Khi = { make: make, gain: gain, lose: lose, onVong: onVong, onChat: onChat, fast: fast, winProb: winProb, at: at };
})(globalThis.TL = globalThis.TL || {});
