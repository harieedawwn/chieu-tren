/* js/art3.js  (owner ART) wraps TL.Art after art2.js: 8 Quý nhân and 5 Báu vật of step 4, Đông Hồ style, same palette/Buf/sizes as art.js.
 * API (adds to / extends TL.Art; old ids keep their textures)
 *   TL.Art.quyNhan(id)   ong_thay_tuong co_ba_sai_gon chu_ban_pho anh_bo_doi ba_ngoai cau_ut chi_hang_ca ong_giao (gold frame) and
 *                        than_tai ong_dia tao_quan vua_bai ca_chep (Báu vật: double carved vàng kim frame) -> canvas 48x64, blank name bar x5-42 y47-58
 *   TL.Art.aura(ctx, x, y, w, h, t, px?)   flat-colour pixel fire ring OUTSIDE the rect (tím #6B2F7A / #A066B0, CFG.BAU.AURA) plus drifting dust pixels; t = seconds; no gradient, no glow
 *   TL.Art._ids3 / TL.Art._buf3(id) -> Buf (no DOM, for tests/art3.check.js)
 */
(function (TL) {
  'use strict';
  const A = TL.Art, K = A._kit, Buf = K.Buf, fig = K.fig, body = K.body, eyes = K.eyes, mouth = K.mouth, hand = K.hand, backdrop = K.backdrop;
  const BG = { ong_thay_tuong: 'N', co_ba_sai_gon: 'L', chu_ban_pho: 'B', anh_bo_doi: 'L', ba_ngoai: 'N', cau_ut: 'B', chi_hang_ca: 'B', ong_giao: 'R',
    than_tai: 'R', ong_dia: 'L', tao_quan: 'N', vua_bai: 'R', ca_chep: 'B' };
  const BAU = ['than_tai', 'ong_dia', 'tao_quan', 'vua_bai', 'ca_chep'];
  const face = (b, y) => { eyes(b, y || 10); b.set(11, (y || 10) + 3, 'R'); b.set(12, (y || 10) + 3, 'R'); };

  const CHARS = {
    ong_thay_tuong: function () {   // khăn đóng đen, râu dài, kính tròn, quạt
      const b = fig(); body(b, 'K'); b.rect(7, 2, 10, 5, 'K'); b.rect(7, 6, 10, 1, 'G');
      b.rect(8, 9, 3, 3, 'G'); b.rect(13, 9, 3, 3, 'G'); b.rect(9, 10, 1, 1, 'K'); b.rect(14, 10, 1, 1, 'K'); b.set(11, 10, 'G'); b.set(12, 10, 'G');
      b.poly([[8, 14], [16, 14], [14, 25], [12, 27], [10, 25]], 'P'); b.line(10, 16, 10, 24, 'K'); b.line(12, 16, 12, 26, 'K'); b.line(14, 16, 14, 24, 'K');
      b.ell(19, 22, 4, 3, 'R', 'K'); b.line(19, 22, 17, 25, 'K'); hand(b, 17, 25);
      return b.outline('K');
    },
    co_ba_sai_gon: function () {   // nón lá, áo bà ba xanh lá
      const b = fig(); body(b, 'L'); b.poly([[1, 9], [12, 0], [23, 9], [12, 8]], 'G'); b.line(2, 9, 22, 9, 'K'); for (let x = 5; x < 20; x += 3) b.line(x, 8, 12, 1, 'N');
      face(b, 12); b.line(8, 18, 8, 22, 'K'); b.line(16, 18, 16, 22, 'K'); b.rect(5, 17, 14, 1, 'G');
      b.set(9, 22, 'G'); b.set(12, 22, 'G'); b.set(15, 22, 'G'); hand(b, 4, 24); hand(b, 20, 24);
      return b.outline('K');
    },
    chu_ban_pho: function () {   // khăn rằn đỏ, tô phở bốc khói
      const b = fig(); body(b, 'P'); b.rect(7, 4, 10, 3, 'R'); b.rect(7, 6, 10, 1, 'K'); face(b, 10); b.rect(8, 8, 2, 1, 'K');
      b.ell(12, 22, 8, 4, 'B', 'K'); b.rect(5, 19, 14, 3, 'P'); b.line(7, 20, 17, 20, 'G'); b.set(10, 19, 'L'); b.set(14, 19, 'L'); b.set(12, 19, 'R');
      for (let k = 0; k < 3; k++) { b.set(9 + k * 3, 16, 'P'); b.set(10 + k * 3, 15, 'P'); b.set(9 + k * 3, 14, 'P'); }
      hand(b, 4, 21); hand(b, 20, 21);
      return b.outline('K');
    },
    anh_bo_doi: function () {   // mũ cối xanh lá, sao vàng
      const b = fig(); body(b, 'L'); b.ell(12, 6, 8.5, 5.5, 'L'); b.rect(3, 7, 18, 2, 'L'); b.rect(3, 9, 18, 1, 'K');
      b.rect(11, 4, 2, 2, 'G'); b.rect(10, 5, 4, 1, 'G'); b.set(12, 3, 'G'); b.set(12, 7, 'G'); face(b, 12);
      b.rect(5, 17, 14, 2, 'G'); b.line(6, 20, 10, 27, 'K'); b.line(18, 20, 14, 27, 'K'); hand(b, 5, 25); hand(b, 19, 25);
      return b.outline('K');
    },
    ba_ngoai: function () {   // tóc bạc búi, áo nâu, gậy
      const b = fig(); body(b, 'N'); b.ell(12, 5, 6.5, 4, 'P'); b.ell(12, 2, 3, 2.2, 'P'); dither(b); b.rect(6, 6, 2, 5, 'P'); b.rect(16, 6, 2, 5, 'P');
      face(b, 11); b.set(9, 14, 'N'); b.set(14, 14, 'N'); b.rect(10, 18, 4, 2, 'R'); b.set(12, 22, 'G'); b.set(12, 25, 'G');
      b.line(20, 15, 20, 27, 'G'); b.line(21, 15, 21, 27, 'K'); b.rect(19, 14, 3, 2, 'G'); hand(b, 19.5, 22);
      return b.outline('K');
    },
    cau_ut: function () {   // cậu bé tóc cua, áo đỏ, cầm một lá bài rác
      const b = fig(); body(b, 'R'); b.poly([[6.5, 9], [6.8, 4], [12, 2.5], [17.2, 4], [17.5, 9], [14.5, 6], [9.5, 6]], 'K'); face(b, 11); b.set(9, 13, 'R'); b.set(14, 13, 'R');
      b.rect(15, 14, 7, 10, 'K'); b.rect(16, 15, 5, 8, 'P'); b.set(18, 17, 'R'); b.set(17, 18, 'R'); b.set(19, 18, 'R'); b.set(18, 19, 'R'); b.set(18, 21, 'R'); hand(b, 14, 24);
      return b.outline('K');
    },
    chi_hang_ca: function () {   // nón lá, cá chép trên tay
      const b = fig(); body(b, 'B'); b.poly([[2, 9], [12, 1], [22, 9], [12, 8]], 'G'); b.line(3, 9, 21, 9, 'K'); face(b, 12);
      b.ell(12, 22, 8, 3.5, 'R', 'K'); b.poly([[19, 22], [24, 18], [24, 26]], 'R'); b.set(7, 21, 'K'); b.line(9, 20, 9, 24, 'G'); b.line(12, 20, 12, 24, 'G'); b.line(15, 20, 15, 24, 'G');
      hand(b, 4, 19); hand(b, 20, 19);
      return b.outline('K');
    },
    ong_giao: function () {   // khăn đóng, áo dài xanh, cuộn sách
      const b = fig(); body(b, 'B'); b.rect(7, 2, 10, 5, 'K'); b.rect(7, 6, 10, 1, 'G'); face(b, 11); b.rect(8, 13, 2, 1, 'P'); b.rect(14, 13, 2, 1, 'P');
      b.rect(5, 17, 14, 1, 'G'); b.set(12, 21, 'G'); b.set(12, 24, 'G'); b.rect(14, 19, 8, 4, 'P'); b.rect(14, 19, 1, 4, 'R'); b.rect(21, 19, 1, 4, 'R'); b.line(16, 20, 20, 20, 'K'); b.line(16, 22, 20, 22, 'K');
      hand(b, 13, 23);
      return b.outline('K');
    },
    // ---- Báu vật
    than_tai: function () {   // mũ cánh chuồn vàng, áo đỏ, râu đen, thỏi vàng
      const b = fig(); body(b, 'R'); b.rect(7, 2, 10, 5, 'K'); b.rect(2, 3, 5, 2, 'G'); b.rect(17, 3, 5, 2, 'G'); b.rect(7, 6, 10, 1, 'G'); face(b, 10);
      b.poly([[8, 14], [16, 14], [14, 22], [12, 24], [10, 22]], 'K'); b.rect(10, 15, 4, 1, 'R'); b.rect(9, 18, 6, 1, 'G');
      b.poly([[2, 26], [5, 21], [11, 21], [14, 26]], 'G'); b.line(5, 23, 11, 23, 'N'); b.set(12, 20, 'G');
      return b.outline('K');
    },
    ong_dia: function () {   // mặt tròn cười, bụng phệ, quạt
      const b = fig(); b.ell(12, 9, 7.5, 7.5, 'P', 'K'); b.ell(12, 22, 10, 7, 'G', 'K'); b.rect(7, 2, 10, 3, 'K'); b.rect(8, 4, 8, 1, 'R');
      b.set(9, 8, 'K'); b.set(10, 8, 'K'); b.set(14, 8, 'K'); b.set(15, 8, 'K'); b.line(9, 12, 15, 12, 'K'); b.set(8, 11, 'R'); b.set(16, 11, 'R');
      b.ell(12, 22, 3, 3, 'N'); b.set(12, 22, 'K'); b.ell(20, 14, 4, 4, 'R', 'K'); b.line(20, 14, 20, 20, 'K'); hand(b, 19, 21);
      return b.outline('K');
    },
    tao_quan: function () {   // mũ cánh chuồn, áo vàng, bếp lửa
      const b = fig(); body(b, 'G'); b.rect(7, 2, 10, 5, 'K'); b.rect(1, 3, 6, 2, 'K'); b.rect(17, 3, 6, 2, 'K'); b.rect(7, 6, 10, 1, 'R'); face(b, 10);
      b.poly([[9, 14], [15, 14], [13, 20], [12, 21], [11, 20]], 'P'); b.rect(5, 17, 14, 1, 'R');
      b.rect(5, 22, 14, 5, 'N'); b.rect(7, 23, 10, 3, 'K'); b.poly([[9, 26], [12, 20], [15, 26]], 'R'); b.poly([[11, 26], [12, 23], [13, 26]], 'G');
      return b.outline('K');
    },
    vua_bai: function () {   // vương miện vàng, áo đỏ, quạt bài
      const b = fig(); body(b, 'R'); b.poly([[6, 6], [6, 0], [9, 3], [12, -1], [15, 3], [18, 0], [18, 6]], 'G'); b.rect(6, 5, 12, 2, 'G'); b.set(12, 5, 'R'); face(b, 11);
      b.rect(5, 17, 14, 2, 'G');
      for (let k = 0; k < 3; k++) { b.poly([[14 + k * 3, 24], [14 + k * 3 + 1, 18], [14 + k * 3 + 5, 19], [14 + k * 3 + 4, 25]], 'P'); b.set(15 + k * 3, 20, 'R'); }
      hand(b, 13, 25);
      return b.outline('K');
    },
    ca_chep: function () {   // cá chép đỏ vảy vàng, nhảy lên
      const b = fig();
      b.poly([[1, 7], [6, 9], [6, 21], [1, 25], [4, 16]], 'R'); b.ell(14, 16, 9, 6.5, 'R'); b.poly([[8, 10], [12, 3], [16, 10]], 'R');
      for (let y = 12; y < 21; y += 3) for (let x = 8 + (y % 2 ? 0 : 2); x < 22; x += 4) { b.set(x, y, 'G'); b.set(x + 1, y + 1, 'G'); }
      b.ell(19, 14, 1.6, 1.6, 'P', 'K'); b.set(19, 14, 'K'); b.line(22, 17, 23, 19, 'K'); b.poly([[10, 22], [14, 26], [15, 22]], 'R');
      b.set(2, 4, 'B'); b.set(21, 5, 'B'); b.set(3, 26, 'B'); b.set(20, 25, 'B');
      return b.outline('K');
    },
  };
  function dither(b) { for (let y = 1; y < 8; y++) for (let x = 5; x < 19; x++) if (b.get(x, y) === 'P' && (x + y) % 3 === 0) b.set(x, y, 'N'); }

  function build(id) {
    const b = new Buf(48, 64), bau = BAU.indexOf(id) >= 0; K.qnFrame(b);
    if (bau) {   // double gold frame, carved corners and edge studs
      b.frame(3, 3, 42, 58, 'K'); b.frame(4, 4, 40, 56, 'G'); b.frame(5, 5, 38, 54, 'K');
      const cor = ['GGK', 'GKG', 'KG.'], mir = cor.map(r => r.split('').reverse().join(''));   // carved corner stud, mirrored on the right
      b.grid(cor, 3, 3); b.grid(mir, 42, 3); b.grid(cor.slice().reverse(), 3, 58); b.grid(mir.slice().reverse(), 42, 58);
      for (let x = 12; x < 38; x += 6) { b.set(x, 3, 'G'); b.set(x, 60, 'G'); }
      for (let y = 14; y < 56; y += 8) { b.set(3, y, 'G'); b.set(44, y, 'G'); }
    }
    b.rect(8, 6, 32, 36, 'K'); backdrop(b, 9, 7, 30, 34, BG[id]); b.blit(CHARS[id](), 12, 11); b.frame(8, 6, 32, 36, bau ? 'G' : 'K');
    [[20, 44], [24, 44], [28, 44]].forEach(function (p) { b.set(p[0], p[1], 'G'); });
    b.box(5, 47, 38, 12, 'R', 'G'); b.frame(4, 46, 40, 14, 'K');
    return b;
  }
  const CACHE = {}, oQ = A.quyNhan;
  A.quyNhan = function (id) { return BG[id] ? (CACHE[id] || (CACHE[id] = build(id).toCanvas())) : oQ(id); };
  A._ids3 = Object.keys(BG);
  A._buf3 = build;

  // ---- aura: flat pixel flames around a rect, never inside it
  const hash = (a, b) => { let h = Math.imul(a + 374761393, 668265263) ^ Math.imul(b + 2246822519, 3266489917); h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };
  A.aura = function (ctx, x, y, w, h, t, px) {
    const cols = TL.CFG.BAU.AURA, p = Math.max(2, Math.round(px || 3)), f = Math.floor(t * 9), nx = Math.ceil(w / p), ny = Math.ceil(h / p);
    ctx.save();
    const cell = function (cx, cy, c) { ctx.fillStyle = cols[c]; ctx.fillRect(Math.round(cx), Math.round(cy), p, p); };
    for (let i = -1; i <= nx; i++) {       // top and bottom: tongues of fire
      const th = 1 + (hash(i, f) % 3), bh = hash(i, f + 77) % 2;
      for (let k = 1; k <= th; k++) cell(x + i * p, y - k * p, (k + i + f) & 1);
      for (let k = 1; k <= bh; k++) cell(x + i * p, y + h + (k - 1) * p, (i + f) & 1);
    }
    for (let j = 0; j < ny; j++) {         // sides
      const lw = 1 + (hash(j + 500, f) % 2), rw = 1 + (hash(j + 900, f) % 2);
      for (let k = 1; k <= lw; k++) cell(x - k * p, y + j * p, (j + k + f) & 1);
      for (let k = 1; k <= rw; k++) cell(x + w + (k - 1) * p, y + j * p, (j + k + f + 1) & 1);
    }
    for (let d = 0; d < 6; d++) {          // dust drifting up
      const ph = (t * 0.6 + d / 6) % 1, dx = x + (hash(d, 3) % Math.max(1, w)), dy = y + h * 0.9 - ph * (h + 20);
      if (ph < 0.9) cell(dx + Math.sin((t + d) * 2) * 3, dy, d & 1);
    }
    ctx.restore();
  };
  const oInit = A.init;
  A.init = function () { return oInit().then(function () { A._ids3.forEach(A.quyNhan); return true; }); };
})(globalThis.TL = globalThis.TL || {});
