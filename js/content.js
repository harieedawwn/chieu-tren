/* js/content.js  (owner SPEC) extra content on top of data.js: 12 Quý nhân, 6 Quẻ, Bao lì xì, 3 luật nhà, extra TEXT. Needs config + data.
 * API (everything is added to the existing objects; nothing is exported)
 *   TL.CFG.QN2 / QUE / HOUSE2 / RARITY_W        numbers for the new content (tunable, keys fixed)
 *   TL.CFG.PRICE.QN / QUE / PACK                prices of the new items
 *   TL.CFG.SHOP.{QUE_COUNT,PACK_COUNT,QUE_SLOTS,PACK_CHOICES}
 *   TL.DATA.QUY_NHAN                            now 20 entries; every entry {id, name, kind:'qn', rarity, price, desc, quote?}
 *   TL.DATA.SAO                                 entries get kind:'sao', rarity:'thuong'
 *   TL.DATA.QUE                                 { id: {id, name, kind:'que', rarity, price, desc} }  6 entries
 *   TL.DATA.PACK                                {id:'bao_li_xi', name, kind:'pack', rarity:'thuong', price, desc}
 *   TL.DATA.HOUSE_RULES                         now 6 entries (+ co_hai, bac_chin, di_ut), each also {kind:'luat', rarity:'thuong', desc}
 *   TL.DATA.BOSS_IDS                            the 6 house rule ids, in a fixed order
 *   TL.DATA.RARITY_ORDER                        ['thuong','hiem','quy']
 */
