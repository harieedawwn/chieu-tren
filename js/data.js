/* js/data.js  (owner SPEC) all static content. Needs js/config.js loaded first.
 * API
 *   TL.DATA.QUY_NHAN   { id: {id, name, price, desc, quote} }   8 entries; price from CFG.PRICE.QN, desc from CFG.QN
 *   TL.DATA.SAO        { id: {id, name, combo, price, desc} }   6 entries; combo = Combo.type it upgrades
 *   TL.DATA.CHANG      [ {id, name, date, ban:[ {id, kind:'nho'|'lon'|'trum', name, tag, house:id|null} x3 ]} x3 ]
 *                      ban[].id doubles as Art.portrait(id); house = key of HOUSE_RULES (trum only)
 *   TL.DATA.HOUSE_RULES { id: {id, name, quote, short, mods:{oppLeads?|noChat?|mustBeat?}} }   3 entries
 *   TL.DATA.COMBO_NAME { rac, doi, sam, tuquy, sanh, doithong } -> display name
 *   TL.DATA.TEXT       nested UI strings; groups: game title btn hud kind stamp payout shop rarity pack que end sotay first menu settings msg tut help
 *                      '%d' = number (use TL.fmt), '%s' = string; replace with a plain String.replace
 * Tone: plain Vietnamese, effect first with its number. One name per concept (glossary in SPEC.md). No teencode, memes or emoji.
 * js/content.js (loaded after this file) adds the extra Quý nhân, QUE, PACK, house rules and TEXT.
 */
