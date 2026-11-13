/* js/art4.js  (owner ART) wraps TL.Art after art3.js: R5 step 5, every opponent / boss portrait redrawn on a 32x40 figure grid with ONE shared face
 * (head ellipse, eye / brow / nose / mouth positions are identical, only the expression and the props change), Dong Ho woodblock look:
 * heavy K outline, flat colour, one shade tone per colour (dithered rim on the right), a readable silhouette and a prop per character.
 * API (extends TL.Art; ids not listed keep their older textures)
 *   TL.Art.portrait(id)  ong_tao thim_ut duong_tu ba_noi chu_bay di_nam chu_ba bac_tam anh_re ong_sau co_hai bac_chin di_ut -> canvas 48x48 (figure 32x40 in a lacquer frame, bust cropped by the frame)
 *   TL.Art._ids4 / TL.Art._fig4(id) -> Buf 32x40 (no DOM; _fig4(id)._ok = deliberate single pixels) / TL.Art._buf4(id) -> Buf 48x48, for tests/art.lint.js
 */
(function (TL) {
  'use strict';
  const A = TL.Art, K = A._kit, Buf = K.Buf, backdrop = K.backdrop, clipCorners = K.clipCorners;
  const FW = 32, FH = 40;
  const BG = { ong_tao: 'L', thim_ut: 'B', duong_tu: 'L', ba_noi: 'R', chu_bay: 'G', di_nam: 'B', chu_ba: 'R', bac_tam: 'L', anh_re: 'G', ong_sau: 'R', co_hai: 'R', bac_chin: 'R', di_ut: 'R' };
  const SHADE = { P: 'N', R: 'N', G: 'N', B: 'K', L: 'K', N: 'K' };   // one shade tone per colour

  const fig = () => { const b = new Buf(FW, FH); b._ok = []; return b; };
  const mir = x => 31 - x;                                              // mirror a pixel column about the face axis
  const sym = (b, x, y, w, h, c) => { b.rect(x, y, w, h, c); b.rect(mir(x + w - 1), y, w, h, c); };
  const symSet = (b, x, y, c) => { b.set(x, y, c); b.set(mir(x), y, c); };
  const spark = (b, x, y, c) => { b.set(x, y, c); b._ok.push([x, y]); };
  const torso = (b, c) => b.poly([[2, 40], [2.5, 32], [6, 27], [12, 25.5], [20, 25.5], [26, 27], [29.5, 32], [30, 40]], c);
  const SK = ['P'];

  // the shared head: skull, ears, neck. Every portrait starts from this, so the whole cast reads as one family.
  function head(b) {
    b.rect(13, 21, 6, 9, 'P');
    b.ell(8, 15, 1.8, 2.4, 'P'); b.ell(24, 15, 1.8, 2.4, 'P');
    b.ell(16, 14.5, 8, 9, 'P');
  }
  // right-hand rim shade (light from the left): edge pixel solid, the next one dithered
  function shade(b) {
    const s = b.d.slice(), w = b.w;
    for (let y = 0; y < b.h; y++) for (let x = 0; x < w - 2; x++) {
      const c = s[y * w + x], t = SHADE[c]; if (!t) continue;
      if (x < 3 || s[y * w + x - 1] !== c || s[y * w + x - 2] !== c) continue;   // thin shapes stay flat
      if (s[y * w + x + 1] !== c) b.set(x, y, t);
      else if (s[y * w + x + 2] !== c && (x + y) % 2 === 0) b.set(x, y, t);
    }
  }
  const EYE = {
    dot: (b, x) => b.rect(x, 14, 2, 2, 'K'),
    slit: (b, x) => b.rect(x - 1, 15, 4, 1, 'K'),
    smile: (b, x) => { b.set(x - 1, 15, 'K'); b.set(x, 14, 'K'); b.set(x + 1, 14, 'K'); b.set(x + 2, 15, 'K'); },
    wide: (b, x) => { b.rect(x - 1, 13, 4, 4, 'K'); b.rect(x, 14, 2, 2, 'P'); b.set(x + 1, 15, 'K'); },
  };
  const BROW = {   // left brow, outer end at x 9, inner end at x 13 (mirrored for the right)
    flat: [[9, 11], [10, 11], [11, 11], [12, 11], [13, 11]],
    up: [[9, 11], [10, 10], [11, 10], [12, 10], [13, 11]],
    angry: [[9, 10], [10, 10], [11, 11], [12, 11], [13, 12]],
    worry: [[9, 12], [10, 11], [11, 11], [12, 10], [13, 10]],
    thick: [[9, 10], [10, 10], [11, 10], [12, 10], [13, 10], [9, 11], [10, 11], [11, 11], [12, 11], [13, 11]],
  };
  const MOUTH = {
    smile: b => { symSet(b, 13, 20, 'K'); b.rect(14, 21, 4, 1, 'K'); },
    grin: b => { b.box(13, 20, 6, 3, 'R', 'K'); b.rect(14, 21, 4, 1, 'P'); },
    frown: b => { symSet(b, 13, 22, 'K'); b.rect(14, 21, 4, 1, 'K'); },
    flat: b => b.rect(13, 21, 6, 1, 'K'),
    smirk: b => { b.rect(13, 21, 4, 1, 'K'); b.set(17, 20, 'K'); b.set(18, 19, 'K'); },
    betel: b => b.box(13, 20, 6, 3, 'R', 'K'),
    lip: b => { b.rect(14, 20, 4, 1, 'K'); b.rect(13, 21, 6, 1, 'R'); },
    open: b => { b.rect(14, 20, 4, 3, 'K'); b.rect(15, 21, 2, 1, 'R'); },
  };
  // eyes, brows, nose, mouth, cheeks: identical places for everybody; o = {eye, brow | browL+browR, mouth, blush}
  function face(b, o) {
    const e = EYE[o.eye || 'dot'];
    e(b, 11); e(b, 19);
    [[o.browL || o.brow || 'flat', false], [o.browR || o.brow || 'flat', true]].forEach(function (p) {
      BROW[p[0]].forEach(function (q) { b.set(p[1] ? mir(q[0]) : q[0], q[1], 'K'); });
    });
    b.set(16, 17, 'N'); b.set(15, 18, 'N'); b.set(16, 18, 'N');
    MOUTH[o.mouth || 'smile'](b);
    if (o.blush) { sym(b, 9, 18, 2, 2, 'R'); }
  }
  const hand = (b, x, y) => { b.ell(x, y, 3, 3, 'P', 'K'); b.rect(Math.round(x) - 1, Math.round(y), 1, 2, 'K'); b.rect(Math.round(x) + 1, Math.round(y), 1, 2, 'K'); };
  const cardAt = (b, cx, cy, a, pip) => {
    const rot = (dx, dy) => [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)];
    b.poly([rot(-3.2, -5), rot(3.2, -5), rot(3.2, 5), rot(-3.2, 5)], 'K');
    b.poly([rot(-2.2, -4), rot(2.2, -4), rot(2.2, 4), rot(-2.2, 4)], 'P');
    const p = rot(0, -1); b.rect(Math.round(p[0] - 1), Math.round(p[1] - 1), 2, 2, pip || 'R');
  };

  const CHARS = {
    ong_tao: function () {   // Ông Táo: mũ cánh chuồn, áo đỏ, râu dài bạc, mắt cười
      const b = fig(); torso(b, 'R');
      b.poly([[9, 19], [23, 19], [22, 27], [16, 33], [10, 27]], 'K'); b.poly([[10, 19], [22, 19], [21, 26], [16, 31], [11, 26]], 'P');
      head(b); b.rect(10, 28, 12, 2, 'G'); b.poly([[12, 29], [20, 29], [16, 32]], 'G');
      shade(b);
      b.rect(10, 1, 12, 7, 'K'); b.rect(10, 7, 12, 1, 'G'); sym(b, 1, 4, 9, 2, 'K'); sym(b, 1, 4, 2, 2, 'G');
      face(b, { eye: 'smile', brow: 'up', mouth: 'flat', blush: true });
      b.rect(11, 19, 10, 2, 'K'); b.rect(13, 21, 6, 1, 'P');
      [[14, 24], [18, 25], [16, 28]].forEach(p => b.rect(p[0], p[1], 1, 2, 'N'));
      return b.outline('K');
    },
    thim_ut: function () {   // Thím Út: búi tóc cài trâm, áo bà ba lá, quạt giấy, hóng chuyện
      const b = fig(); torso(b, 'L');
      head(b); b.poly([[13, 28], [19, 28], [16, 31]], 'P');
      shade(b); b.rect(15, 34, 2, 2, 'G'); b.rect(15, 37, 2, 2, 'G');
      b.poly([[8, 14], [8, 8], [11, 5], [16, 4], [21, 5], [24, 8], [24, 14], [22, 10], [16, 8], [10, 10]], 'K'); b.ell(16, 3, 4.5, 3, 'K');
      b.line(20, 2, 27, 4, 'G'); b.line(20, 3, 27, 5, 'G');
      face(b, { eye: 'slit', browL: 'up', browR: 'flat', mouth: 'smirk', blush: true });
      b.rect(24, 31, 2, 9, 'N');
      b.ell(25, 29, 5.5, 5.5, 'R'); b.line(25, 29, 21, 24, 'K'); b.line(25, 29, 25, 23, 'K'); b.line(25, 29, 29, 24, 'K');
      hand(b, 25, 35);
      return b.outline('K');
    },
    duong_tu: function () {   // Dượng Tư: nón cối sao vàng, khăn rằn, chén rượu, đỏ mặt
      const b = fig(); torso(b, 'G');
      b.poly([[7, 31], [25, 28], [26, 32], [10, 36]], 'R');
      head(b);
      shade(b);
      b.poly([[7, 10], [7, 6], [11, 2], [21, 2], [25, 6], [25, 10]], 'L'); b.rect(5, 9, 22, 2, 'L'); b.rect(15, 4, 2, 3, 'G'); b.rect(14, 5, 4, 1, 'G');
      for (let x = 9; x < 25; x += 4) { b.rect(x, 32, 2, 2, 'N'); }
      face(b, { eye: 'smile', brow: 'flat', mouth: 'grin', blush: true });
      b.rect(11, 19, 10, 1, 'K');
      b.box(22, 28, 7, 7, 'G', 'K'); b.rect(23, 29, 5, 2, 'R'); hand(b, 21, 36);
      return b.outline('K');
    },
    ba_noi: function () {   // Bà Nội (boss): khăn mỏ quạ, áo bà ba nâu, nhai trầu, gậy
      const b = fig(); torso(b, 'N');
      head(b); b.poly([[13, 28], [19, 28], [16, 31]], 'P');
      shade(b);
      b.poly([[6, 16], [6, 8], [11, 3], [17, 2], [23, 3], [26, 8], [26, 16], [23, 12], [16, 9], [9, 12]], 'K'); b.poly([[21, 5], [29, 3], [28, 11]], 'K');
      face(b, { eye: 'slit', brow: 'angry', mouth: 'betel' });
      b.rect(11, 18, 1, 3, 'N'); b.rect(20, 18, 1, 3, 'N'); b.rect(12, 8, 8, 1, 'N');
      b.rect(26, 24, 3, 16, 'G'); b.rect(26, 24, 3, 1, 'K'); hand(b, 27, 33);
      return b.outline('K');
    },
    chu_bay: function () {   // Chú Bảy: mũ lưỡi trai đỏ, áo xanh, ria, chén trà
      const b = fig(); torso(b, 'B');
      head(b); b.poly([[12, 28], [20, 28], [16, 31]], 'P');
      shade(b);
      b.poly([[8, 10], [8, 6], [12, 2], [20, 2], [24, 6], [24, 10]], 'R'); b.rect(7, 9, 18, 2, 'K'); b.rect(15, 4, 2, 2, 'G');
      face(b, { eye: 'dot', brow: 'flat', mouth: 'smile' });
      b.rect(12, 19, 8, 1, 'K'); b.set(11, 20, 'K'); b.set(20, 20, 'K');
      b.box(20, 30, 8, 6, 'P', 'K'); b.rect(21, 31, 6, 1, 'G'); hand(b, 19, 34);
      b.rect(22, 26, 1, 3, 'P'); b.rect(25, 25, 1, 4, 'P');
      return b.outline('K');
    },
    di_nam: function () {   // Dì Năm: tóc uốn xoăn, bông tai vàng, áo dài đỏ, túi xách
      const b = fig(); torso(b, 'R');
      head(b); b.rect(11, 27, 10, 3, 'G');
      shade(b);
      [[10, 7, 4.5, 4.5], [16, 5, 5, 4], [22, 7, 4.5, 4.5], [7.5, 14, 3.2, 5], [24.5, 14, 3.2, 5]].forEach(p => b.ell(p[0], p[1], p[2], p[3], 'K'));
      sym(b, 7, 19, 2, 3, 'G');
      face(b, { eye: 'wide', brow: 'up', mouth: 'lip', blush: true });
      b.box(21, 31, 8, 7, 'G', 'K'); b.line(23, 31, 21, 27, 'K'); b.line(27, 31, 29, 27, 'K'); b.line(21, 27, 29, 27, 'K');
      return b.outline('K');
    },
    chu_ba: function () {   // Chú Ba (boss): húi cua, áo xanh, bàn tay xòe "cấm"
      const b = fig(); torso(b, 'B');
      head(b); b.poly([[12, 28], [20, 28], [16, 30]], 'P');
      shade(b);
      b.poly([[8, 12], [8, 8], [12, 5], [20, 5], [24, 8], [24, 12], [22, 8], [16, 7], [10, 8]], 'K');
      face(b, { eye: 'dot', brow: 'thick', mouth: 'frown' });
      b.rect(11, 19, 10, 1, 'K');
      b.ell(24, 30, 6, 5.5, 'P'); b.rect(19, 21, 2, 8, 'P'); b.rect(22, 17, 2, 12, 'P'); b.rect(25, 16, 2, 13, 'P'); b.rect(28, 19, 2, 10, 'P'); b.ell(18, 31, 2, 3, 'P'); b.rect(22, 33, 5, 1, 'N');
      return b.outline('K');
    },
    bac_tam: function () {   // Bác Tám: tổ trưởng, kính tròn, băng đỏ, sổ ghi chép
      const b = fig(); torso(b, 'B');
      head(b); b.poly([[13, 28], [19, 28], [16, 31]], 'P');
      shade(b);
      b.poly([[8, 11], [8, 8], [12, 5], [20, 5], [24, 8], [24, 11], [22, 8], [10, 10]], 'K');
      b.rect(3, 33, 7, 5, 'R'); b.rect(5, 34, 2, 3, 'G');
      face(b, { eye: 'dot', brow: 'flat', mouth: 'flat' });
      b.frame(9, 12, 6, 5, 'K'); b.frame(17, 12, 6, 5, 'K'); b.rect(15, 14, 2, 1, 'K');
      b.rect(10, 13, 4, 3, 'P'); b.rect(18, 13, 4, 3, 'P'); b.rect(11, 14, 2, 2, 'K'); b.rect(19, 14, 2, 2, 'K');
      b.box(20, 31, 9, 9, 'N', 'K'); b.rect(22, 33, 5, 1, 'G'); b.rect(22, 35, 5, 1, 'G'); b.rect(26, 28, 1, 5, 'K'); hand(b, 19, 36);
      return b.outline('K');
    },
    anh_re: function () {   // Anh rể: tóc vuốt keo, vest xanh cà vạt đỏ, giỏ quà, mồ hôi lo lắng
      const b = fig(); torso(b, 'B');
      b.poly([[13, 28], [19, 28], [16, 34]], 'P');
      head(b);
      shade(b);
      b.poly([[8, 12], [8, 7], [11, 3], [17, 2], [23, 4], [24, 9], [22, 6], [16, 6], [11, 8]], 'K'); b.rect(12, 3, 4, 1, 'N');
      b.poly([[15, 29], [17, 29], [18, 34], [16, 36], [14, 34]], 'R');
      b.line(12, 28, 9, 34, 'K'); b.line(19, 28, 22, 34, 'K');
      face(b, { eye: 'wide', brow: 'worry', mouth: 'smile', blush: true });
      b.rect(26, 9, 2, 3, 'B');
      b.box(20, 31, 10, 9, 'R', 'G'); b.rect(24, 31, 2, 9, 'G'); b.rect(21, 30, 8, 2, 'G'); hand(b, 19, 35);
      return b.outline('K');
    },
    ong_sau: function () {   // Ông Sáu (boss): nón phớt, râu dê, ngón trỏ chỉ lên
      const b = fig(); torso(b, 'L');
      head(b); b.poly([[12, 28], [20, 28], [16, 31]], 'P'); b.poly([[12, 22], [20, 22], [16, 27]], 'N');
      shade(b);
      b.poly([[10, 8], [10, 2], [22, 2], [22, 8]], 'N'); b.rect(5, 8, 22, 2, 'N'); b.rect(10, 6, 12, 2, 'R');
      face(b, { eye: 'dot', brow: 'angry', mouth: 'frown' });
      b.rect(11, 19, 10, 1, 'N');
      b.ell(25, 35, 5, 4.5, 'P'); b.rect(24, 19, 3, 15, 'P'); b.rect(21, 30, 3, 3, 'P'); b.rect(22, 35, 1, 3, 'K'); b.rect(25, 36, 1, 3, 'K'); b.rect(28, 35, 1, 3, 'K');
      return b.outline('K');
    },
    co_hai: function () {   // Cô Hai (boss): búi tóc, bông tai, áo dài vàng, quạt ba lá cùng chất
      const b = fig(); torso(b, 'G');
      head(b); b.rect(12, 27, 8, 3, 'R');
      shade(b);
      b.poly([[8, 14], [8, 8], [11, 5], [16, 4], [21, 5], [24, 8], [24, 14], [22, 10], [16, 8], [10, 10]], 'K'); b.ell(16, 3, 4, 3, 'K'); b.rect(19, 2, 3, 2, 'R');
      sym(b, 7, 19, 2, 3, 'R');
      face(b, { eye: 'slit', brow: 'up', mouth: 'lip', blush: true });
      [-0.5, 0, 0.5].forEach(a => cardAt(b, 23 + a * 7, 31, a, 'R'));
      hand(b, 23, 38);
      return b.outline('K');
    },
    bac_chin: function () {   // Bác Chín (boss): hói, ria dày, gile xanh, heo đất bị gạch
      const b = fig(); torso(b, 'L');
      head(b); b.poly([[12, 28], [20, 28], [16, 33]], 'P'); 
      shade(b);
      sym(b, 7, 9, 2, 6, 'K'); b.rect(12, 6, 8, 1, 'K');
      face(b, { eye: 'dot', brow: 'thick', mouth: 'frown' });
      b.poly([[9, 18], [16, 19], [23, 18], [22, 21], [16, 20], [10, 21]], 'K');
      b.ell(24, 33, 6, 5, 'R'); b.rect(19, 27, 3, 3, 'R'); b.rect(26, 27, 3, 3, 'R'); b.rect(20, 37, 2, 3, 'R'); b.rect(26, 37, 2, 3, 'R'); b.rect(28, 31, 3, 3, 'G');
      b.rect(23, 28, 2, 1, 'K');
      b.line(18, 27, 30, 39, 'K'); b.line(19, 27, 31, 39, 'K'); b.line(30, 27, 18, 39, 'K'); b.line(31, 27, 19, 39, 'K');
      return b.outline('K');
    },
    di_ut: function () {   // Dì Út (boss): đuôi ngựa, áo xanh, giơ hai ngón "hai ván"
      const b = fig(); torso(b, 'B');
      head(b); b.poly([[13, 28], [19, 28], [16, 31]], 'P');
      shade(b);
      b.poly([[8, 14], [8, 8], [11, 5], [16, 4], [21, 5], [24, 8], [24, 12], [18, 8], [12, 9], [9, 14]], 'K');
      b.poly([[7, 7], [2, 10], [1, 19], [2, 28], [5, 21], [8, 15]], 'K'); b.rect(6, 6, 4, 4, 'R');
      face(b, { eye: 'wide', brow: 'up', mouth: 'smirk', blush: true });
      b.ell(25, 35, 5, 4.5, 'P'); b.rect(21, 20, 3, 15, 'P'); b.rect(26, 20, 3, 15, 'P'); b.rect(22, 36, 1, 3, 'K'); b.rect(25, 37, 1, 3, 'K'); b.rect(28, 36, 1, 3, 'K');
      return b.outline('K');
    },
  };

  // despeckle: a pixel with no 8-neighbour of its own colour takes the commonest colour among its 4-neighbours (deliberate sparks are in b._ok)
  function despeckle(b) {
    const ok = new Set(b._ok.map(p => p[0] + ',' + p[1]));
    for (let pass = 0; pass < 2; pass++) for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
      const c = b.get(x, y); if (c === '.' || ok.has(x + ',' + y)) continue;
      let same = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if ((i || j) && b.get(x + i, y + j) === c) same++;
      if (same) continue;
      const n = {}, best = { c: 'K', k: 0 };
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(d => { const q = b.get(x + d[0], y + d[1]); if (q !== '.') { n[q] = (n[q] || 0) + 1; if (n[q] > best.k) { best.c = q; best.k = n[q]; } } });
      if (best.k) b.set(x, y, best.c);
    }
    return b;
  }
  function buildFig(id) { if (!CHARS[id]) throw new Error('Art.portrait: unknown id ' + id); return despeckle(CHARS[id]()); }
  function buildPortrait(id) {
    const b = new Buf(48, 48);
    b.rect(0, 0, 48, 48, 'K'); b.rect(1, 1, 46, 46, 'G'); b.rect(2, 2, 44, 44, 'N'); clipCorners(b, 'K');
    backdrop(b, 3, 3, 42, 42, BG[id]); b.frame(2, 2, 44, 44, 'K');
    [[6, 4], [38, 4]].forEach(function (p) { b.grid(['.KK.', 'KRRK', 'KRRK', 'KRRK', '.KK.', '..G.', '..G.'], p[0], p[1]); });
    b.blit(buildFig(id), 8, 5);
    b.frame(2, 2, 44, 44, 'K'); clipCorners(b, 'K');
    return b;
  }

  const CACHE = {}, oP = A.portrait;
  A.portrait = function (id) { return BG[id] ? (CACHE[id] || (CACHE[id] = buildPortrait(id).toCanvas())) : oP(id); };
  A._ids4 = Object.keys(BG); A._fig4 = buildFig; A._buf4 = buildPortrait;
  const oInit = A.init;
  A.init = function () { return oInit().then(function () { A._ids4.forEach(A.portrait); return true; }); };
})(globalThis.TL = globalThis.TL || {});