(function (TL) {
  'use strict';
  const CFG = TL.CFG, D = TL.DATA;

  CFG.QN2 = {
    CO_GIAO_THE: 2,        // Cô giáo: sảnh +Nhân per card beyond 3
    SHIPPER_MIN: 5,        // Anh shipper: plays of at least this many cards
    SHIPPER_DIEM: 30,      //   +Điểm
    VE_SO_CHANCE: 0.25,    // Bà bán vé số: chance per hũ won
    VE_SO_LIXI: 2,         //   lì xì gained
    THO_MAY_THE: 5,        // Chú thợ may: đôi thông +Nhân
    CAU_CA_FRAC: 0.5,      // Ông câu cá: hũ won of at least this fraction of the target
    CAU_CA_LIXI: 3,        //   lì xì gained
    ME_CHONG_X: 1.5,       // Mẹ chồng: Nhân multiplier on a bàn trùm
    THANG_EM_RANK: 4,      // Thằng em: rác of this rank index or lower (4 = rank 7)
    THANG_EM_DIEM: 15,     //   +Điểm
    BAN_HOA_LIXI: 1,       // Chị bán hoa: lì xì per heo you played, when the ván is won
    KE_TOAN_PER: 5,        // Ông kế toán: +1 Nhân per this many lì xì held
    KE_TOAN_MAX: 5,        //   capped at +Nhân
    BA_GAC_THE: 4,         // Chú ba gác: sám +Nhân
    BA_MAI_X: 2,           // Bà Mai: đôi J/Q/K Nhân multiplier
    THANG_CHAU_THE: 4,     // Thằng cháu: first play of each ván +Nhân
  };
  CFG.QUE = {
    DOI_MAX: 3,            // Đổi bài: cards swapped
    THEM_VAN: 1,           // Thêm ván: extra ván
    GAP_DOI_X: 2,          // Gấp đôi: Nhân multiplier on the next play
    LOC_LIXI: 4,           // Lộc: lì xì gained
    SAO_LEVELS: 1,         // Lên sao: levels gained
  };
  CFG.HOUSE2 = {
    TWO_VANS: 2,           // Dì Út: ván count of that bàn
  };
  CFG.RARITY_W = { thuong: 70, hiem: 25, quy: 5 };   // Quý nhân shop rarity weights
  CFG.SHOP.QUE_COUNT = 1;
  CFG.SHOP.PACK_COUNT = 1;
  CFG.SHOP.QUE_SLOTS = 2;
  CFG.SHOP.PACK_CHOICES = 3;
  Object.assign(CFG.PRICE.QN, {
    co_giao: 5, anh_shipper: 5, ba_ve_so: 4, chu_tho_may: 5, ong_cau_ca: 6, me_chong: 7,
    thang_em: 4, chi_ban_hoa: 5, ong_ke_toan: 6, chu_ba_gac: 4, ba_mai: 7, thang_chau: 5,
  });
  CFG.PRICE.QUE = { que_doi: 4, que_them_van: 6, que_soi: 4, que_gap_doi: 5, que_loc: 3, que_sao: 5 };
  CFG.PRICE.PACK = 4;

  const Q = CFG.QN2, QE = CFG.QUE, N = D.COMBO_NAME;
  const P = (n) => n % 1 ? String(n).replace('.', ',') : String(n);

  // existing 8 Quý nhân: rarity
  const OLD = { ba_ban_xoi: 'thuong', ong_do: 'thuong', chu_xe_om: 'thuong', co_hang_xom: 'thuong', thay_boi: 'hiem', thang_ban_than: 'hiem', heo_dat: 'hiem', dan_cho_lon: 'quy' };
  Object.keys(OLD).forEach(function (id) { D.QUY_NHAN[id].rarity = OLD[id]; });

  [
    ['co_giao', 'Cô giáo', 'thuong', 'Sảnh: +' + Q.CO_GIAO_THE + ' Nhân mỗi lá từ lá thứ 4.', ''],
    ['anh_shipper', 'Anh shipper', 'thuong', 'Đánh từ ' + Q.SHIPPER_MIN + ' lá trở lên: +' + Q.SHIPPER_DIEM + ' Điểm.', ''],
    ['ba_ve_so', 'Bà bán vé số', 'thuong', 'Mỗi lần ăn hũ: 1/4 cơ hội +' + Q.VE_SO_LIXI + ' lì xì.', ''],
    ['chu_tho_may', 'Chú thợ may', 'hiem', 'Đôi thông: +' + Q.THO_MAY_THE + ' Nhân.', ''],
    ['ong_cau_ca', 'Ông câu cá', 'hiem', 'Ăn hũ từ nửa Mục tiêu trở lên: +' + Q.CAU_CA_LIXI + ' lì xì.', ''],
    ['me_chong', 'Mẹ chồng', 'quy', 'Bàn trùm: nhân ×' + P(Q.ME_CHONG_X) + ' Nhân.', ''],
    ['thang_em', 'Thằng em', 'thuong', 'Rác từ 7 trở xuống: +' + Q.THANG_EM_DIEM + ' Điểm.', ''],
    ['chi_ban_hoa', 'Chị bán hoa', 'hiem', 'Thắng ván: +' + Q.BAN_HOA_LIXI + ' lì xì mỗi heo bạn đã đánh.', ''],
    ['ong_ke_toan', 'Ông kế toán', 'hiem', 'Mỗi ' + Q.KE_TOAN_PER + ' lì xì đang giữ: +1 Nhân, tối đa +' + Q.KE_TOAN_MAX + '.', ''],
    ['chu_ba_gac', 'Chú ba gác', 'thuong', 'Sám: +' + Q.BA_GAC_THE + ' Nhân.', ''],
    ['ba_mai', 'Bà Mai', 'quy', 'Đôi J, Q, K: nhân ×' + Q.BA_MAI_X + ' Nhân.', ''],
    ['thang_chau', 'Thằng cháu', 'thuong', 'Lần đánh đầu mỗi ván: +' + Q.THANG_CHAU_THE + ' Nhân.', ''],
  ].forEach(function (r) {
    D.QUY_NHAN[r[0]] = { id: r[0], name: r[1], kind: 'qn', rarity: r[2], price: CFG.PRICE.QN[r[0]], desc: r[3], quote: r[4] || undefined };
  });
  Object.keys(D.QUY_NHAN).forEach(function (id) {
    const q = D.QUY_NHAN[id]; q.kind = 'qn';
    if (!q.quote) delete q.quote;
  });
  Object.keys(D.SAO).forEach(function (id) { D.SAO[id].kind = 'sao'; D.SAO[id].rarity = 'thuong'; });

  D.QUE = {};
  [
    ['que_doi', 'Đổi bài', 'thuong', 'Đổi tối đa ' + QE.DOI_MAX + ' lá đã chọn với lá chưa chia. Chỉ dùng ở lượt bạn.'],
    ['que_them_van', 'Thêm ván', 'quy', '+' + QE.THEM_VAN + ' ván cho bàn này.'],
    ['que_soi', 'Soi bài', 'thuong', 'Xem hết bài đối thủ cho đến khi hũ được lấy.'],
    ['que_gap_doi', 'Gấp đôi', 'hiem', 'Lần đánh kế của bạn: nhân ×' + QE.GAP_DOI_X + ' Nhân.'],
    ['que_loc', 'Lộc', 'thuong', '+' + QE.LOC_LIXI + ' lì xì. Dùng được cả trong Chợ Tết.'],
    ['que_sao', 'Lên sao', 'hiem', '+' + QE.SAO_LEVELS + ' cấp cho một kiểu bài ngẫu nhiên.'],
  ].forEach(function (r) {
    D.QUE[r[0]] = { id: r[0], name: r[1], kind: 'que', rarity: r[2], price: CFG.PRICE.QUE[r[0]], desc: r[3] };
  });

  D.PACK = { id: 'bao_li_xi', name: 'Bao lì xì', kind: 'pack', rarity: 'thuong', price: CFG.PRICE.PACK, desc: 'Mở ra, chọn 1 trong 3 Quý nhân hoặc Quẻ ngẫu nhiên.' };

  Object.assign(D.HOUSE_RULES, {
    co_hai: { id: 'co_hai', name: 'Cô Hai', quote: 'Sảnh phải đồng chất.', short: 'Sảnh đồng chất', mods: { sameSuitStraight: true } },
    bac_chin: { id: 'bac_chin', name: 'Bác Chín', quote: 'Không được về bằng heo.', short: 'Cấm về heo', mods: { noHeoFinish: true } },
    di_ut: { id: 'di_ut', name: 'Dì Út', quote: 'Bàn này chỉ đánh ' + CFG.HOUSE2.TWO_VANS + ' ván.', short: 'Chỉ ' + CFG.HOUSE2.TWO_VANS + ' ván', mods: { twoVans: true } },
  });
  D.BOSS_IDS = ['ba_noi', 'chu_ba', 'ong_sau', 'co_hai', 'bac_chin', 'di_ut'];
  D.BOSS_IDS.forEach(function (id) { const h = D.HOUSE_RULES[id]; h.kind = 'luat'; h.rarity = 'thuong'; h.desc = h.quote; });
  D.RARITY_ORDER = ['thuong', 'hiem', 'quy'];
})(globalThis.TL = globalThis.TL || {});
