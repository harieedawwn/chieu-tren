/* js/art2.js  (owner ART) wraps TL.Art after art.js for the new content; same palette, Buf pixel format, frames and sizes as art.js.
 * API (adds to / extends TL.Art; old ids keep their art.js textures)
 *   TL.Art.quyNhan(id)  12 new ids (co_giao anh_shipper ba_ve_so chu_tho_may ong_cau_ca me_chong thang_em chi_ban_hoa ong_ke_toan chu_ba_gac ba_mai thang_chau) -> canvas 48x64, blank name bar x5-42 y47-58
 *   TL.Art.portrait(id) 3 new boss ids (co_hai bac_chin di_ut) -> canvas 48x48
 *   TL.Art.que(id)      6 ids (que_doi que_them_van que_soi que_gap_doi que_loc que_sao) -> canvas 48x64, red xăm slip, gold symbol, blank name bar x5-42 y47-58
 *   TL.Art.pack(torn)   Bao lì xì -> canvas 48x64; torn true = opened variant; blank name bar x5-42 y47-58
 *   TL.Art._ids2 / TL.Art._buf2(kind, id) -> Buf (no DOM, for tests/art2.check.js); kind 'qn'|'opp'|'que'|'pack'
 */
(function (TL) {
  'use strict';
  const A = TL.Art, K = A._kit, Buf = K.Buf, fig = K.fig, body = K.body, eyes = K.eyes, mouth = K.mouth, hand = K.hand, backdrop = K.backdrop, clipCorners = K.clipCorners;
  const QN_BG = { co_giao: 'L', anh_shipper: 'G', ba_ve_so: 'R', chu_tho_may: 'B', ong_cau_ca: 'B', me_chong: 'R', thang_em: 'G', chi_ban_hoa: 'L', ong_ke_toan: 'G', chu_ba_gac: 'L', ba_mai: 'B', thang_chau: 'B' };
  const OPP_BG = { co_hai: 'L', bac_chin: 'R', di_ut: 'B' };
  const QUE_IDS = ['que_doi', 'que_them_van', 'que_soi', 'que_gap_doi', 'que_loc', 'que_sao'];
  const brow = (b, y) => { b.rect(8, y, 3, 1, 'K'); b.rect(13, y, 3, 1, 'K'); };
  const hairCap = (b, c) => b.poly([[6.5, 9], [6.8, 5], [12, 3], [17.2, 5], [17.5, 9], [14.5, 6.5], [9.5, 6.5]], c || 'K');

  const CHARS = {
    co_giao: function () {   // áo dài xanh, tóc dài, thước kẻ
      const b = fig(); b.ell(12, 9, 7, 7.5, 'K'); body(b, 'B');
      b.rect(5, 12, 3, 10, 'K'); b.rect(16, 12, 3, 10, 'K'); hairCap(b);
      eyes(b, 10); b.set(11, 13, 'R'); b.set(12, 13, 'R');
      b.rect(11, 18, 2, 1, 'G'); b.set(12, 21, 'G'); b.set(12, 24, 'G'); b.line(8, 28, 9, 19, 'K'); b.line(16, 28, 15, 19, 'K');
      b.rect(18, 8, 3, 18, 'G'); for (let y = 9; y < 26; y += 2) b.set(18, y, 'K'); b.rect(20, 8, 1, 18, 'N');
      hand(b, 19.5, 23);
      return b.outline('K');
    },
    anh_shipper: function () {   // mũ bảo hiểm đỏ, thùng hàng
      const b = fig(); body(b, 'L');
      b.poly([[5, 11], [5.3, 6], [8, 3], [12, 1.8], [16, 3], [18.7, 6], [19, 11]], 'R');
      b.rect(6, 9, 12, 2, 'K'); b.set(8, 9, 'B'); b.set(9, 9, 'B'); b.line(6, 11, 6, 14, 'K'); b.line(17, 11, 17, 14, 'K');
      eyes(b, 12); mouth(b, 14);
      b.box(3, 19, 18, 9, 'N', 'K'); b.rect(11, 19, 2, 9, 'G'); b.rect(5, 21, 4, 3, 'P'); b.set(6, 22, 'K'); b.set(7, 22, 'K');
      hand(b, 3.5, 25); hand(b, 20.5, 25);
      return b.outline('K');
    },
    ba_ve_so: function () {   // khăn đỏ, xấp vé số
      const b = fig(); body(b, 'N');
      b.poly([[6.5, 9], [6, 4.5], [9, 2.5], [15, 2.5], [18, 4.5], [17.5, 9], [15, 7], [9, 7]], 'R'); b.ell(18.5, 6, 2, 2, 'R');
      eyes(b, 10); b.set(10, 13, 'K'); b.set(11, 14, 'K'); b.set(12, 14, 'K'); b.set(13, 13, 'K');
      b.rect(13, 10, 10, 15, 'K');
      ['R', 'G', 'B', 'L'].forEach(function (c, k) { b.rect(14 + k * 2, 11 - (k % 2), 2, 13 + (k % 2), c); });
      b.rect(14, 15, 8, 2, 'P'); for (let x = 15; x < 22; x += 2) b.set(x, 16, 'K');
      hand(b, 17.5, 25);
      return b.outline('K');
    },
    chu_tho_may: function () {   // thước dây quanh cổ, kéo
      const b = fig(); body(b, 'L');
      b.poly([[6.5, 8], [7, 4], [12, 2.5], [17, 4], [17.5, 8], [15, 6], [9, 6]], 'K'); eyes(b, 10); mouth(b, 13);
      b.poly([[7, 17.5], [10, 17.5], [11, 27], [8, 27]], 'G'); b.poly([[17, 17.5], [14, 17.5], [13, 27], [16, 27]], 'G');
      for (let y = 19; y < 27; y += 2) { b.set(9, y, 'K'); b.set(14, y, 'K'); }
      b.line(21, 5, 19, 15, 'P'); b.line(22, 5, 20, 15, 'P'); b.line(23, 7, 21, 15, 'P');
      b.ell(19, 18, 1.8, 1.8, 'R', 'K'); b.ell(22, 18, 1.8, 1.8, 'R', 'K'); hand(b, 20.5, 24);
      return b.outline('K');
    },
    ong_cau_ca: function () {   // nón lá, cần câu, con cá
      const b = fig(); body(b, 'B');
      b.poly([[0.5, 10], [12, 0.5], [23.5, 10]], 'G'); b.line(12, 1, 6, 9, 'N'); b.line(12, 1, 18, 9, 'N'); b.line(12, 1, 12, 9, 'N');
      eyes(b, 12); mouth(b, 14);
      b.line(13, 27, 22, 4, 'N'); b.line(14, 27, 23, 4, 'N'); b.line(23, 5, 23, 13, 'P'); b.ell(21.5, 15.5, 1.9, 1.3, 'R', 'K'); b.set(23, 15, 'K');
      hand(b, 13.5, 25);
      return b.outline('K');
    },
    me_chong: function () {   // búi tóc, mặt nghiêm, quạt
      const b = fig(); body(b, 'R'); b.rect(10, 17, 4, 1, 'G');
      b.ell(12, 3, 3.4, 2.6, 'K'); hairCap(b); [[9, 5], [12, 4], [15, 5], [7, 8], [17, 8]].forEach(function (p) { b.set(p[0], p[1], 'P'); });
      brow(b, 8); eyes(b, 10); b.set(10, 14, 'K'); b.set(13, 14, 'K'); b.set(11, 13, 'K'); b.set(12, 13, 'K');
      const px = 15, py = 27, pts = [[px, py]]; for (let a = -165; a <= -15; a += 15) pts.push([px + 8.2 * Math.cos(a * Math.PI / 180), py + 8.2 * Math.sin(a * Math.PI / 180)]);
      b.poly(pts, 'R'); for (let a = -150; a <= -30; a += 30) b.line(px, py, px + 8 * Math.cos(a * Math.PI / 180), py + 8 * Math.sin(a * Math.PI / 180), 'G');
      b.rect(14, 27, 2, 1, 'N'); hand(b, 15, 26);
      return b.outline('K');
    },
    thang_em: function () {   // tóc ba vá, lá bài
      const b = fig(); body(b, 'G');
      b.poly([[5, 9], [3.5, 2], [8, 6]], 'K'); b.poly([[9, 5], [12, 0], [15, 5]], 'K'); b.poly([[16, 6], [20.5, 2], [19, 9]], 'K'); hairCap(b);
      eyes(b, 10); b.rect(9, 13, 6, 1, 'K'); b.rect(10, 14, 4, 1, 'R'); b.set(12, 13, 'P');
      b.box(16, 18, 6, 9, 'P', 'K'); [[17, 20], [19, 20], [17, 21], [18, 21], [19, 21], [18, 22]].forEach(function (p) { b.set(p[0], p[1], 'R'); });
      hand(b, 15.5, 25);
      return b.outline('K');
    },
    chi_ban_hoa: function () {   // khăn nâu, đòn gánh hai thúng hoa mai
      const b = fig(); body(b, 'R');
      b.poly([[6.5, 9], [6.5, 5], [12, 3], [17.5, 5], [17.5, 9], [14.5, 7], [9.5, 7]], 'N'); eyes(b, 10); b.set(11, 13, 'K'); b.set(12, 13, 'K');
      b.line(0, 16, 23, 16, 'N'); b.line(0, 17, 23, 17, 'N');
      b.line(2, 18, 2, 22, 'P'); b.line(21, 18, 21, 22, 'P');
      [2.5, 21.5].forEach(function (cx) {
        b.ell(cx, 25, 2.9, 2.7, 'N', 'K');
        [[-1, -3], [1, -4], [-2, -5], [2, -6], [0, -2]].forEach(function (d) { b.set(cx + d[0], 22 + d[1] + 3, 'G'); });
        b.set(cx, 20, 'R');
      });
      hand(b, 6, 23); hand(b, 18, 23);
      return b.outline('K');
    },
    ong_ke_toan: function () {   // kính, bàn tính
      const b = fig(); body(b, 'B');
      b.rect(6, 7, 2, 5, 'K'); b.rect(16, 7, 2, 5, 'K'); [8, 10, 12, 14, 16].forEach(function (x) { b.set(x, 5, 'K'); });
      b.frame(7, 9, 5, 4, 'K'); b.frame(13, 9, 5, 4, 'K'); b.set(12, 10, 'K'); b.set(9, 11, 'K'); b.set(15, 11, 'K'); b.rect(10, 14, 4, 1, 'K');
      b.rect(11, 18, 2, 3, 'R');
      b.box(4, 21, 16, 7, 'N', 'K'); b.rect(5, 24, 14, 1, 'K');
      for (let x = 6; x < 19; x += 3) { b.rect(x, 22, 2, 2, 'G'); b.rect(x, 25, 2, 2, 'R'); }
      hand(b, 3.5, 24); hand(b, 20.5, 24);
      return b.outline('K');
    },
    chu_ba_gac: function () {   // khăn vắt vai, cơ bắp
      const b = fig(); body(b, 'N'); hairCap(b); b.poly([[6.5, 8], [7, 5], [12, 3.5], [17, 5], [17.5, 8]], 'K');
      brow(b, 8); eyes(b, 10); b.rect(10, 13, 4, 1, 'K'); [[8, 13], [16, 13], [9, 14], [15, 14]].forEach(function (p) { b.set(p[0], p[1], 'N'); });
      b.poly([[3.5, 19], [8, 17.5], [10.5, 17.5], [15, 28], [9, 28]], 'P');
      [21, 22, 25, 26].forEach(function (y) { for (let x = 0; x < 24; x++) if (b.get(x, y) === 'P') b.set(x, y, 'B'); });
      b.rect(2, 17, 4, 2, 'P'); hand(b, 3.5, 25); hand(b, 20.5, 25);
      return b.outline('K');
    },
    ba_mai: function () {   // khăn đen, miệng đỏ, mâm trầu cau
      const b = fig(); body(b, 'N');
      b.ell(12, 3.5, 4.4, 2.8, 'K'); hairCap(b); eyes(b, 10); b.set(8, 13, 'N'); b.set(15, 13, 'N');
      b.rect(10, 13, 4, 2, 'R'); b.set(12, 18, 'G'); b.set(12, 21, 'G');
      b.ell(12, 26, 10, 2.5, 'N', 'K');
      b.ell(6.5, 24, 2.6, 1.7, 'L', 'K'); b.ell(17.5, 24, 2.6, 1.7, 'L', 'K'); b.ell(10.5, 24.5, 1.6, 1.6, 'P', 'K'); b.ell(13.8, 24.5, 1.6, 1.6, 'P', 'K'); b.set(12, 23, 'R');
      hand(b, 3, 22); hand(b, 21, 22);
      return b.outline('K');
    },
    thang_chau: function () {   // ôm bao lì xì
      const b = fig(); body(b, 'G');
      hairCap(b); b.poly([[11, 3.5], [12, 0.5], [13.5, 3.5]], 'K');
      [[8, 10], [9, 9], [10, 10], [13, 10], [14, 9], [15, 10]].forEach(function (p) { b.set(p[0], p[1], 'K'); }); b.rect(10, 12, 4, 1, 'K'); b.rect(11, 13, 2, 1, 'R');
      b.box(5, 17, 14, 11, 'R', 'K'); b.line(5, 17, 12, 22, 'K'); b.line(19, 17, 12, 22, 'K'); b.ell(12, 22, 1.8, 1.8, 'G', 'K');
      [[7, 25], [10, 26], [14, 26], [17, 25]].forEach(function (p) { b.set(p[0], p[1], 'G'); });
      hand(b, 5, 18); hand(b, 19, 18);
      return b.outline('K');
    },
    co_hai: function () {   // búi tóc, bông tai, quạt ba lá bài cùng chất
      const b = fig(); body(b, 'L');
      b.ell(12, 3.5, 4, 2.8, 'K'); hairCap(b); b.rect(16, 1, 1, 5, 'G');
      b.line(7, 8, 10, 9, 'K'); b.line(17, 8, 14, 9, 'K'); eyes(b, 10); b.rect(10, 13, 4, 1, 'R'); b.set(6, 12, 'G'); b.set(17, 12, 'G');
      [[12, 19], [15, 18], [18, 17]].forEach(function (p) { b.box(p[0], p[1], 6, 9, 'P', 'K'); b.set(p[0] + 2, p[1] + 2, 'R'); b.set(p[0] + 3, p[1] + 2, 'R'); b.set(p[0] + 2, p[1] + 3, 'R'); b.set(p[0] + 3, p[1] + 3, 'R'); b.set(p[0] + 2, p[1] + 4, 'R'); });
      hand(b, 12, 27);
      return b.outline('K');
    },
    bac_chin: function () {   // ria dày, heo đất bị gạch
      const b = fig(); body(b, 'B');
      b.rect(6, 8, 2, 4, 'K'); b.rect(16, 8, 2, 4, 'K'); b.rect(7, 7, 10, 1, 'N'); brow(b, 8); eyes(b, 10); b.rect(8, 12, 8, 2, 'K'); b.rect(10, 14, 4, 1, 'N');
      b.poly([[8, 17.5], [12, 21], [16, 17.5]], 'P');
      b.ell(16.5, 23, 5.5, 3.8, 'P', 'K'); b.poly([[13, 20], [14.5, 17.5], [17, 20]], 'P'); b.rect(20, 21, 3, 3, 'R'); b.set(18, 21, 'K'); b.rect(15, 25, 2, 2, 'K'); b.rect(19, 25, 2, 2, 'K'); b.rect(15, 20, 3, 1, 'K');
      b.line(11, 18, 23, 27, 'R'); b.line(23, 18, 11, 27, 'R'); b.line(11, 19, 22, 27, 'R'); b.line(22, 19, 11, 27, 'R');
      hand(b, 11, 24);
      return b.outline('K');
    },
    di_ut: function () {   // đuôi ngựa, giơ hai ngón tay
      const b = fig(); body(b, 'R');
      hairCap(b); b.ell(20, 9, 2.4, 4.2, 'K'); b.rect(18, 5, 3, 1, 'G'); eyes(b, 10); b.set(10, 13, 'K'); b.set(11, 14, 'K'); b.set(12, 14, 'K'); b.set(13, 13, 'K'); b.set(6, 12, 'G');
      b.rect(3, 14, 3, 8, 'R'); b.ell(4, 12.5, 2.3, 2.1, 'P', 'K'); b.rect(2, 6, 1, 6, 'P'); b.rect(5, 6, 1, 6, 'P'); b.set(2, 5, 'P'); b.set(5, 5, 'P');
      hand(b, 19.5, 25);
      return b.outline('K');
    },
  };

  function buildQN(id) {
    const b = new Buf(48, 64); K.qnFrame(b);
    b.rect(8, 6, 32, 36, 'K'); backdrop(b, 9, 7, 30, 34, QN_BG[id]); b.blit(CHARS[id](), 12, 11); b.frame(8, 6, 32, 36, 'K');
    [[20, 44], [24, 44], [28, 44]].forEach(function (p) { b.set(p[0], p[1], 'G'); });
    b.box(5, 47, 38, 12, 'R', 'G'); b.frame(4, 46, 40, 14, 'K');
    return b;
  }

  function buildOpp(id) {
    const b = new Buf(48, 48);
    b.rect(0, 0, 48, 48, 'K'); b.rect(1, 1, 46, 46, 'G'); b.rect(2, 2, 44, 44, 'N'); clipCorners(b, 'K');
    backdrop(b, 3, 3, 42, 42, OPP_BG[id]); b.frame(2, 2, 44, 44, 'K');
    [[6, 4], [38, 4]].forEach(function (p) { b.grid(['.KK.', 'KRRK', 'KRRK', 'KRRK', '.KK.', '..G.', '..G.'], p[0], p[1]); });
    b.blit(CHARS[id](), 12, 15); b.frame(2, 2, 44, 44, 'K'); clipCorners(b, 'K');
    return b;
  }

  const star = function (b, cx, cy, R, r, c) {
    const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r : R; pts.push([cx + q * Math.cos(a), cy + q * Math.sin(a)]); }
    b.poly(pts, c);
  };
  const SYMBOL = {
    que_doi: function (b) {
      b.rect(17, 19, 11, 2, 'G'); b.poly([[27, 15], [33, 20], [27, 25]], 'G'); b.rect(20, 30, 11, 2, 'G'); b.poly([[21, 26], [15, 31], [21, 36]], 'G');
    },
    que_them_van: function (b) {
      b.box(16, 14, 10, 14, 'K', 'G'); b.box(22, 20, 11, 15, 'N', 'G'); b.rect(25, 27, 5, 2, 'G'); b.rect(27, 25, 2, 6, 'G');
    },
    que_soi: function (b) {
      b.ell(24, 25, 8.5, 5.5, 'G'); b.ell(24, 25, 7, 4, 'K'); b.ell(24, 25, 3.4, 3.4, 'G'); b.rect(23, 24, 2, 2, 'K');
      [[15, 19], [18, 17], [24, 16], [30, 17], [33, 19]].forEach(function (p) { b.set(p[0], p[1], 'G'); });
    },
    que_gap_doi: function (b) {
      b.line(15, 19, 19, 23, 'G'); b.line(16, 19, 20, 23, 'G'); b.line(19, 19, 15, 23, 'G'); b.line(20, 19, 16, 23, 'G');
      const two = ['XXXX.', '....X', '....X', '.XXX.', 'X....', 'X....', 'XXXXX'];
      two.forEach(function (row, j) { row.split('').forEach(function (ch, i) { if (ch === 'X') b.rect(22 + i * 2, 20 + j * 2, 2, 2, 'G'); }); });
    },
    que_loc: function (b) {
      b.ell(24, 25, 9, 9, 'G', 'N'); b.ell(24, 25, 6.5, 6.5, 'G', 'N'); b.rect(22, 23, 4, 4, 'K');
    },
    que_sao: function (b) { star(b, 24, 26, 11, 4.6, 'G'); },
  };

  function buildQue(id) {
    const b = new Buf(48, 64);
    b.rect(0, 0, 48, 64, 'K'); b.rect(1, 1, 46, 62, 'G'); b.rect(3, 3, 42, 58, 'R'); clipCorners(b, 'K');
    b.frame(1, 1, 46, 62, 'K'); b.rect(1, 62, 46, 1, 'K'); clipCorners(b, 'K');
    [[5, 5], [42, 5], [5, 58], [42, 58]].forEach(function (p) { b.set(p[0], p[1], 'G'); });
    b.box(12, 6, 24, 37, 'K', 'G'); b.rect(14, 8, 20, 2, 'R'); b.rect(14, 39, 20, 2, 'R'); b.rect(22, 8, 4, 2, 'G'); b.rect(22, 39, 4, 2, 'G');
    SYMBOL[id](b);
    b.box(5, 47, 38, 12, 'R', 'G'); b.frame(4, 46, 40, 14, 'K');
    return b;
  }

  function buildPack(torn) {
    const b = new Buf(48, 64);
    b.rect(0, 0, 48, 64, 'K'); b.rect(1, 1, 46, 62, 'G'); b.rect(3, 3, 42, 58, 'R'); clipCorners(b, 'K');
    b.frame(1, 1, 46, 62, 'K'); b.rect(1, 62, 46, 1, 'K'); clipCorners(b, 'K'); b.frame(5, 5, 38, 53, 'G');
    for (let y = 30; y < 45; y++) for (let x = 7; x < 41; x++) if ((x + y) % 6 === 0 && b.get(x, y) === 'R') b.set(x, y, 'G');
    b.ell(24, 36, 6, 6, 'R', 'G'); b.rect(22, 34, 4, 4, 'G'); b.rect(23, 35, 2, 2, 'R');
    if (!torn) {
      b.poly([[3, 4], [44, 4], [24, 25]], 'R'); b.line(4, 5, 24, 24, 'G'); b.line(43, 5, 24, 24, 'G');
      b.ell(24, 25, 4, 4, 'G', 'K'); b.rect(23, 24, 2, 2, 'R');
    } else {
      b.rect(5, 5, 38, 11, 'K'); b.rect(6, 6, 36, 9, 'P');
      for (let x = 5; x < 43; x++) { const yb = 15 + ((x * 7) % 5 < 2 ? 0 : (x * 7) % 5 < 4 ? 2 : 3); for (let y = 15; y <= yb; y++) b.set(x, y, 'P'); b.set(x, yb + 1, 'K'); }
      b.ell(24, 9, 6, 3.4, 'G', 'K'); b.rect(23, 8, 2, 2, 'K'); b.rect(10, 6, 6, 2, 'N'); b.rect(31, 6, 7, 2, 'N');
      b.poly([[38, 3], [46, 1], [45, 9], [41, 7]], 'R'); b.line(39, 3, 44, 8, 'G'); b.line(38, 3, 46, 1, 'K'); b.line(46, 1, 45, 9, 'K');
    }
    b.box(5, 47, 38, 12, 'R', 'G'); b.frame(4, 46, 40, 14, 'K');
    return b;
  }

  const BUILD = {
    qn: id => buildQN(id), opp: id => buildOpp(id), que: id => buildQue(id), pack: id => buildPack(!!id),
  };
  const IDS = { qn: Object.keys(QN_BG), opp: Object.keys(OPP_BG), que: QUE_IDS, pack: [0, 1] };
  const CACHE = {};
  const memo = (k, fn) => CACHE[k] || (CACHE[k] = fn().toCanvas());
  const oQ = A.quyNhan, oP = A.portrait;
  A.quyNhan = function (id) { return QN_BG[id] ? memo('q' + id, () => BUILD.qn(id)) : oQ(id); };
  A.portrait = function (id) { return OPP_BG[id] ? memo('p' + id, () => BUILD.opp(id)) : oP(id); };
  A.que = function (id) { if (!SYMBOL[id]) throw new Error('Art.que: unknown id ' + id); return memo('e' + id, () => BUILD.que(id)); };
  A.pack = function (torn) { return memo('k' + (torn ? 1 : 0), () => BUILD.pack(torn)); };
  A._ids2 = IDS;
  A._buf2 = function (kind, id) { return BUILD[kind](id); };
  const oInit = A.init;
  A.init = function () { return oInit().then(function () { IDS.qn.forEach(A.quyNhan); IDS.opp.forEach(A.portrait); QUE_IDS.forEach(A.que); A.pack(false); A.pack(true); return true; }); };
})(globalThis.TL = globalThis.TL || {});
