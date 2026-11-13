/* js/art5.js  (owner ART) wraps TL.Art after art4.js: R5 step 6, every Quý nhân (28) and Báu vật (5) portrait redrawn with the art4 kit
 * (32x40 figure, the ONE shared face, Dong Ho woodblock look, one shade tone) inside the same 48x64 card frame / name bar as before.
 * API (extends TL.Art; the card layout, window position and name bar are unchanged for the card code)
 *   TL.Art.quyNhan(id)  all 33 ids (33 = 8 + 12 + 8 Quý nhân, 5 Báu vật with the double gold frame) -> canvas 48x64, blank name bar x5-42 y47-58
 *   TL.Art._ids5 / TL.Art._fig5(id) -> Buf 32x40 (no DOM; ._ok = deliberate single pixels) / TL.Art._buf5(id) -> Buf 48x64, for tests/art.lint.js
 */
(function (TL) {
  'use strict';
  const A = TL.Art, K = A._kit, k4 = A._kit4, Buf = K.Buf, backdrop = K.backdrop;
  const fig = k4.fig, head = k4.head, face = k4.face, shade = k4.shade, hand = k4.hand, cardAt = k4.cardAt, torso = k4.torso, sym = k4.sym, symSet = k4.symSet, spark = k4.spark;
  const BG = { thay_boi: 'B', co_hang_xom: 'L', chu_xe_om: 'G', thang_ban_than: 'B', heo_dat: 'L', dan_cho_lon: 'B', ba_ban_xoi: 'R', ong_do: 'G',
    co_giao: 'L', anh_shipper: 'G', ba_ve_so: 'R', chu_tho_may: 'B', ong_cau_ca: 'B', me_chong: 'R', thang_em: 'G', chi_ban_hoa: 'L', ong_ke_toan: 'G', chu_ba_gac: 'L', ba_mai: 'B', thang_chau: 'B',
    ong_thay_tuong: 'N', co_ba_sai_gon: 'L', chu_ban_pho: 'B', anh_bo_doi: 'L', ba_ngoai: 'N', cau_ut: 'B', chi_hang_ca: 'B', ong_giao: 'R',
    than_tai: 'R', ong_dia: 'L', tao_quan: 'N', vua_bai: 'R', ca_chep: 'B' };
  const BAU = ['than_tai', 'ong_dia', 'tao_quan', 'vua_bai', 'ca_chep'];

  // hats and hair (drawn after shade, before face)
  const capBill = (b, c) => { b.poly([[8, 10], [8, 6], [12, 2], [20, 2], [24, 6], [24, 10]], c); b.rect(7, 9, 18, 2, 'K'); };
  const nonLa = (b, c) => { b.poly([[2, 12], [16, 1], [30, 12]], c || 'G'); b.line(3, 12, 29, 12, 'K'); b.line(4, 11, 28, 11, 'N'); b.line(16, 2, 9, 11, 'N'); b.line(16, 2, 23, 11, 'N'); };
  const khanDong = b => { b.rect(10, 1, 12, 8, 'K'); b.rect(10, 8, 12, 1, 'G'); b.rect(8, 6, 2, 8, 'K'); b.rect(22, 6, 2, 8, 'K'); };
  const cropHair = b => b.poly([[8, 12], [8, 8], [12, 5], [20, 5], [24, 8], [24, 12], [22, 8], [16, 7], [10, 8]], 'K');
  const bun = (b, y) => { b.poly([[8, 14], [8, 8], [11, 5], [16, 4], [21, 5], [24, 8], [24, 14], [22, 10], [16, 8], [10, 10]], 'K'); b.ell(16, y || 3, 4, 3, 'K'); };
  const wing = (b, c) => { b.rect(10, 1, 12, 7, 'K'); b.rect(10, 7, 12, 1, c); sym(b, 1, 4, 9, 2, 'K'); sym(b, 1, 4, 2, 2, c); };
  const glasses = b => { b.frame(9, 12, 6, 5, 'K'); b.frame(17, 12, 6, 5, 'K'); b.rect(15, 14, 2, 1, 'K'); };
  const shades = b => { b.rect(9, 13, 6, 3, 'K'); b.rect(17, 13, 6, 3, 'K'); b.rect(15, 13, 2, 1, 'K'); };
  const fan = (b, x, y, c) => { b.ell(x, y, 5.5, 5.5, c); b.line(x, y, x - 4, y - 5, 'K'); b.line(x, y, x, y - 6, 'K'); b.line(x, y, x + 4, y - 5, 'K'); };
  const beard = (b, c, l) => b.poly([[11, 20], [21, 20], [20, 22 + l * 0.5], [16, 22 + l], [12, 22 + l * 0.5]], c);

  const CHARS = {
    thay_boi: function () {   // khăn xanh, kính râm, ba lá bài tiên tri
      const b = fig(); torso(b, 'B'); head(b); b.poly([[13, 28], [19, 28], [16, 31]], 'P'); shade(b);
      b.poly([[8, 12], [8, 6], [12, 2], [20, 2], [24, 6], [24, 12], [22, 9], [16, 8], [10, 9]], 'B'); b.rect(8, 8, 16, 2, 'G'); b.rect(15, 3, 2, 3, 'G');
      face(b, { eye: 'dot', brow: 'up', mouth: 'smirk' }); shades(b);
      [-0.5, 0, 0.5].forEach(a => cardAt(b, 23 + a * 7, 31, a, 'R')); hand(b, 23, 37);
      return b.outline('K');
    },
    co_hang_xom: function () {   // cuốn lô, áo hoa, hóng chuyện
      const b = fig(); torso(b, 'L'); head(b); b.poly([[13, 28], [19, 28], [16, 31]], 'P'); shade(b);
      [[7, 31], [14, 33], [22, 30], [18, 36]].forEach(p => b.rect(p[0], p[1], 2, 2, 'G'));
      b.poly([[8, 14], [8, 8], [11, 5], [16, 4], [21, 5], [24, 8], [24, 14], [22, 10], [16, 8], [10, 10]], 'K');
      [[10, 4], [16, 3], [22, 4]].forEach(p => b.ell(p[0], p[1], 2.5, 2.5, 'R', 'K'));
      face(b, { eye: 'wide', brow: 'up', mouth: 'open', blush: true });
      b.rect(25, 24, 3, 8, 'L'); hand(b, 26, 22);
      return b.outline('K');
    },
    chu_xe_om: function () {   // mũ bảo hiểm vàng, khăn đỏ, tay lái xe
      const b = fig(); torso(b, 'N'); head(b); shade(b);
      b.poly([[7, 31], [25, 28], [26, 32], [10, 36]], 'R');
      b.poly([[7, 12], [7, 6], [11, 2], [21, 2], [25, 6], [25, 12]], 'G'); b.rect(6, 11, 20, 2, 'K'); b.rect(15, 3, 2, 6, 'N');
      face(b, { eye: 'dot', brow: 'flat', mouth: 'grin' });
      b.rect(2, 34, 28, 2, 'K'); hand(b, 5, 34); hand(b, 27, 34);
      return b.outline('K');
    },
    thang_ban_than: function () {   // tóc dựng, áo xanh, giơ ngón cái
      const b = fig(); torso(b, 'B'); head(b); b.poly([[13, 28], [19, 28], [16, 31]], 'P'); shade(b);
      b.poly([[8, 11], [8, 7], [10, 2], [13, 6], [15, 0], [18, 6], [21, 2], [24, 7], [24, 11], [22, 8], [16, 7], [10, 8]], 'K');
      face(b, { eye: 'wide', brow: 'up', mouth: 'grin', blush: true });
      b.ell(25, 32, 4, 4, 'P', 'K'); b.rect(24, 24, 3, 8, 'P'); b.rect(21, 29, 3, 4, 'P'); b.rect(23, 33, 5, 1, 'N');
      return b.outline('K');
    },
    heo_dat: function () {   // heo đất đỏ, khe bỏ tiền, đồng xu rơi
      const b = fig();
      b.ell(16, 26, 14, 11, 'R'); b.poly([[6, 18], [7, 10], [13, 16]], 'R'); b.poly([[26, 18], [25, 10], [19, 16]], 'R');
      b.rect(9, 34, 4, 6, 'R'); b.rect(19, 34, 4, 6, 'R'); b.line(29, 25, 31, 22, 'K');
      b.ell(16, 28, 5.5, 4, 'P'); b.rect(14, 28, 1, 2, 'K'); b.rect(17, 28, 1, 2, 'K');
      b.rect(8, 21, 3, 3, 'K'); b.rect(21, 21, 3, 3, 'K'); b.rect(12, 17, 8, 2, 'K'); b.rect(8, 25, 2, 2, 'G'); b.rect(22, 25, 2, 2, 'G');
      b.box(14, 3, 5, 5, 'G', 'K'); b.rect(16, 5, 1, 1, 'K');
      shade(b);
      return b.outline('K');
    },
    dan_cho_lon: function () {   // tóc vuốt, kính đen, dây chuyền vàng, răng vàng, xấp chip
      const b = fig(); torso(b, 'R'); head(b); shade(b);
      b.poly([[12, 27], [20, 27], [16, 36]], 'P'); b.line(12, 28, 16, 35, 'G'); b.line(20, 28, 16, 35, 'G'); b.ell(16, 36, 1.5, 1.5, 'G');
      b.poly([[8, 13], [8, 7], [12, 3], [20, 3], [24, 7], [24, 13], [22, 8], [16, 6], [10, 8]], 'K');
      face(b, { eye: 'dot', brow: 'flat', mouth: 'grin' }); shades(b); b.set(15, 21, 'G'); b.set(16, 21, 'G');
      b.box(22, 30, 7, 4, 'G', 'K'); b.box(23, 34, 7, 4, 'R', 'K'); hand(b, 21, 34);
      return b.outline('K');
    },
    ba_ban_xoi: function () {   // khăn mỏ quạ đỏ, áo nâu, mẹt xôi
      const b = fig(); torso(b, 'N'); head(b); b.poly([[13, 28], [19, 28], [16, 31]], 'P'); shade(b);
      b.poly([[7, 16], [7, 8], [11, 3], [17, 2], [23, 3], [26, 8], [26, 16], [23, 12], [16, 9], [9, 12]], 'R'); b.poly([[22, 5], [29, 3], [28, 10]], 'R');
      face(b, { eye: 'smile', brow: 'up', mouth: 'smile', blush: true });
      b.ell(16, 35, 15, 4.5, 'G'); b.ell(16, 33, 10, 4, 'P'); b.line(9, 33, 23, 33, 'N'); b.line(11, 31, 21, 31, 'N');
      return b.outline('K');
    },
    ong_do: function () {   // khăn đóng, râu bạc, bút lông và câu đối đỏ
      const b = fig(); torso(b, 'N'); head(b); shade(b); khanDong(b);
      b.poly([[11, 21], [21, 21], [19, 27], [16, 33], [13, 27]], 'P'); b.rect(14, 23, 1, 7, 'N'); b.rect(17, 24, 1, 7, 'N');
      face(b, { eye: 'slit', brow: 'flat', mouth: 'flat' }); b.rect(11, 19, 10, 2, 'P'); b.rect(12, 19, 8, 1, 'N');
      b.box(22, 25, 8, 12, 'R', 'K'); b.rect(24, 28, 4, 1, 'G'); b.rect(25, 30, 2, 4, 'G'); b.rect(3, 24, 1, 9, 'K'); hand(b, 4, 33);
      return b.outline('K');
    },
    co_giao: function () {   // búi thấp, kính, áo dài xanh, sách và thước
      const b = fig(); torso(b, 'B'); head(b); b.poly([[13, 28], [19, 28], [16, 31]], 'P'); shade(b);
      b.poly([[8, 14], [8, 8], [11, 5], [16, 4], [21, 5], [24, 8], [24, 14], [22, 10], [16, 8], [10, 10]], 'K'); b.ell(16, 3, 4, 3, 'K');
      face(b, { eye: 'dot', brow: 'flat', mouth: 'smile' }); glasses(b);
      b.box(20, 28, 9, 9, 'R', 'K'); b.rect(22, 30, 5, 1, 'G'); b.rect(22, 32, 5, 1, 'G'); b.rect(3, 25, 2, 11, 'G'); hand(b, 19, 36);
      return b.outline('K');
    },
    anh_shipper: function () {   // mũ bảo hiểm xanh lá, áo xanh, thùng hàng
      const b = fig(); torso(b, 'L'); head(b); shade(b);
      b.poly([[7, 13], [7, 6], [11, 2], [21, 2], [25, 6], [25, 13]], 'L'); b.rect(6, 12, 20, 2, 'K'); b.rect(8, 6, 16, 1, 'G'); b.rect(13, 2, 6, 3, 'G');
      face(b, { eye: 'wide', brow: 'worry', mouth: 'open' });
      b.box(17, 28, 13, 10, 'N', 'K'); b.rect(22, 28, 3, 10, 'G'); b.rect(18, 31, 4, 1, 'G'); hand(b, 17, 35);
      return b.outline('K');
    },
    ba_ve_so: function () {   // nón lá, áo nâu, tập vé số dài
      const b = fig(); torso(b, 'N'); head(b); b.poly([[13, 28], [19, 28], [16, 31]], 'P'); shade(b);
      nonLa(b, 'G'); face(b, { eye: 'smile', brow: 'up', mouth: 'smile', blush: true });
      b.rect(23, 22, 5, 14, 'P'); b.rect(24, 24, 3, 1, 'R'); b.rect(24, 27, 3, 1, 'R'); b.rect(24, 30, 3, 1, 'R'); b.rect(24, 33, 3, 1, 'R'); b.rect(25, 22, 1, 14, 'K'); hand(b, 22, 37);
      return b.outline('K');
    },
    chu_tho_may: function () {   // ria, thước dây quanh cổ, kéo
      const b = fig(); torso(b, 'L'); head(b); b.poly([[13, 28], [19, 28], [16, 31]], 'P'); shade(b);
      cropHair(b); face(b, { eye: 'dot', brow: 'flat', mouth: 'flat' }); b.rect(12, 19, 8, 1, 'K'); b.set(11, 20, 'K'); b.set(20, 20, 'K');
      b.line(10, 27, 16, 34, 'G'); b.line(22, 27, 16, 34, 'G'); b.line(10, 28, 16, 35, 'K'); b.line(22, 28, 16, 35, 'K');
      b.line(22, 24, 27, 33, 'K'); b.line(27, 24, 22, 33, 'K'); b.rect(21, 33, 3, 3, 'R'); b.rect(26, 33, 3, 3, 'R'); hand(b, 25, 31);
      return b.outline('K');
    },
    ong_cau_ca: function () {   // nón rộng vành, cần câu, cá nhỏ
      const b = fig(); torso(b, 'L'); head(b); b.poly([[13, 28], [19, 28], [16, 31]], 'P'); shade(b);
      b.poly([[9, 10], [9, 5], [13, 2], [19, 2], [23, 5], [23, 10]], 'G'); b.rect(3, 9, 26, 2, 'G'); b.rect(3, 11, 26, 1, 'K');
      face(b, { eye: 'slit', brow: 'flat', mouth: 'smile' });
      b.line(10, 38, 28, 14, 'N'); b.line(11, 38, 29, 14, 'K'); b.line(29, 14, 29, 24, 'K'); b.ell(29, 27, 2, 3, 'R'); hand(b, 12, 35);
      return b.outline('K');
    },
    me_chong: function () {   // búi trâm vàng, áo nâu, muỗng gỗ, nhìn nghiêm
      const b = fig(); torso(b, 'N'); head(b); b.poly([[13, 28], [19, 28], [16, 31]], 'P'); shade(b);
      bun(b); b.line(19, 2, 27, 6, 'G'); b.line(19, 3, 27, 7, 'G');
      face(b, { eye: 'slit', brow: 'angry', mouth: 'frown' }); b.rect(11, 18, 1, 3, 'N'); b.rect(20, 18, 1, 3, 'N');
      b.rect(25, 25, 2, 12, 'G'); b.ell(26, 23, 3, 4, 'G', 'K'); hand(b, 26, 33);
      return b.outline('K');
    },
    thang_em: function () {   // tóc tổ chim, áo sọc, toe toét cầm lá bài
      const b = fig(); torso(b, 'B'); head(b); shade(b);
      for (let y = 30; y < 40; y += 3) b.rect(5, y, 22, 1, 'P');
      b.poly([[8, 11], [8, 6], [10, 2], [13, 5], [16, 1], [19, 5], [22, 2], [24, 6], [24, 11], [22, 8], [16, 6], [10, 8]], 'K');
      face(b, { eye: 'wide', brow: 'up', mouth: 'grin', blush: true });
      cardAt(b, 25, 30, 0.25, 'R'); hand(b, 24, 37);
      return b.outline('K');
    },
    chi_ban_hoa: function () {   // tóc tết, hoa cài, bó hoa
      const b = fig(); torso(b, 'R'); head(b); b.poly([[13, 28], [19, 28], [16, 31]], 'P'); shade(b);
      b.poly([[8, 16], [8, 8], [11, 5], [16, 4], [21, 5], [24, 8], [24, 16], [22, 10], [16, 8], [10, 10]], 'K'); b.rect(6, 15, 3, 15, 'K'); b.rect(24, 15, 3, 15, 'K'); b.rect(6, 18, 3, 1, 'G'); b.rect(6, 23, 3, 1, 'G');
      b.ell(24, 6, 2.5, 2.5, 'G'); b.rect(24, 6, 1, 1, 'R');
      face(b, { eye: 'smile', brow: 'up', mouth: 'smile', blush: true });
      b.line(23, 37, 24, 29, 'L'); b.line(26, 37, 26, 28, 'L');
      [[22, 27], [26, 25], [29, 29], [24, 31]].forEach(p => b.ell(p[0], p[1], 2.2, 2.2, 'G', 'K'));
      b.rect(22, 26, 1, 1, 'R'); b.rect(26, 24, 1, 1, 'R');
      return b.outline('K');
    },
    ong_ke_toan: function () {   // hói, kính, cà vạt, bàn tính
      const b = fig(); torso(b, 'B'); head(b); b.poly([[13, 28], [19, 28], [16, 34]], 'P'); shade(b);
      sym(b, 7, 9, 2, 6, 'K'); b.rect(12, 6, 8, 1, 'K'); b.poly([[15, 30], [17, 30], [18, 36], [14, 36]], 'R');
      face(b, { eye: 'dot', brow: 'flat', mouth: 'flat' }); glasses(b);
      b.box(19, 27, 11, 10, 'N', 'K'); b.rect(19, 31, 11, 1, 'K'); [21, 23, 25, 27].forEach(x => { b.rect(x, 28, 1, 2, 'G'); b.rect(x, 33, 1, 2, 'G'); });
      return b.outline('K');
    },
    chu_ba_gac: function () {   // nón nan, khăn vắt vai, dây thừng
      const b = fig(); torso(b, 'N'); head(b); shade(b);
      b.poly([[4, 12], [16, 3], [28, 12]], 'G'); b.rect(4, 11, 24, 2, 'K'); b.line(8, 10, 24, 10, 'N');
      face(b, { eye: 'dot', brow: 'thick', mouth: 'smirk' });
      b.poly([[6, 28], [13, 27], [16, 33], [11, 40], [4, 40]], 'P'); b.line(8, 32, 11, 38, 'N'); b.line(13, 32, 10, 38, 'N');
      b.ell(25, 34, 5, 4, 'G', 'K'); b.ell(25, 34, 2, 1.5, 'N'); hand(b, 20, 36);
      return b.outline('K');
    },
    ba_mai: function () {   // khăn vấn, áo dài vàng, cành mai
      const b = fig(); torso(b, 'G'); head(b); b.poly([[13, 28], [19, 28], [16, 31]], 'P'); shade(b);
      b.poly([[8, 14], [8, 8], [11, 5], [16, 4], [21, 5], [24, 8], [24, 14], [22, 10], [16, 8], [10, 10]], 'K'); b.ell(16, 3, 5, 2.5, 'K'); b.ell(21, 4, 2, 2, 'G');
      face(b, { eye: 'smile', brow: 'up', mouth: 'smile', blush: true });
      b.line(21, 38, 27, 20, 'N'); b.line(22, 38, 28, 20, 'K'); b.line(25, 28, 30, 25, 'N');
      [[25, 18], [29, 22], [30, 26], [23, 25]].forEach(p => { b.ell(p[0], p[1], 2.4, 2.4, 'G', 'K'); b.rect(p[0], p[1], 1, 1, 'R'); }); hand(b, 22, 35);
      return b.outline('K');
    },
    thang_chau: function () {   // tóc cua, áo đỏ, phong bao lì xì
      const b = fig(); torso(b, 'R'); head(b); shade(b); cropHair(b);
      face(b, { eye: 'wide', brow: 'up', mouth: 'grin', blush: true });
      b.box(19, 24, 10, 13, 'R', 'G'); b.ell(24, 30, 2.5, 2.5, 'G'); b.rect(24, 30, 1, 1, 'R'); hand(b, 20, 36);
      return b.outline('K');
    },
    ong_thay_tuong: function () {   // khăn đóng, râu dài, kính, quạt
      const b = fig(); torso(b, 'B'); head(b); shade(b); khanDong(b);
      beard(b, 'P', 6); b.rect(14, 24, 1, 5, 'N'); b.rect(17, 24, 1, 5, 'N');
      face(b, { eye: 'slit', brow: 'flat', mouth: 'flat' }); glasses(b); b.rect(11, 19, 10, 1, 'N');
      fan(b, 25, 31, 'R'); hand(b, 24, 37);
      return b.outline('K');
    },
    co_ba_sai_gon: function () {   // nón lá quai đỏ, áo bà ba xanh, tay chắp
      const b = fig(); torso(b, 'B'); head(b); b.poly([[13, 28], [19, 28], [16, 31]], 'P'); shade(b);
      nonLa(b, 'G'); b.line(8, 12, 9, 22, 'R'); b.line(24, 12, 23, 22, 'R');
      face(b, { eye: 'smile', brow: 'up', mouth: 'smile', blush: true });
      b.rect(15, 33, 1, 1, 'G'); b.rect(15, 36, 1, 1, 'G'); hand(b, 14, 35); hand(b, 18, 35);
      return b.outline('K');
    },
    chu_ban_pho: function () {   // khăn rằn đỏ, tạp dề trắng, tô phở bốc khói
      const b = fig(); torso(b, 'P'); head(b); shade(b);
      b.poly([[8, 12], [8, 7], [12, 4], [20, 4], [24, 7], [24, 12], [22, 8], [16, 7], [10, 8]], 'R'); b.rect(9, 6, 14, 1, 'K'); b.rect(12, 5, 2, 1, 'P'); b.rect(18, 5, 2, 1, 'P');
      face(b, { eye: 'dot', brow: 'flat', mouth: 'smile' });
      b.rect(6, 29, 2, 10, 'N'); b.ell(25, 35, 7, 4, 'B', 'K'); b.rect(19, 31, 12, 3, 'P'); b.line(21, 32, 29, 32, 'G'); b.set(25, 31, 'R'); b.set(24, 31, 'L');
      [[21, 26], [25, 25], [29, 26]].forEach(p => { b.rect(p[0], p[1], 1, 4, 'P'); }); hand(b, 19, 35);
      return b.outline('K');
    },
    anh_bo_doi: function () {   // mũ cối sao vàng, quân phục, chào
      const b = fig(); torso(b, 'L'); head(b); shade(b);
      b.rect(5, 29, 5, 2, 'G'); b.rect(22, 29, 5, 2, 'G');
      b.poly([[7, 10], [7, 6], [11, 2], [21, 2], [25, 6], [25, 10]], 'L'); b.rect(5, 9, 22, 2, 'L'); b.rect(15, 4, 2, 3, 'G'); b.rect(14, 5, 4, 1, 'G');
      face(b, { eye: 'dot', brow: 'flat', mouth: 'smile' });
      b.rect(24, 15, 4, 14, 'L'); hand(b, 26, 12);
      return b.outline('K');
    },
    ba_ngoai: function () {   // tóc bạc búi, áo nâu, trầu, gậy
      const b = fig(); torso(b, 'N'); head(b); b.poly([[13, 28], [19, 28], [16, 31]], 'P'); shade(b);
      bun(b); for (let y = 4; y < 12; y++) for (let x = 9; x < 24; x++) if (b.get(x, y) === 'K' && (x + y) % 3 === 0) b.set(x, y, 'P');
      face(b, { eye: 'slit', brow: 'worry', mouth: 'betel' }); b.rect(10, 18, 1, 3, 'N'); b.rect(21, 18, 1, 3, 'N');
      b.rect(26, 22, 3, 18, 'G'); b.rect(25, 22, 5, 2, 'G'); hand(b, 27, 33);
      return b.outline('K');
    },
    cau_ut: function () {   // cậu bé tóc cua, áo đỏ, một lá rác lẻ
      const b = fig(); torso(b, 'R'); head(b); shade(b); cropHair(b);
      face(b, { eye: 'dot', brow: 'worry', mouth: 'smile', blush: true });
      cardAt(b, 24, 31, -0.15, 'R'); hand(b, 22, 37);
      return b.outline('K');
    },
    chi_hang_ca: function () {   // nón lá, tạp dề, cá chép đỏ
      const b = fig(); torso(b, 'N'); head(b); b.poly([[13, 28], [19, 28], [16, 31]], 'P'); shade(b);
      nonLa(b, 'G'); face(b, { eye: 'wide', brow: 'up', mouth: 'grin', blush: true });
      b.ell(23, 32, 6.5, 3.5, 'R', 'K'); b.poly([[28, 32], [31, 28], [31, 37]], 'R'); b.rect(19, 31, 1, 1, 'K'); b.line(22, 30, 22, 34, 'G'); b.line(25, 30, 25, 34, 'G'); hand(b, 17, 36);
      return b.outline('K');
    },
    ong_giao: function () {   // khăn đóng, râu dê, áo dài xanh, cuộn sách
      const b = fig(); torso(b, 'B'); head(b); shade(b); khanDong(b);
      b.poly([[13, 22], [19, 22], [16, 28]], 'K'); face(b, { eye: 'slit', brow: 'flat', mouth: 'flat' });
      b.box(19, 27, 10, 6, 'P', 'K'); b.rect(19, 27, 2, 6, 'R'); b.rect(27, 27, 2, 6, 'R'); b.line(22, 29, 26, 29, 'K'); b.line(22, 31, 26, 31, 'K'); hand(b, 18, 33);
      return b.outline('K');
    },
    // ---- Báu vật
    than_tai: function () {   // mũ cánh chuồn vàng, áo đỏ, râu đen dài, thỏi vàng
      const b = fig(); torso(b, 'R'); head(b); shade(b); b.rect(10, 28, 12, 2, 'G');
      wing(b, 'G'); b.rect(10, 1, 12, 2, 'G'); beard(b, 'K', 8);
      face(b, { eye: 'smile', brow: 'up', mouth: 'flat', blush: true }); b.rect(13, 21, 6, 1, 'P');
      b.poly([[18, 37], [21, 30], [31, 30], [29, 37]], 'G'); b.line(22, 33, 29, 33, 'N'); b.line(21, 30, 29, 30, 'K');
      return b.outline('K');
    },
    ong_dia: function () {   // mặt tròn cười, bụng phệ, quạt đỏ
      const b = fig(); b.ell(16, 35, 14, 10, 'G'); b.ell(16, 35, 3, 3, 'N'); b.ell(16, 14.5, 9.5, 10, 'P'); b.ell(7, 15, 1.8, 2.4, 'P'); b.ell(25, 15, 1.8, 2.4, 'P');
      shade(b); b.rect(9, 3, 14, 5, 'K'); b.rect(9, 7, 14, 1, 'R');
      face(b, { eye: 'smile', brow: 'up', mouth: 'grin', blush: true });
      fan(b, 25, 27, 'R'); hand(b, 24, 34);
      return b.outline('K');
    },
    tao_quan: function () {   // mũ cánh chuồn đen, áo vàng, bếp lửa
      const b = fig(); torso(b, 'G'); head(b); shade(b); wing(b, 'R');
      beard(b, 'P', 5); face(b, { eye: 'dot', brow: 'thick', mouth: 'flat' }); b.rect(11, 19, 10, 2, 'P'); b.rect(13, 21, 6, 1, 'N');
      b.box(4, 31, 24, 9, 'N', 'K'); b.rect(7, 33, 18, 5, 'K'); b.poly([[10, 38], [16, 28], [22, 38]], 'R'); b.poly([[13, 38], [16, 32], [19, 38]], 'G');
      return b.outline('K');
    },
    vua_bai: function () {   // vương miện, áo đỏ viền lông, quạt bài
      const b = fig(); torso(b, 'R'); head(b); shade(b);
      b.poly([[7, 30], [25, 30], [26, 40], [6, 40]], 'P'); b.poly([[8, 27], [12, 26], [16, 33], [20, 26], [24, 27], [24, 31], [8, 31]], 'P');
      b.poly([[8, 9], [8, 2], [12, 5], [16, 1], [20, 5], [24, 2], [24, 9]], 'G'); b.rect(8, 7, 16, 2, 'G'); b.rect(15, 5, 2, 2, 'R');
      face(b, { eye: 'dot', brow: 'angry', mouth: 'smirk' });
      b.rect(10, 19, 12, 1, 'K'); [-0.55, 0, 0.55].forEach(a => cardAt(b, 24 + a * 6, 33, a, 'R')); hand(b, 24, 38);
      return b.outline('K');
    },
    ca_chep: function () {   // cá chép đỏ vảy vàng nhảy lên, râu và bọt nước
      const b = fig();
      b.poly([[10, 29], [4, 38], [8, 40], [16, 35], [24, 40], [28, 38], [22, 29]], 'R');
      b.ell(16, 17, 10, 14, 'R'); b.poly([[7, 14], [2, 9], [3, 22]], 'R'); b.poly([[25, 14], [29, 9], [28, 22]], 'R'); b.poly([[12, 5], [16, 1], [20, 5]], 'R');
      for (let y = 16; y < 32; y += 4) for (let x = 9 + ((y / 4) % 2) * 3; x < 24; x += 6) b.rect(x, y, 3, 2, 'G');
      b.ell(11, 11, 2.6, 2.6, 'P', 'K'); b.ell(21, 11, 2.6, 2.6, 'P', 'K'); b.rect(11, 11, 2, 2, 'K'); b.rect(20, 11, 2, 2, 'K');
      b.rect(14, 15, 4, 3, 'K'); b.rect(15, 16, 2, 1, 'N'); b.line(9, 16, 3, 18, 'N'); b.line(23, 16, 29, 18, 'N');
      shade(b);
      return b.outline('K');
    },
  };

  const despeckle = k4.despeckle;
  function buildFig(id) { if (!CHARS[id]) throw new Error('Art.quyNhan: unknown id ' + id); return despeckle(CHARS[id]()); }
  function build(id) {
    const b = new Buf(48, 64), bau = BAU.indexOf(id) >= 0; K.qnFrame(b);
    if (bau) {   // double gold frame, carved corners and edge studs (as step 4)
      b.frame(3, 3, 42, 58, 'K'); b.frame(4, 4, 40, 56, 'G'); b.frame(5, 5, 38, 54, 'K');
      const cor = ['GGK', 'GKG', 'KG.'], mi = cor.map(r => r.split('').reverse().join(''));
      b.grid(cor, 3, 3); b.grid(mi, 42, 3); b.grid(cor.slice().reverse(), 3, 58); b.grid(mi.slice().reverse(), 42, 58);
      for (let x = 12; x < 38; x += 6) { b.set(x, 3, 'G'); b.set(x, 60, 'G'); }
      for (let y = 14; y < 56; y += 8) { b.set(3, y, 'G'); b.set(44, y, 'G'); }
    }
    b.rect(6, 4, 36, 39, 'K'); backdrop(b, 7, 5, 34, 37, BG[id]); b.blit(buildFig(id), 8, 5); b.frame(6, 4, 36, 39, bau ? 'G' : 'K');
    [[20, 45], [24, 45], [28, 45]].forEach(function (p) { b.set(p[0], p[1], 'G'); });
    b.box(5, 47, 38, 12, 'R', 'G'); b.frame(4, 46, 40, 14, 'K');
    return b;
  }
  const CACHE = {}, oQ = A.quyNhan;
  A.quyNhan = function (id) { return BG[id] ? (CACHE[id] || (CACHE[id] = build(id).toCanvas())) : oQ(id); };
  A._ids5 = Object.keys(BG); A._fig5 = buildFig; A._buf5 = build;
  const oInit = A.init;
  A.init = function () { return oInit().then(function () { A._ids5.forEach(A.quyNhan); return true; }); };
})(globalThis.TL = globalThis.TL || {});
