/* js/config.js  (owner SPEC; job BALANCE may change number VALUES only, never keys)
 * API
 *   TL.CFG           object of tunables; every top-level key is listed in SPEC.md section 3
 *   TL.makeRng(seed) -> () -> float in [0,1)   mulberry32; same seed gives same sequence
 *   TL.fmt(n)        -> string, rounded, '.' thousands: 1660 -> "1.660", -250 -> "-250"
 * Units: px = CSS px, time = seconds, angles = degrees. No DOM access. Loads first.
 */
(function (TL) {
  'use strict';

  const CFG = {
    // ---- rules ----
    HAND_SIZE: 10,        // cards dealt to each seat; the other 32 are unused
    CHAT_X: 2,            // pot multiplier on a chat: pot = (pot + chat play total) x CHAT_X
    LEFT_PTS: 10,         // vanBonus Diem per card the loser still holds
    THOI_X: 2,            // vanBonus multiplier for EACH heo the loser holds (thoi heo)
    CONG_X: 2,            // vanBonus multiplier if the loser never played (cong)
    THOI_PENALTY: 50,     // Diem ban lost per heo the PLAYER holds when the opponent wins
    TOI_TRANG_X: 3,       // vanBonus multiplier when a seat is dealt tu quy heo (toi trang)

    // ---- scoring (level 1) ----
    BASE: {               // diem x the per combo type; extra = Phan "the" added per unit beyond 3
      rac:      { diem: 5,  the: 1, extra: 0 },
      doi:      { diem: 10, the: 2, extra: 0 },
      sam:      { diem: 30, the: 3, extra: 0 },
      sanh:     { diem: 20, the: 2, extra: 1 },  // +1 The per card beyond 3
      doithong: { diem: 40, the: 3, extra: 1 },  // +1 The per pair beyond 3
      tuquy:    { diem: 60, the: 5, extra: 0 },
    },
    CARD_PTS: [3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10, 11, 15], // Diem per card by rank 0..12 (3..10, J Q K, A, 2)
    SAO_GAIN: {           // added per Sao level above 1: (level-1) x gain
      rac:      { diem: 10, the: 2 },
      doi:      { diem: 20, the: 3 },
      sam:      { diem: 35, the: 4 },
      sanh:     { diem: 25, the: 3 },
      doithong: { diem: 35, the: 4 },
      tuquy:    { diem: 50, the: 5 },
    },
    QN: {                 // Quy nhan effect numbers (data.js descriptions read these)
      THAY_BOI_REVEAL: 3,   // opponent cards revealed at van start
      XE_OM_DIEM: 10,        // Chu xe om: sanh +Diem per card
      BAN_THAN_THE: 5,      // Thang ban than: +The stacked per pass, spent on next play
      HEO_DAT_THE: 2,       // Heo dat: +The permanent per qualifying vong won
      CHO_LON_CHAT_X: 3,    // Dan choi Cho Lon: chat pot multiplier instead of CHAT_X
      BAN_XOI_THE: 6,       // Ba ban xoi: rac +The
      ONG_DO_THE: 5,        // Ong do: doi +The
    },

    // ---- run ----
    VAN_PER_BAN: 3,       // max van per ban
    START_MONEY: 6,       // li xi at run start
    PAYOUT: { nho: 5, lon: 6, trum: 8 },   // li xi for clearing a ban, by kind
    UNUSED_VAN_PTS: 1,    // li xi per unused van at clear
    INTEREST_PER: 5,      // "bo ong": 1 li xi per this many held (counted before payout)
    INTEREST_MAX: 5,      // cap on interest
    TARGETS: [[130, 205, 290], [620, 1000, 1500], [2200, 3600, 5400]], // [chang][ban] Diem ban target (placeholder)
    AI_BY_CHANG: [1, 2, 3],  // AI level per chang index
    SHOP: {
      QN_COUNT: 2,        // Quy nhan offers per shop
      SAO_COUNT: 2,       // Sao offers per shop
      REROLL_BASE: 2,     // first reroll cost in a shop visit
      REROLL_STEP: 1,     // added per further reroll
      SELL_RATIO: 0.5,    // sell value = floor(price x ratio)
      QN_SLOTS: 5,        // Quy nhan slots
    },
    PRICE: {
      SAO: 3,             // every Sao
      QN: {               // by Quy nhan id
        thay_boi: 5, co_hang_xom: 4, chu_xe_om: 5, thang_ban_than: 6,
        heo_dat: 6, dan_cho_lon: 7, ba_ban_xoi: 4, ong_do: 4,
      },
    },

    // ---- AI, per level 1..3 (hien -> kho) ----
    AI: {
      1: { mistake: 0.30, track: false, chatMinPot: 0,   heoHold: 0.0, passBias: 0.10, leadLow: 0.5 },
      2: { mistake: 0.12, track: true,  chatMinPot: 150, heoHold: 0.5, passBias: 0.25, leadLow: 0.8 },
      3: { mistake: 0.03, track: true,  chatMinPot: 400, heoHold: 0.9, passBias: 0.40, leadLow: 1.0 },
      // mistake: chance to pick a random legal move; track: uses played-card memory;
      // chatMinPot: chat only if pot >= this; heoHold: 0..1 tendency to keep heo for the end;
      // passBias: 0..1 chance to drop a cheap vong it could beat; leadLow: 0..1 chance to lead its weakest combo
    },

    // ---- motion (all times /speed; see SPEC section 10) ----
    MOTION: {
      speeds: [1, 2, 3],                                   // allowed Game.settings.speed values
      spring: { freq: 9, zeta: 1 },                        // visual follows target; zeta 1 = critically damped
      lean: { perVel: 0.004, max: 12 },                    // deg of lean per px/s of velocity, capped
      hover: { scale: 1.12, zeta: 0.55, tilt: 10, shadow: 1.6 }, // scale-up overshoot (zeta<1), tilt deg, shadow factor
      sway: { amp: 2, rot: 1.2, speed: 1.1, phase: 0.9 },  // idle: px, deg, Hz, rad of phase offset per card index
      lift: 16,                                            // px a selected card rises
      deal: { stagger: 0.07, fly: 0.35, flip: 0.22 },      // s per card gap, flight time, squash-flip time
      juice: { scale: 0.22, rot: 8, dur: 0.4, freq: 22 },  // juice(1): extra scale, deg wobble, duration, wobble Hz
      play: { fly: 0.3, step: 0.3, stepMin: 0.12, tickPitch: 1, tickStep: 0.07, slam: 0.2, hold: 0.4 },
      // fly: cards to table; step: gap between ScoreSteps (shrinks toward stepMin when many); tick pitch x(1+tickStep) per step;
      // slam: total flying into pot; hold: pause after settle
      shake: { max: 8, perLog: 1.1, ref: 10, decay: 5 },   // px = min(max, perLog x ln(1 + score/ref)); decay per s
      popup: { dur: 0.9, rise: 30, back: 1.7, fadeAt: 0.6 }, // back-ease overshoot; fade starts at this fraction of dur
      counter: { dur: 0.5 },                               // number tween time
      dissolve: { dur: 0.7, edge: 0.12, grain: 2 },        // noise burn; edge width (0..1); grain in art px
      stamp: { in: 0.18, from: 3, hold: 0.7, out: 0.2 },   // slam-in time, start scale, hold, fade out
      button: { press: 3 },                                // px a pressed button sinks into its shadow
      bg: { pulse: 2.5, decay: 1.8, base: 1 },             // speed boost on pulse(1), decay per s, idle speed multiplier
      flame: { rate: 24, size: 2, life: 0.5, rise: 40 },   // particles/s, art px, s, px/s
      confetti: { n: 60, gravity: 600, life: 1.6 },        // default count, px/s^2, s
      aiThink: 0.6,                                        // s before the AI moves
      bigScore: 1000,                                      // a play total >= this pulses the background
    },

    // ---- look ----
    PAL: {                // six core colours + one muted leaf green
      denSon: '#1B1412', nauCanhGian: '#4A2418', doSon: '#A3271F',
      vangKim: '#D9A441', menLam: '#2E5E8C', giayDo: '#EADCC0', laXanh: '#5B7040',
    },
    MOOD: {               // background bands (dark -> light) as PAL keys
      title: ['denSon', 'nauCanhGian', 'doSon'],
      ban:   ['denSon', 'nauCanhGian', 'laXanh'],
      boss:  ['denSon', 'doSon', 'nauCanhGian'],
      shop:  ['denSon', 'menLam', 'nauCanhGian'],
    },
    BG: { lowW: 200, bayer: 4, swirl: 0.15, scanAlpha: 0.12, scanGap: 3 }, // low-res width px, Bayer matrix size, swirl speed, scanline alpha, scanline spacing px
    LAYOUT: {
      portraitBelow: 1.0, // w/h below this = portrait layout
      panelFrac: 0.24,    // landscape left panel width / w
      cardHFrac: 0.26,    // card height / h; Game.scale = max(1, floor(cardHFrac x h x dpr / 64))
      handOverlap: 0.45,  // fraction of card width hidden by the next card in the hand fan
      qnSlots: 5,         // Quy nhan slots drawn
    },
    DEVICES: [[360, 640], [390, 844], [844, 390], [768, 1024], [1024, 768], [1366, 768], [1920, 1080]], // 7-device fit list [w,h]

    // ---- platform ----
    STORAGE: { save: 'chieutren.save', settings: 'chieutren.settings', tut: 'chieutren.tut', seen: 'chieutren.seen' }, // localStorage keys
    SAVE_VERSION: 2,      // RunState.v; load() rejects other versions
    AUTO_SPEED: 3,        // ?auto forces this speed
  };

  // mulberry32
  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function fmt(n) {
    n = Math.round(n);
    const s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return n < 0 ? '-' + s : s;
  }

  TL.CFG = CFG;
  TL.makeRng = makeRng;
  TL.fmt = fmt;
})(globalThis.TL = globalThis.TL || {});
