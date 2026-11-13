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
  CFG.ENDLESS = { TARGET_X: 2.8 };   // endless: each chặng after the 3rd multiplies the chặng-3 targets by this, compounding
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
    co_hai: { id: 'co_hai', name: 'Cô Hai', quote: 'Sảnh phải đồng chất.', short: 'Sảnh đồng chất', long: 'Sảnh chỉ tính khi mọi lá cùng chất.', mods: { sameSuitStraight: true } },
    bac_chin: { id: 'bac_chin', name: 'Bác Chín', quote: 'Không được về bằng heo.', short: 'Cấm về heo', long: 'Lượt đánh hết bài không được có heo.', mods: { noHeoFinish: true } },
    di_ut: { id: 'di_ut', name: 'Dì Út', quote: 'Bàn này chỉ đánh ' + CFG.HOUSE2.TWO_VANS + ' ván.', short: 'Chỉ ' + CFG.HOUSE2.TWO_VANS + ' ván', long: 'Bàn này chỉ có ' + CFG.HOUSE2.TWO_VANS + ' ván thay vì 3.', mods: { twoVans: true } },
  });
  D.BOSS_IDS = ['ba_noi', 'chu_ba', 'ong_sau', 'co_hai', 'bac_chin', 'di_ut'];
  D.BOSS_IDS.forEach(function (id) { const h = D.HOUSE_RULES[id]; h.kind = 'luat'; h.rarity = 'thuong'; h.desc = h.quote; });
  D.RARITY_ORDER = ['thuong', 'hiem', 'quy'];

  // ---- step 4: 8 more Quý nhân + 5 Báu vật (rarity 'bau', aura, shop from chặng 2)
  CFG.QN4 = {
    THAY_TUONG_X: 2,       // Ông thầy tướng: Bài xấu Nhân multiplier (instead of XAU_X)
    SAI_GON_X: 2,          // Cô Ba Sài Gòn: sảnh of SAI_GON_MIN+ cards
    SAI_GON_MIN: 5,
    BAN_PHO_THE: 2,        // Chú bán phở: +Nhân per consecutive hũ won (stacks)
    BO_DOI_LIXI: 3,        // Anh bộ đội: lì xì when your heo is chặt
    BO_DOI_THE: 5,         //   and +Nhân on your next play
    BA_NGOAI_LIXI: 2,      // Bà ngoại: lì xì per unused Lượt đổi at payout
    CAU_UT_X: 3,           // Cậu Út: Nhân multiplier when a rác ends the ván
    CHI_HANG_DIEM: 20,     // Chị hàng cá: +Điểm for beating the table by exactly one rank
    ONG_GIAO_X: 2,         // Ông giáo: extra multiplier on the cóng bonus
  };
  CFG.BAU = {
    CHANCE: 0.05,          // chance per Quý nhân shop slot (from chặng 2) to be a Báu vật; at most one per shop
    MIN_CHANG: 1,          // chặng index (0-based) from which Báu vật appear
    MAX_OWNED: 2,
    THAN_TAI_PER: 4,       // Thần Tài: pay 1 lì xì per this many held, uncapped
    THAN_TAI_REROLL_X: 2,  //   Đổi hàng costs this many times more
    ONG_DIA_THE: 4,        // Ông Địa: +Nhân forever per heo the loser still holds when you win
    TAO_QUAN_LEVELS: 1,    // Táo Quân: levels for every kind of bài per bàn trùm cleared
    VUA_BAI_X: 2,          // Vua Bài: Nhân multiplier on every play
    VUA_BAI_PASSES: 2,     //   max Bỏ lượt per ván
    AURA: ['#6B2F7A', '#A066B0'],   // aura fire colours (the only purple in the game)
    CA_CHEP_X: 1.2,        // Cá Chép: Nhân multiplier gained per hũ won with a sảnh, compounding forever
  };
  CFG.KHI = {
    MAX: 3,
    FAST_MIN: 0.5, FAST_MAX: 2.2,   // s from your turn to Đánh that count as a confident quick play
    WIN_P: 0.6,                     // estimated win chance needed for a quick play to count
    OPP_MOVES_PER_CARD: 0.55, CTL_W: 0.5, P_PER_MOVE: 0.1,   // winProb: 0.5 + P_PER_MOVE x (opp moves left - my groups + control)
    popup: [1, 1.2, 1.4, 1.6],      // popup size multiplier by level
    shake: [1, 1.33, 1.67, 2],      // shake multiplier by level
    SHAKE_CAP: 10,                  // hard cap, px
    tick: [1, 1.05, 1.1, 1.16],     // tick pitch multiplier by level
    drum: [0, 0.35, 0.55, 0.8],     // bass drum layer under each tick, volume
    pao: [0, 0, 0.6, 1],            // firework tail after a slam, volume
    bg: [1, 1.25, 1.55, 2],         // background flow speed multiplier
    border: ['#D9A441', '#D9A441', '#C9602B', '#A3271F'],   // HUD edge: vàng kim -> đỏ son
    FLAME_AT: 3,                    // level at which the Điểm × Nhân box burns
  };
  CFG.FINALE = {
    HIT_STOP: 0.12, SLOW: 0.35, SLOW_FOR: 0.7, ZOOM: 1.08, FLASH: 0.18, RINGS: 3, HOLD: 1.1,
    BASE_FRAC: 0.4,                 // intensity = BASE_FRAC + (1 - BASE_FRAC) x ((khi + oppLeft/HAND_SIZE) / (MAX + 1)), 0..1
  };
  CFG.MOODS = {   // background bands dark -> light (hex), thr, speed
    ba_noi:    { c: ['#16222F', '#2E5E8C', '#EADCC0'], thr: [0.50, 0.84], speed: 1.0 },
    chu_ba:    { c: ['#0E0A0A', '#5A1410', '#A3271F'], thr: [0.44, 0.80], speed: 1.5 },
    ong_sau:   { c: ['#16200F', '#2F4020', '#5B7040'], thr: [0.48, 0.80], speed: 1.0 },
    co_hai:    { c: ['#2A1218', '#6E2B3C', '#D98CA0'], thr: [0.48, 0.82], speed: 1.1 },
    bac_chin:  { c: ['#2A1E0C', '#6B5020', '#C7A24A'], thr: [0.48, 0.80], speed: 1.2 },
    di_ut:     { c: ['#0F1530', '#24305E', '#4A5A9A'], thr: [0.46, 0.80], speed: 1.4 },
    giao_thua: { c: ['#0A0807', '#2A1E0C', '#D9A441'], thr: [0.56, 0.90], speed: 0.8 },
    daily:     { c: ['#1B1412', '#2F4020', '#5B7040'], thr: [0.48, 0.80], speed: 1.0 },
    vo_tan:    { c: ['#0F1530', '#1A1F44', '#2E3A7A'], thr: [0.46, 0.80], speed: 1.3 },
  };
  CFG.PRICE.QN4 = { ong_thay_tuong: 6, co_ba_sai_gon: 7, chu_ban_pho: 6, anh_bo_doi: 5, ba_ngoai: 5, cau_ut: 7, chi_hang_ca: 4, ong_giao: 6 };
  CFG.PRICE.BAU = { than_tai: 14, ong_dia: 12, tao_quan: 13, vua_bai: 15, ca_chep: 12 };
  Object.assign(CFG.PRICE.QN, CFG.PRICE.QN4, CFG.PRICE.BAU);
  const Q4 = CFG.QN4, BA = CFG.BAU;
  [
    ['ong_thay_tuong', 'Ông thầy tướng', 'hiem', 'Bài xấu: nhân ×' + Q4.THAY_TUONG_X + ' Nhân thay vì ×' + P(CFG.XAU_X) + '.'],
    ['co_ba_sai_gon', 'Cô Ba Sài Gòn', 'hiem', 'Sảnh từ ' + Q4.SAI_GON_MIN + ' lá trở lên: nhân ×' + Q4.SAI_GON_X + ' Nhân.'],
    ['chu_ban_pho', 'Chú bán phở', 'hiem', 'Mỗi hũ ăn liên tiếp: +' + Q4.BAN_PHO_THE + ' Nhân, cộng dồn. Mất hũ thì về 0.'],
    ['anh_bo_doi', 'Anh bộ đội', 'thuong', 'Heo bạn bị chặt: +' + Q4.BO_DOI_LIXI + ' lì xì và +' + Q4.BO_DOI_THE + ' Nhân ở nước đánh kế.'],
    ['ba_ngoai', 'Bà ngoại', 'thuong', 'Mỗi lượt đổi chưa dùng lúc hết bàn: +' + Q4.BA_NGOAI_LIXI + ' lì xì.'],
    ['cau_ut', 'Cậu Út', 'quy', 'Kết thúc ván bằng một lá rác: nhân ×' + Q4.CAU_UT_X + ' Nhân nước đó.'],
    ['chi_hang_ca', 'Chị hàng cá', 'thuong', 'Đè bằng lá đầu cao hơn đúng 1 bậc: +' + Q4.CHI_HANG_DIEM + ' Điểm.'],
    ['ong_giao', 'Ông giáo', 'hiem', 'Thưởng cóng nhân thêm ×' + Q4.ONG_GIAO_X + '.'],
    ['than_tai', 'Thần Tài', 'bau', 'Lãi không giới hạn, trả 1 mỗi ' + BA.THAN_TAI_PER + ' lì xì. Đổi hàng tốn gấp đôi.'],
    ['ong_dia', 'Ông Địa', 'bau', 'Thắng ván: mỗi heo đối thủ còn giữ cho +' + BA.ONG_DIA_THE + ' Nhân vĩnh viễn.'],
    ['tao_quan', 'Táo Quân', 'bau', 'Mỗi bàn trùm vượt qua: mọi kiểu bài lên ' + BA.TAO_QUAN_LEVELS + ' cấp.'],
    ['vua_bai', 'Vua Bài', 'bau', 'Mọi nước đánh nhân ×' + BA.VUA_BAI_X + ' Nhân. Mỗi ván chỉ được Bỏ lượt ' + BA.VUA_BAI_PASSES + ' lần.'],
    ['ca_chep', 'Cá Chép', 'bau', 'Mỗi hũ ăn bằng sảnh: nhân thêm ×' + P(BA.CA_CHEP_X) + ' Nhân vĩnh viễn, cộng dồn.'],
  ].forEach(function (r) {
    D.QUY_NHAN[r[0]] = { id: r[0], name: r[1], kind: 'qn', rarity: r[2], price: CFG.PRICE.QN[r[0]], desc: r[3] };
  });
  D.BAU_IDS = ['than_tai', 'ong_dia', 'tao_quan', 'vua_bai', 'ca_chep'];
  D.TEXT.rarity.bau = 'Báu vật';
  D.TEXT.stamp.bauVat = 'Báu vật!';
  D.TEXT.payout.baNgoai = 'Bà ngoại ×%d';
  D.TEXT.msg.passMax = 'Vua Bài: hết lượt Bỏ lượt.';
  // ---- step 6: meta (Tiếng tăm, Cây mai, Khởi đầu, Chiếu, daily) -- logic in js/profile.js
  CFG.STORAGE.profile = 'chieutren.profile';
  CFG.META = {
    XP: { BAN: 20, CHAT: 5, BIG_POT: 8, WIN: 250, CHIEU_X: [1, 1, 1.25, 1.5, 1.75, 2, 2.5] },   // per bàn cleared / chặt / hũ >= mục tiêu / run won; multiplier by Chiếu (index = Chiếu)
    LEVEL: { BASE: 120, STEP: 40 },    // xp needed for level n -> n+1 = BASE + STEP x (n-1); each level = 1 hoa mai
    CHIEU_MAX: 6, CHIEU2_TGT_X: 1.15, CHIEU6_TGT_X: 1.3, CHIEU4_LAI: 2,
    NGHEO_MONEY: 0, NGHEO_LAI: 5,      // Con nhà nghèo
    CUNG_TGT_X: 1.15,                  // Con cưng
    TRO_SAO: 2, TRO_SLOTS: 4,          // Học trò
    REROLL_OFF: 1,                     // perk: first Đổi hàng of each shop is cheaper
    DAILY_CHIEU: 2,
    SOLO_LEVEL: 3,                     // Sòng bốn unlocks at this Tiếng tăm level (used by the mode screen)
    // Quý nhân: 14 in the starting pool, the other 14 in three tree groups; Quẻ: 3 + 3; Báu vật: none until the tree gives them
    POOL: {
      qn: ['ba_ban_xoi', 'ong_do', 'chu_xe_om', 'co_hang_xom', 'thay_boi', 'thang_ban_than', 'heo_dat', 'co_giao', 'anh_shipper', 'ba_ve_so', 'thang_em', 'chu_ba_gac', 'thang_chau', 'chu_tho_may'],
      que: ['que_doi', 'que_soi', 'que_loc'],
      bau: [],
    },
    // nodes: id, branch (noi_dung | khoi_dau | tien_ich), cost in hoa mai, req (node id or null), what it gives
    TREE: [
      { id: 'qn_a', br: 'noi_dung', cost: 1, req: null, qn: ['dan_cho_lon', 'ong_cau_ca', 'chi_ban_hoa', 'ong_ke_toan', 'chi_hang_ca'] },
      { id: 'qn_b', br: 'noi_dung', cost: 2, req: 'qn_a', qn: ['me_chong', 'ba_mai', 'ong_thay_tuong', 'co_ba_sai_gon', 'chu_ban_pho'] },
      { id: 'qn_c', br: 'noi_dung', cost: 3, req: 'qn_b', qn: ['anh_bo_doi', 'ba_ngoai', 'cau_ut', 'ong_giao'] },
      { id: 'que_a', br: 'noi_dung', cost: 2, req: null, que: ['que_gap_doi', 'que_sao', 'que_them_van'] },
      { id: 'bau_a', br: 'noi_dung', cost: 3, req: 'qn_a', bau: ['ong_dia', 'ca_chep'] },
      { id: 'bau_b', br: 'noi_dung', cost: 4, req: 'bau_a', bau: ['than_tai', 'tao_quan', 'vua_bai'] },
      { id: 'kd_ngheo', br: 'khoi_dau', cost: 1, req: null, start: 'ngheo' },
      { id: 'kd_cung', br: 'khoi_dau', cost: 2, req: null, start: 'cung' },
      { id: 'kd_choi', br: 'khoi_dau', cost: 2, req: 'kd_ngheo', start: 'choi' },
      { id: 'kd_tro', br: 'khoi_dau', cost: 3, req: 'kd_cung', start: 'tro' },
      { id: 'kd_loc', br: 'khoi_dau', cost: 3, req: 'kd_choi', start: 'loc' },
      { id: 'ti_doi', br: 'tien_ich', cost: 2, req: null, perk: 'doi1' },
      { id: 'ti_lai', br: 'tien_ich', cost: 2, req: null, perk: 'lai' },
      { id: 'ti_reroll', br: 'tien_ich', cost: 3, req: 'ti_lai', perk: 'reroll' },
      { id: 'ti_giu', br: 'tien_ich', cost: 4, req: 'ti_doi', perk: 'giu' },
    ],
    STARTS: ['mac_dinh', 'ngheo', 'cung', 'choi', 'tro', 'loc'],
  };
  D.TEXT.modes = {
    title: 'Chọn cách chơi', back: 'Quay lại', go: 'Bắt đầu', lock: 'Khóa', maiBtn: 'Cây mai', chieuLabel: 'Chiếu', startLabel: 'Khởi đầu',
    thuong: ['Chơi thường', 'Ba chặng, chín bàn, tới Mùng Một.'], daily: ['Thử thách ngày', 'Cùng một ván cho mọi người, mỗi ngày một lượt.'],
    vo_tan: ['Vô tận', 'Vào thẳng chặng 4 trở đi, không có điểm dừng.'], solo: ['Sòng bốn', 'Bốn người một chiếu.'],
    needWin: 'Thắng một ván để mở', needLevel: 'Tiếng tăm cấp %d để mở', soon: 'Sắp có', done: 'Hôm nay đã chơi', today: 'Mỗi ngày một lượt',
    lockStart: 'Mở ở Cây mai', hold: 'Giữ lại', unhold: 'Bỏ giữ', hint2: 'Chạm một nút để xem.', lockChieu: 'Thắng Chiếu trước để mở', hint: 'Vuốt hoặc phím mũi tên để chọn.',
    mai: { title: 'Cây mai', have: 'Hoa mai: %d', cost: 'Tốn %d', buy: 'Mua', owned: 'Đã nở', need: 'Cần nút trước', poor: 'Thiếu hoa mai', lvl: 'Tiếng tăm cấp %d' },
    end: { xp: 'Tiếng tăm', lvUp: 'Lên cấp %d', mai: 'Nhận %d hoa mai', share: 'Sao chép kết quả', copied: 'Đã chép', newBest: 'Chiếu mới mở' },
  };
  D.TEXT.meta = {
    starts: {
      mac_dinh: ['Mặc định', 'Bắt đầu như thường.'],
      ngheo: ['Con nhà nghèo', '0 lì xì. Trần Lãi +' + CFG.META.NGHEO_LAI + '.'],
      cung: ['Con cưng', 'Một Quý nhân hiếm ngẫu nhiên. Mục tiêu +15%.'],
      choi: ['Dân chơi', 'Có Dân chơi Chợ Lớn. Không có Lượt đổi.'],
      tro: ['Học trò', 'Mọi kiểu bài cấp ' + CFG.META.TRO_SAO + '. Chỉ ' + CFG.META.TRO_SLOTS + ' ô Quý nhân.'],
      loc: ['Có lộc', '2 Quẻ ngẫu nhiên.'],
    },
    chieu: ['', 'Chiếu 1', 'Chiếu 2', 'Chiếu 3', 'Chiếu 4', 'Chiếu 5', 'Chiếu Trên'],
    chieuDesc: ['', 'Luật thường.', 'Mục tiêu +15%.', 'Đối thủ luôn ở cấp cao nhất.', 'Trần Lãi −' + CFG.META.CHIEU4_LAI + '.', 'Bàn trùm cuối có hai luật nhà.', 'Bớt một Lượt đổi. Bàn lớn cũng có luật nhà. Mục tiêu thêm 30%.'],
    nodes: {
      qn_a: ['Quý nhân I', 'Thêm 5 Quý nhân vào kho.'], qn_b: ['Quý nhân II', 'Thêm 5 Quý nhân vào kho.'], qn_c: ['Quý nhân III', 'Thêm 4 Quý nhân vào kho.'],
      que_a: ['Quẻ mới', 'Thêm 3 Quẻ vào kho.'], bau_a: ['Báu vật I', 'Thêm Ông Địa, Cá Chép.'], bau_b: ['Báu vật II', 'Thêm Thần Tài, Táo Quân, Vua Bài.'],
      kd_ngheo: ['Con nhà nghèo', 'Mở cách bắt đầu.'], kd_cung: ['Con cưng', 'Mở cách bắt đầu.'], kd_choi: ['Dân chơi', 'Mở cách bắt đầu.'], kd_tro: ['Học trò', 'Mở cách bắt đầu.'], kd_loc: ['Có lộc', 'Mở cách bắt đầu.'],
      ti_doi: ['Thêm lượt đổi', '+1 Lượt đổi ở bàn đầu mỗi chặng.'], ti_lai: ['Lãi dày', 'Trần Lãi +1.'], ti_reroll: ['Đổi hàng rẻ', 'Lần Đổi hàng đầu mỗi shop rẻ hơn ' + CFG.META.REROLL_OFF + '.'], ti_giu: ['Ô giữ đồ', 'Giữ một món trong shop sang shop sau.'],
    },
    br: { noi_dung: 'Nội dung', khoi_dau: 'Khởi đầu', tien_ich: 'Tiện ích' },
    xp: { ban: 'Bàn vượt qua', chat: 'Chặt', bigPot: 'Hũ lớn', win: 'Thắng cả ván', chieu: 'Hệ số Chiếu' },
    share: 'Chiếu Trên %s · Bàn %d · Hũ lớn nhất %s',
  };
})(globalThis.TL = globalThis.TL || {});
