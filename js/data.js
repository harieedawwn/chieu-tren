/* js/data.js  (owner SPEC) all static content. Needs js/config.js loaded first.
 * API
 *   TL.DATA.QUY_NHAN   { id: {id, name, price, desc, quote} }   8 entries; price from CFG.PRICE.QN, desc from CFG.QN
 *   TL.DATA.SAO        { id: {id, name, combo, price, desc} }   6 entries; combo = Combo.type it upgrades
 *   TL.DATA.CHANG      [ {id, name, date, ban:[ {id, kind:'nho'|'lon'|'trum', name, tag, house:id|null} x3 ]} x3 ]
 *                      ban[].id doubles as Art.portrait(id); house = key of HOUSE_RULES (trum only)
 *   TL.DATA.HOUSE_RULES { id: {id, name, quote, short, mods:{oppLeads?|noChat?|mustBeat?}} }   3 entries
 *   TL.DATA.COMBO_NAME { rac, doi, sam, tuquy, sanh, doithong } -> display name
 *   TL.DATA.TEXT       nested UI strings; groups: game title btn hud kind stamp payout shop end menu settings msg help
 *                      '%d' = number (use TL.fmt), '%s' = string; replace with a plain String.replace
 * Tone: short, dry, adult. One name per concept. No teencode, memes or emoji.
 */