(function (TL) {
  'use strict';
  const CFG = TL.CFG;
  const Q = CFG.QN;

  const COMBO_NAME = {
    rac: 'Rác', doi: 'Đôi', sam: 'Sám', tuquy: 'Tứ quý', sanh: 'Sảnh', doithong: 'Đôi thông',
  };

  const QUY_NHAN = {};
  [
    ['thay_boi', 'Thầy bói', 'Đầu ván, lật ' + Q.THAY_BOI_REVEAL + ' lá của đối thủ.', ''],
    ['co_hang_xom', 'Cô hàng xóm', 'Luôn thấy đối thủ còn mấy heo.', 'Chuyện nhà ai cô cũng biết.'],
    ['chu_xe_om', 'Chú xe ôm', 'Sảnh: +' + Q.XE_OM_DIEM + ' Điểm mỗi lá.', 'Đi xa, chú tính thêm.'],
    ['thang_ban_than', 'Thằng bạn thân', 'Mỗi lần bỏ lượt: +' + Q.BAN_THAN_THE + ' Nhân cho lần đánh kế.', ''],
    ['heo_dat', 'Heo đất', 'Thắng hũ bằng heo: +' + Q.HEO_DAT_THE + ' Nhân vĩnh viễn. Heo bị chặt thì vỡ.', 'Nuôi lâu mới béo.'],
    ['dan_cho_lon', 'Dân chơi Chợ Lớn', 'Chặt: nhân hũ ×' + Q.CHO_LON_CHAT_X + ' thay vì ×' + CFG.CHAT_X + '.', ''],
    ['ba_ban_xoi', 'Bà bán xôi', 'Rác: +' + Q.BAN_XOI_THE + ' Nhân.', 'Xôi ế cũng bán được.'],
    ['ong_do', 'Ông đồ', 'Đôi: +' + Q.ONG_DO_THE + ' Nhân.', ''],
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
      desc: 'Nâng cấp ' + COMBO_NAME[r[2]] + '. Mỗi cấp: +' + g.diem + ' Điểm, +' + g.the + ' Nhân.',
    };
  });

  const HOUSE_RULES = {
    ba_noi: { id: 'ba_noi', name: 'Bà Nội', quote: 'Bà luôn đi trước.', short: 'Bà đi trước', long: 'Đối thủ luôn đánh trước mỗi ván.', mods: { oppLeads: true } },
    chu_ba: { id: 'chu_ba', name: 'Chú Ba', quote: 'Không được chặt heo.', short: 'Cấm chặt', long: 'Không ai được dùng tứ quý hay đôi thông để chặt heo.', mods: { noChat: true } },
    ong_sau: { id: 'ong_sau', name: 'Ông Sáu', quote: 'Có đè là phải đè.', short: 'Phải đè', long: 'Có bộ đè được thì không được bỏ lượt.', mods: { mustBeat: true } },
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

  const TEXT = {
    game: { title: 'Chiếu Trên', sub: 'Tiến Lên ngày Tết.', win: 'Mùng Một' },
    title: { play: 'Chơi mới', cont: 'Chơi tiếp', settings: 'Cài đặt', sotay: 'Sổ tay', mai: 'Cây mai' },
    btn: {
      danh: 'Đánh', bo: 'Bỏ lượt', goiy: 'Gợi ý', xep: 'Xếp', doi: 'Đổi', menu: 'Menu',
      xepRank: 'Xếp: số', xepSuit: 'Xếp: chất', ok: 'Được', back: 'Quay lại', dung: 'Dùng', chon: 'Chọn',
    },
    hud: {
      ruleCard: 'Chạm để bắt đầu', ruleClose: 'Chạm để đóng', ruleKick: 'Bàn trùm · Luật nhà',
      target: 'Mục tiêu', diemBan: 'Tổng điểm', pot: 'Hũ', van: 'Ván', vanLeft: 'Còn %d ván',
      lixi: 'Lì xì', chang: 'Chặng', ban: 'Bàn', level: 'Cấp %d', diem: 'Điểm', the: 'Nhân',
      yourTurn: 'Lượt bạn', oppTurn: 'Đối thủ đang nghĩ', oppCards: 'Còn %d lá', oppHeo: 'Heo: %d', chipCards: '%d lá', chipHeo: '%d heo', chipBo: 'Bỏ',
      lead: 'Đi trước', house: 'Luật nhà', qn: 'Quý nhân', que: 'Quẻ', x2: '×2', suc: 'Sức bài',
      sucTip: ['', 'Bài xấu: ăn hũ được ×%s Nhân.', 'Bài thường.', 'Bài đẹp.'],
    },
    kind: { nho: 'Bàn nhỏ', lon: 'Bàn lớn', trum: 'Bàn trùm' },
    stamp: {
      chat: 'Chặt!', baiXau: 'Bài xấu', anVong: 'Ăn hũ.', thoiHeo: 'Thối heo.', thoiHeoN: 'Thối %d heo.',
      cong: 'Cóng.', veNhat: 'Về nhất.', toiTrang: 'Tới trắng.', boLuot: 'Bỏ lượt.',
      thua: 'Thua ván.', quaBan: 'Qua bàn.', soloOpen: 'Mở khoá: Sòng bốn', heoVo: 'Heo đất vỡ.', thayBoi: 'Lật bài.',
    },
    payout: {
      title: 'Qua bàn', base: '%s', unused: 'Ván còn dư ×%d', khongDoi: 'Không đổi bài ×%d', interest: 'Lãi', total: 'Tổng', next: 'Vào Chợ Tết',
    },
    shop: {
      title: 'Chợ Tết', buy: 'Mua', sell: 'Bán', reroll: 'Đổi hàng', next: 'Đi tiếp',
      full: 'Hết chỗ', poor: 'Không đủ lì xì', sold: 'Đã bán', slots: 'Quý nhân %d/%d',
      sellFor: 'Bán được %d', level: 'Cấp %d', sao: 'Sao', hint: 'Chạm một thẻ để xem.',
      que: 'Quẻ', queSlots: 'Quẻ %d/%d', pack: 'Bao lì xì', open: 'Mở', use: 'Dùng', owned: 'Đang có',
      forSale: 'Đang bán', mine: 'Của bạn', price: '%d lì xì',
    },
    rarity: { thuong: 'Thường', hiem: 'Hiếm', quy: 'Quý' },
    pack: { title: 'Bao lì xì', pick: 'Chọn 1 trong 3', skip: 'Bỏ qua', empty: 'Hết chỗ, hãy bán bớt.', tear: 'Xé bao' },
    que: { soi: 'Thấy bài', empty: 'Ô trống', pick: 'Chọn %d lá để đổi', swapped: 'Đã đổi bài.', gotSao: '+1 cấp %s', gotLixi: '+%d lì xì', gotVan: '+1 ván', x2Set: 'Lần đánh kế ×2 Nhân' },
    end: {
      win: 'Mùng Một', winSub: 'Bạn đã qua cả ba chặng.',
      lose: 'Thua bàn', loseSub: 'Hết ván mà chưa đủ điểm.',
      stats: 'Thống kê',
      vans: 'Ván đã đánh', wins: 'Ván thắng', chat: 'Lần chặt', bestPlay: 'Lượt đánh cao nhất',
      bestPot: 'Hũ lớn nhất', toiTrang: 'Tới trắng', lixi: 'Lì xì còn lại',
      again: 'Chơi lại', toTitle: 'Về màn đầu', reached: 'Bàn đã tới', earned: 'Lì xì kiếm được',
      endless: 'Chơi tiếp: vô tận', endlessChang: 'Chặng %d',
    },
    sotay: {
      title: 'Sổ tay', tabQn: 'Quý nhân', tabQue: 'Quẻ', tabSao: 'Sao', tabLuat: 'Luật nhà',
      count: '%d/%d đã gặp', unseen: '???', back: 'Quay lại', hint: 'Chạm một thẻ để xem.',
    },
    first: {
      chat: 'Chặt: tứ quý hoặc đôi thông đè được heo, và hũ nhân đôi.',
      thoi: 'Thối heo: thua mà còn heo thì bị phạt, người thắng được nhân.',
      cong: 'Cóng: thua mà chưa đánh lá nào thì bị nhân đôi.',
      toiTrang: 'Tới trắng: có tứ quý 2 ngay lúc chia là thắng liền.',
      sonBon: 'Bàn bốn người: bỏ lượt là ra khỏi vòng, ai còn lại cuối cùng ăn hũ và đi trước. Ai hết bài trước thì về nhất và thu thưởng của cả ba.',
      giaoThua: 'Sòng Giao thừa: trùm kéo hai người họ hàng vào chiếu. Luật nhà của trùm áp cho cả bàn.',
    },
    menu: { title: 'Menu', resume: 'Tiếp tục', settings: 'Cài đặt', quit: 'Về màn đầu' },
    settings: {
      title: 'Cài đặt', sound: 'Âm thanh', speed: 'Tốc độ', scanlines: 'Scanlines',
      sort: 'Xếp bài', perf: 'Hiệu năng', perfAuto: 'Tự động', perfHigh: 'Cao', perfLow: 'Tiết kiệm', sortRank: 'Theo số', sortSuit: 'Theo chất', reduced: 'Giảm chuyển động', full: 'Toàn màn hình', fullNo: 'Thêm vào Màn hình chính để chơi toàn màn hình', fullIn: 'Đang chạy toàn màn hình.', inst: 'Cài ứng dụng', instGo: 'Cài', instIos: 'Bấm Chia sẻ rồi Thêm vào Màn hình chính.', instDone: 'Đã cài ứng dụng.', instMenu: 'Dùng menu trình duyệt để cài ứng dụng.', on: 'Bật', off: 'Tắt', close: 'Đóng', home: 'Về màn chính', tut: 'Hướng dẫn', tutGo: 'Chơi lại',
    },
    msg: {
      hintNone: 'Không có bài nào đè được.', illegal: 'Bài này không hợp lệ.', cantBeat: 'Chưa đủ lớn.',
      noChat: 'Không được chặt heo.', mustBeat: 'Có đè là phải đè.', pickCards: 'Chọn bài.',
      sameSuit: 'Sảnh phải đồng chất.', noHeoFinish: 'Không được về bằng heo.',
      saveFail: 'Không lưu được.', loadFail: 'Không đọc được bản lưu.',
      queTurn: 'Chờ tới lượt bạn.', doiLead: 'Chỉ đổi bài khi bạn dẫn hũ mới.', doiHet: 'Hết lượt đổi ở bàn này.', doiSel: 'Chọn 1 đến 3 lá để đổi.', queSel: 'Chọn từ 1 đến 3 lá để đổi.', queNoCard: 'Không còn lá để đổi.',
      queSoi: 'Đang thấy bài đối thủ rồi.', queX2: 'Đã gấp đôi rồi.', queFull: 'Hết chỗ Quẻ.', queVan: 'Chỉ dùng lúc đang chơi.',
      queBusy: 'Chờ một chút.',
    },
    tut: {
      who: 'Ông Táo', next: 'Tiếp', skip: 'Bỏ qua hướng dẫn',
      hello: 'Ta là Ông Táo. Ta chỉ con chơi từng bước.',
      goal: 'Gom đủ Tổng điểm trước khi hết 3 ván để qua bàn.',
      hand: 'Đây là bài của con. Con giữ lá nhỏ nhất nên đi trước.',
      pick1: 'Chọn hai lá 3 cùng số để thành một đôi.', pick1b: 'Bấm Đánh.',
      score: 'Điểm × Nhân ra tổng của lượt đánh, và tổng đó vào hũ.',
      opp: 'Nó đè đôi 5, hũ lớn thêm. Ai đánh cuối cùng sẽ ăn hũ.',
      choice: 'Bỏ lượt là nhường cả hũ cho nó. Muốn ăn hũ thì đè lại.',
      pick2: 'Đè bằng đôi 9.', pick2b: 'Bấm Đánh.',
      vong1: 'Nó bỏ lượt. Con ăn hũ, cả hũ vào Tổng điểm.',
      lead: 'Con đi trước. Đánh lá Q để xem nó làm gì.',
      heo: 'Nó ra heo, lá lớn nhất. Đè thường không nổi.',
      pick3: 'Tứ quý chặt được heo. Chọn bốn lá 8.', pick3b: 'Bấm Đánh để chặt.',
      chat: 'Chặt thì hũ nhân đôi. Heo vào, hũ phình ra.',
      vong2: 'Lại ăn hũ. Hũ này nặng thật.',
      last: 'Còn một lá. Đánh nốt là hết bài.',
      van: 'Con hết bài trước, thắng ván. Nó còn heo nên bị thối heo.',
      done: 'Đủ Mục tiêu rồi. Nhận lì xì và vào Chợ Tết.',
      shop1: 'Đây là Chợ Tết. Mua Quý nhân, giữ tối đa năm người.',
      shop2: 'Sao nâng cấp một kiểu bài: thêm cả Điểm lẫn Nhân.',
      shop3: 'Giữ lì xì cuối bàn sẽ được thêm Lãi.',
      boss: 'Bàn trùm có Luật nhà. Đọc kỹ luật vì nó đổi cách chơi.',
    },
    help: {
      rule1: 'Đánh bài cùng kiểu, lớn hơn bài trên bàn.',
      rule2: 'Bỏ lượt là nhường cả hũ.',
      rule3: 'Tứ quý hoặc đôi thông chặt được heo.',
      rule4: 'Ăn hũ thì lấy hết điểm trong hũ.',
    },
  };

  TL.DATA = { QUY_NHAN: QUY_NHAN, SAO: SAO, CHANG: CHANG, HOUSE_RULES: HOUSE_RULES, COMBO_NAME: COMBO_NAME, TEXT: TEXT };
})(globalThis.TL = globalThis.TL || {});