(function (TL) {
  'use strict';
  const CFG = TL.CFG;
  const Q = CFG.QN;

  const QUY_NHAN = {};
  [
    ['thay_boi', 'Thầy bói', 'Đầu ván, lật ' + Q.THAY_BOI_REVEAL + ' lá của đối thủ.', 'Xem một quẻ, lộ vài lá.'],
    ['co_hang_xom', 'Cô hàng xóm', 'Luôn thấy đối thủ còn mấy heo.', 'Chuyện nhà ai cô cũng biết.'],
    ['chu_xe_om', 'Chú xe ôm', 'Sảnh +' + Q.XE_OM_DIEM + ' Điểm mỗi lá.', 'Đi xa, chú tính thêm.'],
    ['thang_ban_than', 'Thằng bạn thân', 'Mỗi lần bỏ lượt, cộng dồn +' + Q.BAN_THAN_THE + ' Thế cho lượt đánh kế.', 'Nhịn tí, ăn cả vòng.'],
    ['heo_dat', 'Heo đất', 'Thắng vòng bằng heo: +' + Q.HEO_DAT_THE + ' Thế mãi. Heo bị chặt thì vỡ.', 'Nuôi lâu mới béo.'],
    ['dan_cho_lon', 'Dân chơi Chợ Lớn', 'Chặt thì nhân vòng ×' + Q.CHO_LON_CHAT_X + ' thay vì ×' + CFG.CHAT_X + '.', 'Đã chặt thì chặt cho đáng.'],
    ['ba_ban_xoi', 'Bà bán xôi', 'Rác +' + Q.BAN_XOI_THE + ' Thế.', 'Xôi ế cũng bán được.'],
    ['ong_do', 'Ông đồ', 'Đôi +' + Q.ONG_DO_THE + ' Thế.', 'Có đôi có cặp mới ra câu.'],
  ].forEach(function (r) {
    QUY_NHAN[r[0]] = { id: r[0], name: r[1], price: CFG.PRICE.QN[r[0]], desc: r[2], quote: r[3] };
  });

  const SAO = {};
  [
    ['tho_tu', 'Thổ Tú', 'rac'],
    ['thuy_dieu', 'Thủy Diệu', 'doi'],
    ['van_hon', 'Vân Hớn', 'sam'],
    ['thai_duong', 'Thái Dương', 'sanh'],
    ['moc_duc', 'Mộc Đức', 'doithong'],
    ['thai_bach', 'Thái Bạch', 'tuquy'],
  ].forEach(function (r) {
    const g = CFG.SAO_GAIN[r[2]];
    SAO[r[0]] = {
      id: r[0], name: r[1], combo: r[2], price: CFG.PRICE.SAO,
      desc: 'Mỗi cấp: +' + g.diem + ' Điểm, +' + g.the + ' Thế.',
    };
  });

  const HOUSE_RULES = {
    ba_noi: { id: 'ba_noi', name: 'Bà Nội', quote: 'Bà già rồi, cho bà đi trước.', short: 'Bà đi trước', mods: { oppLeads: true } },
    chu_ba: { id: 'chu_ba', name: 'Chú Ba', quote: 'Nhà này không cho chặt heo.', short: 'Cấm chặt', mods: { noChat: true } },
    ong_sau: { id: 'ong_sau', name: 'Ông Sáu', quote: 'Có đè là phải đè.', short: 'Phải đè', mods: { mustBeat: true } },
  };

  const CHANG = [
    {
      id: 'ong_tao', name: 'Ông Táo', date: '23 tháng Chạp',
      ban: [
        { id: 'thim_ut', kind: 'nho', name: 'Thím Út', tag: 'hàng xóm', house: null },
        { id: 'duong_tu', kind: 'lon', name: 'Dượng Tư', tag: 'chồng dì', house: null },
        { id: 'ba_noi', kind: 'trum', name: 'Bà Nội', tag: 'Luật nhà', house: 'ba_noi' },
      ],
    },
    {
      id: 'tat_nien', name: 'Tất niên', date: '30 tháng Chạp',
      ban: [
        { id: 'chu_bay', kind: 'nho', name: 'Chú Bảy', tag: 'bạn của ba', house: null },
        { id: 'di_nam', kind: 'lon', name: 'Dì Năm', tag: 'họ hàng', house: null },
        { id: 'chu_ba', kind: 'trum', name: 'Chú Ba', tag: 'Luật nhà', house: 'chu_ba' },
      ],
    },
    {
      id: 'giao_thua', name: 'Giao thừa', date: 'đêm 30',
      ban: [
        { id: 'bac_tam', kind: 'nho', name: 'Bác Tám', tag: 'tổ trưởng', house: null },
        { id: 'anh_re', kind: 'lon', name: 'Anh rể', tag: 'rể tương lai', house: null },
        { id: 'ong_sau', kind: 'trum', name: 'Ông Sáu', tag: 'Luật nhà', house: 'ong_sau' },
      ],
    },
  ];

  const COMBO_NAME = {
    rac: 'Rác', doi: 'Đôi', sam: 'Sám', tuquy: 'Tứ quý', sanh: 'Sảnh', doithong: 'Đôi thông',
  };

  const TEXT = {
    game: { title: 'Chiếu Trên', sub: 'Tiến Lên ngày Tết.', win: 'Mùng Một' },
    title: { play: 'Chơi mới', cont: 'Chơi tiếp', settings: 'Cài đặt' },
    btn: {
      danh: 'Đánh', bo: 'Bỏ lượt', goiy: 'Gợi ý', xep: 'Xếp', menu: 'Menu',
      xepRank: 'Xếp: số', xepSuit: 'Xếp: chất', ok: 'Được', back: 'Quay lại',
    },
    hud: {
      target: 'Mục tiêu', diemBan: 'Điểm bàn', pot: 'Vòng', van: 'Ván', vanLeft: 'Còn %d ván',
      lixi: 'Lì xì', chang: 'Chặng', ban: 'Bàn', level: 'Cấp %d', diem: 'Điểm', the: 'Thế',
      yourTurn: 'Lượt bạn', oppTurn: 'Đối thủ đang nghĩ', oppCards: 'Còn %d lá', oppHeo: 'Heo: %d',
      lead: 'Dẫn', house: 'Luật nhà', qn: 'Quý nhân',
    },
    kind: { nho: 'Bàn nhỏ', lon: 'Bàn lớn', trum: 'Bàn trùm' },
    stamp: {
      chat: 'Chặt!', anVong: 'Ăn trọn vòng.', thoiHeo: 'Thối heo.', thoiHeoN: 'Thối %d heo.',
      cong: 'Cóng.', veNhat: 'Về nhất.', toiTrang: 'Tới trắng.', boLuot: 'Bỏ lượt.',
      thua: 'Thua ván.', quaBan: 'Qua bàn.', heoVo: 'Heo đất vỡ.', thayBoi: 'Xem quẻ.',
    },
    payout: {
      title: 'Qua bàn', base: '%s', unused: 'Ván còn dư ×%d', interest: 'Bỏ ống', total: 'Tổng', next: 'Vào Chợ Tết',
    },
    shop: {
      title: 'Chợ Tết', buy: 'Mua', sell: 'Bán', reroll: 'Đổi hàng', next: 'Đi tiếp',
      full: 'Hết chỗ', poor: 'Không đủ lì xì', sold: 'Đã bán', slots: 'Quý nhân %d/%d',
      sellFor: 'Bán được %d', level: 'Cấp %d', sao: 'Sao chiếu mệnh', hint: 'Chạm một thẻ để xem.',
    },
    end: {
      win: 'Mùng Một', winSub: 'Qua ba chặng. Năm nay êm.',
      lose: 'Thua bàn', loseSub: 'Hết ván mà chưa đủ điểm.',
      stats: 'Thống kê',
      vans: 'Ván đã đánh', wins: 'Ván thắng', chat: 'Lần chặt', bestPlay: 'Bộ cao nhất',
      bestPot: 'Vòng béo nhất', toiTrang: 'Tới trắng', lixi: 'Lì xì còn lại',
      again: 'Chơi lại', toTitle: 'Về màn đầu', reached: 'Bàn đã tới', earned: 'Lì xì kiếm được',
    },
    menu: { title: 'Menu', resume: 'Tiếp tục', settings: 'Cài đặt', quit: 'Về màn đầu' },
    settings: {
      title: 'Cài đặt', sound: 'Âm thanh', speed: 'Tốc độ', scanlines: 'Scanlines',
      reduced: 'Giảm chuyển động', on: 'Bật', off: 'Tắt', close: 'Đóng', home: 'Về màn chính', tut: 'Hướng dẫn', tutGo: 'Chơi lại',
    },
    msg: {
      hintNone: 'Không có bộ nào đè được.', illegal: 'Bộ này không hợp lệ.', cantBeat: 'Chưa đủ lớn.',
      noChat: 'Nhà này không cho chặt heo.', mustBeat: 'Có đè là phải đè.', pickCards: 'Chọn bài.',
      saveFail: 'Không lưu được.', loadFail: 'Không đọc được bản lưu.',
    },
    tut: {
      who: 'Ông Táo', next: 'Tiếp', skip: 'Bỏ qua hướng dẫn',
      hello: 'Ta là Ông Táo. Mai lên trời báo cáo, nên tối nay dạy con cho xong.',
      goal: 'Mỗi bàn có một Mục tiêu. Gom đủ Điểm bàn là qua. Hết ba ván mà chưa đủ thì thôi.',
      hand: 'Bài của con đây. Ai cầm lá nhỏ nhất thì đi trước. Hôm nay là con.',
      pick1: 'Chọn hai lá 3. Hai lá cùng số gọi là một đôi.', pick1b: 'Giờ bấm Đánh.',
      score: 'Mỗi lá cộng Điểm, mỗi bộ cộng Thế. Điểm nhân Thế ra tổng, đổ vào ống vòng.',
      opp: 'Nó đè đôi 5. Ống vòng phình ra. Ai ăn vòng thì ăn cả ống.',
      choice: 'Bỏ lượt là buông cả ống cho nó. Con muốn ăn thì đè lại.',
      pick2: 'Đè bằng đôi 9.', pick2b: 'Đánh.',
      vong1: 'Nó bỏ lượt. Con ăn vòng, cả ống chạy vào Điểm bàn.',
      lead: 'Con dẫn vòng mới. Ra lá Q xem nó tính sao.',
      heo: 'Nó ra heo. Heo là lá lớn nhất, đè kiểu thường là hết đường.',
      pick3: 'Nhưng tứ quý chặt được heo. Chọn bốn lá 8.', pick3b: 'Chặt đi.',
      chat: 'Chặt thì nhân đôi cả ống. Heo vào, ống nở.',
      vong2: 'Lại ăn vòng. Ống này nặng thật.',
      last: 'Còn một lá. Đánh nốt là hết bài.',
      van: 'Hết bài là thắng ván. Nó còn bảy lá, lại ôm heo, nên bị thối heo nhân đôi.',
      done: 'Đủ Mục tiêu rồi. Qua bàn, nhận lì xì, ra Chợ Tết.',
      shop1: 'Chợ Tết. Quý nhân ở đây, giữ được năm người, mỗi người một nết.',
      shop2: 'Sao chiếu mệnh lên cấp cho một kiểu bộ: cộng cả Điểm lẫn Thế.',
      shop3: 'Lì xì là tiền đi chợ. Để dành thì có lãi, gọi là bỏ ống.',
      boss: 'Bàn trùm có Luật nhà. Đọc kỹ chỗ đối thủ ngồi, nó đổi cách chơi của con.',
    },
    help: {
      rule1: 'Đánh bộ cùng kiểu, lớn hơn bộ trên bàn.',
      rule2: 'Bỏ lượt là buông cả vòng.',
      rule3: 'Heo chặt được bằng tứ quý hoặc đôi thông.',
      rule4: 'Thắng vòng thì ăn hết điểm vòng.',
    },
  };

  TL.DATA = { QUY_NHAN: QUY_NHAN, SAO: SAO, CHANG: CHANG, HOUSE_RULES: HOUSE_RULES, COMBO_NAME: COMBO_NAME, TEXT: TEXT };
})(globalThis.TL = globalThis.TL || {});
