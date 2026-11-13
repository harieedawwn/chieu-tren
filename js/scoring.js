/* js/scoring.js  (owner BALANCE) Điểm × Thế, Quý nhân and Sao effects, SPEC §6. Pure logic, no DOM. Needs config, data, cards.
 * API  (run = RunState; Score = {diem, the, total, steps, xPot?}; ScoreStep per SPEC §4)
 *   TL.Scoring.scorePlay(run, seat, combo, ctx) -> Score   pure; ctx = {chat, target, pot, lead}; seat 1 gets base + cards (+ chặt) only
 *   TL.Scoring.onEvent(run, event)              -> ScoreStep[]   sole owner of Quý nhân state (stack, Heo đất n, break); mutates run
 *   TL.Scoring.vanBonus(run, vanEndEvent)       -> Score   pure; player win = bonus, opponent win = negative total (thối heo penalty)
 *   TL.Scoring.preview(run, combo)              -> {diem, the, level}   base + cards + Sao + Quý nhân, no chặt
 *   TL.Scoring.slotOf(run, id)                  -> slot index or -1
 * Per-play Quý nhân (slot order, then run.flags.x2Next as its own 'bonus' step ref 'x2'): the 8 old + co_giao anh_shipper chu_tho_may me_chong thang_em ong_ke_toan chu_ba_gac ba_mai thang_chau.
 * Event Quý nhân (onEvent): ba_ve_so + ong_cau_ca (on 'vong' won), chi_ban_hoa (on 'vanEnd' won). Lì xì gains add to run.money and emit a 'bonus' step ref 'lixi' (with slot).
 * Per-ván counters live in run.van: stack, nPlays, heoPlayed, rolls. run.flags.x2Next (bool) is cleared by onEvent on the player's next 'play'.
 * Info-only Quý nhân (Thầy bói reveal, Cô hàng xóm heo count) are read by Run/screens, not scored.
 */
(function (TL) {
  'use strict';
  const CFG = TL.CFG, D = TL.DATA, T = D.TEXT, Q = CFG.QN, Q2 = CFG.QN2, QE = CFG.QUE, Q4 = CFG.QN4, BA = CFG.BAU;
  const hasHeo = cards => cards.some(c => (c >> 2) === 12);
  const slotOf = (run, id) => run.qn.findIndex(s => s && s.id === id);
  const num = n => String(Math.round(n * 100) / 100).replace('.', ',');
  const fill = (s, v) => s.replace('%d', TL.fmt(v)).replace('%s', v);

  function scorePlay(run, seat, combo, ctx) {
    const steps = [], B = CFG.BASE[combo.type];
    const units = combo.type === 'sanh' ? combo.len : combo.type === 'doithong' ? combo.len / 2 : 3;
    let diem = B.diem, the = B.the + B.extra * Math.max(0, units - 3);
    steps.push({ kind: 'base', ref: combo.type, diem: B.diem, the: the, label: D.COMBO_NAME[combo.type] });
    combo.cards.slice().sort((a, b) => a - b).forEach(function (id) {
      const p = CFG.CARD_PTS[id >> 2]; diem += p;
      steps.push({ kind: 'card', ref: id, diem: p, label: '+' + p });
    });
    if (seat === 0) {
      const lv = run.sao[combo.type] || 1;
      if (lv > 1) {
        const g = CFG.SAO_GAIN[combo.type], d = (lv - 1) * g.diem, t = (lv - 1) * g.the;
        diem += d; the += t;
        const sid = Object.keys(D.SAO).find(k => D.SAO[k].combo === combo.type);
        steps.push({ kind: 'sao', ref: sid, diem: d, the: t, label: fill(T.hud.level, lv) });
      }
      const nPlays = run.van.nPlays || 0, kind = run.qn.some(x => x && x.id === 'me_chong') ? TL.Run.ban(run).kind : null;
      run.qn.forEach(function (s, slot) {
        if (!s) return;
        let d = 0, t = 0, x = 1;
        const rank = combo.top >> 2;
        if (s.id === 'chu_xe_om' && combo.type === 'sanh') d = Q.XE_OM_DIEM * combo.len;
        else if (s.id === 'thang_ban_than') t = run.van.stack || 0;
        else if (s.id === 'heo_dat') t = s.n || 0;
        else if (s.id === 'ba_ban_xoi' && combo.type === 'rac') t = Q.BAN_XOI_THE;
        else if (s.id === 'ong_do' && combo.type === 'doi') t = Q.ONG_DO_THE;
        else if (s.id === 'co_giao' && combo.type === 'sanh') t = Q2.CO_GIAO_THE * Math.max(0, combo.len - 3);
        else if (s.id === 'anh_shipper' && combo.len >= Q2.SHIPPER_MIN) d = Q2.SHIPPER_DIEM;
        else if (s.id === 'chu_tho_may' && combo.type === 'doithong') t = Q2.THO_MAY_THE;
        else if (s.id === 'me_chong' && kind === 'trum') x = Q2.ME_CHONG_X;
        else if (s.id === 'thang_em' && combo.type === 'rac' && rank <= Q2.THANG_EM_RANK) d = Q2.THANG_EM_DIEM;
        else if (s.id === 'ong_ke_toan') t = Math.min(Q2.KE_TOAN_MAX, Math.floor(run.money / Q2.KE_TOAN_PER));
        else if (s.id === 'chu_ba_gac' && combo.type === 'sam') t = Q2.BA_GAC_THE;
        else if (s.id === 'ba_mai' && combo.type === 'doi' && rank >= 8 && rank <= 10) x = Q2.BA_MAI_X;
        else if (s.id === 'thang_chau' && nPlays === 0) t = Q2.THANG_CHAU_THE;
        else if (s.id === 'co_ba_sai_gon' && combo.type === 'sanh' && combo.len >= Q4.SAI_GON_MIN) x = Q4.SAI_GON_X;
        else if (s.id === 'chu_ban_pho') t = (s.n || 0) * Q4.BAN_PHO_THE;
        else if (s.id === 'anh_bo_doi' && run.flags && run.flags.boDoi) t = Q4.BO_DOI_THE;
        else if (s.id === 'cau_ut' && combo.type === 'rac' && ctx && ctx.last) x = Q4.CAU_UT_X;
        else if (s.id === 'chi_hang_ca' && ctx && ctx.target && !ctx.chat && rank === (ctx.target.top >> 2) + 1) d = Q4.CHI_HANG_DIEM;
        else if (s.id === 'ong_dia') t = s.n || 0;
        else if (s.id === 'vua_bai') x = BA.VUA_BAI_X;
        else if (s.id === 'ca_chep' && s.n) x = Math.round(Math.pow(BA.CA_CHEP_X, s.n) * 100) / 100;
        if (x !== 1) {
          the *= x;
          steps.push({ kind: 'qn', ref: s.id, slot: slot, xThe: x, label: '×' + num(x) + ' ' + T.hud.the });
          return;
        }
        if (!d && !t) return;
        diem += d; the += t;
        steps.push({ kind: 'qn', ref: s.id, slot: slot, diem: d || undefined, the: t || undefined, label: d ? '+' + d + ' ' + T.hud.diem : '+' + t + ' ' + T.hud.the });
      });
      if (run.van.xau) {
        const xx = slotOf(run, 'ong_thay_tuong') >= 0 ? Q4.THAY_TUONG_X : CFG.XAU_X;
        the *= xx;
        steps.push({ kind: 'bonus', ref: 'xau', xThe: xx, label: T.stamp.baiXau + ' ×' + num(xx) });
        if (xx !== CFG.XAU_X) steps[steps.length - 1].slot = slotOf(run, 'ong_thay_tuong');
      }
      if (run.flags && run.flags.x2Next) {
        the *= QE.GAP_DOI_X;
        steps.push({ kind: 'bonus', ref: 'x2', xThe: QE.GAP_DOI_X, label: '×' + QE.GAP_DOI_X + ' ' + T.hud.the });
      }
    }
    const sc = { diem: diem, the: the, total: Math.floor(diem * the), steps: steps };
    if (ctx && ctx.chat) {
      sc.xPot = seat === 0 && slotOf(run, 'dan_cho_lon') >= 0 ? Q.CHO_LON_CHAT_X : CFG.CHAT_X;
      const cl = sc.xPot !== CFG.CHAT_X;
      steps.push({ kind: 'chat', ref: 'chat', xPot: sc.xPot, label: T.stamp.chat });
      if (cl) steps[steps.length - 1].slot = slotOf(run, 'dan_cho_lon');
    }
    return sc;
  }

  function lixi(run, slot, n, ref) {
    run.money += n;
    return { kind: 'bonus', ref: 'lixi', src: ref, slot: slot, lixi: n, label: '+' + n + ' ' + T.hud.lixi.toLowerCase() };
  }
  const heoIn = cards => cards.filter(c => (c >> 2) === 12).length;

  function onEvent(run, ev) {
    const out = [];
    if (ev.type === 'play' && ev.seat === 0) {
      run.van.stack = 0; run.van.nPlays = (run.van.nPlays || 0) + 1; run.van.heoPlayed = (run.van.heoPlayed || 0) + heoIn(ev.combo ? ev.combo.cards : []);
      if (run.flags && run.flags.x2Next) run.flags.x2Next = false;
      if (run.flags && run.flags.boDoi) run.flags.boDoi = false;
    } else if (ev.type === 'pass' && ev.seat === 0) {
      const s = slotOf(run, 'thang_ban_than');
      if (s >= 0) {
        run.van.stack = (run.van.stack || 0) + Q.BAN_THAN_THE;
        out.push({ kind: 'qn', ref: 'thang_ban_than', slot: s, the: Q.BAN_THAN_THE, label: '+' + Q.BAN_THAN_THE + ' ' + T.hud.the });
      }
    } else if (ev.type === 'vong' && ev.winner === 0) {
      if (ev.combo && hasHeo(ev.combo.cards)) {
        const s = slotOf(run, 'heo_dat');
        if (s >= 0) {
          run.qn[s].n = (run.qn[s].n || 0) + Q.HEO_DAT_THE;
          out.push({ kind: 'qn', ref: 'heo_dat', slot: s, the: Q.HEO_DAT_THE, label: '+' + Q.HEO_DAT_THE + ' ' + T.hud.the });
        }
      }
      let s = slotOf(run, 'chu_ban_pho');
      if (s >= 0) {
        run.qn[s].n = (run.qn[s].n || 0) + 1;
        out.push({ kind: 'qn', ref: 'chu_ban_pho', slot: s, the: Q4.BAN_PHO_THE, label: '+' + run.qn[s].n * Q4.BAN_PHO_THE + ' ' + T.hud.the });
      }
      s = slotOf(run, 'ca_chep');
      if (s >= 0 && ev.combo && ev.combo.type === 'sanh') {
        run.qn[s].n = (run.qn[s].n || 0) + 1;
        out.push({ kind: 'qn', ref: 'ca_chep', slot: s, xThe: BA.CA_CHEP_X, label: '×' + num(Math.pow(BA.CA_CHEP_X, run.qn[s].n)) + ' ' + T.hud.the });
      }
      s = slotOf(run, 'ba_ve_so');
      if (s >= 0) {
        run.van.rolls = (run.van.rolls || 0) + 1;
        const r = TL.makeRng(((run.seed ^ 0x51ED27) + Math.imul(run.vanNo + 1, 2654435761) + Math.imul(run.van.rolls, 40503)) >>> 0)();
        if (r < Q2.VE_SO_CHANCE) out.push(lixi(run, s, Q2.VE_SO_LIXI, 'ba_ve_so'));
      }
      s = slotOf(run, 'ong_cau_ca');
      if (s >= 0 && ev.pot >= Q2.CAU_CA_FRAC * TL.Run.ban(run).target) out.push(lixi(run, s, Q2.CAU_CA_LIXI, 'ong_cau_ca'));
    } else if (ev.type === 'vong' && ev.winner !== 0) {
      const s = slotOf(run, 'chu_ban_pho');
      if (s >= 0 && run.qn[s].n) { run.qn[s].n = 0; out.push({ kind: 'qn', ref: 'chu_ban_pho', slot: s, label: '0' }); }
    } else if (ev.type === 'chat' && ev.victim === 0 && ev.target && hasHeo(ev.target.cards)) {
      let s = slotOf(run, 'heo_dat');
      if (s >= 0) {
        run.qn[s] = null;
        out.push({ kind: 'qn', ref: 'heo_dat', slot: s, dissolve: true, label: T.stamp.heoVo });
      }
      s = slotOf(run, 'anh_bo_doi');
      if (s >= 0) { run.flags.boDoi = true; out.push(lixi(run, s, Q4.BO_DOI_LIXI, 'anh_bo_doi')); }
    } else if (ev.type === 'deal') {
      const s = slotOf(run, 'thay_boi');
      if (s >= 0) out.push({ kind: 'qn', ref: 'thay_boi', slot: s, label: T.stamp.thayBoi });
    } else if (ev.type === 'vanEnd' && ev.winner === 0) {
      const s = slotOf(run, 'chi_ban_hoa'), n = run.van.heoPlayed || 0;
      if (s >= 0 && n > 0) out.push(lixi(run, s, Q2.BAN_HOA_LIXI * n, 'chi_ban_hoa'));
      const od = slotOf(run, 'ong_dia'), h = ev.heo ? ev.heo.slice(1).reduce((x, y) => x + y, 0) : 0;
      if (od >= 0 && h > 0) {
        run.qn[od].n = (run.qn[od].n || 0) + BA.ONG_DIA_THE * h;
        out.push({ kind: 'qn', ref: 'ong_dia', slot: od, the: BA.ONG_DIA_THE * h, label: '+' + BA.ONG_DIA_THE * h + ' ' + T.hud.the });
      }
    }
    return out;
  }

  function vanBonus(run, ev) {
    if (ev.winner !== 0) {
      const pen = CFG.THOI_PENALTY * ev.heo[0];
      return { diem: -pen, the: 1, total: -pen, steps: pen ? [{ kind: 'bonus', ref: 'thoi', diem: -pen, label: fill(ev.heo[0] > 1 ? T.stamp.thoiHeoN : T.stamp.thoiHeo, ev.heo[0]) }] : [] };
    }
    const sum = a => a.slice(1).reduce((x, y) => x + y, 0), steps = [], d = sum(ev.left) * CFG.LEFT_PTS;
    let the = 1;
    steps.push({ kind: 'bonus', ref: 'veNhat', diem: d, label: T.stamp.veNhat });
    const h = sum(ev.heo);
    if (h > 0) { the *= Math.pow(CFG.THOI_X, h); steps.push({ kind: 'bonus', ref: 'thoi', xThe: the, label: fill(h > 1 ? T.stamp.thoiHeoN : T.stamp.thoiHeo, h) }); }
    if (ev.cong) { the *= Math.pow(CFG.CONG_X * (slotOf(run, 'ong_giao') >= 0 ? Q4.ONG_GIAO_X : 1), ev.congN || 1); steps.push({ kind: 'bonus', ref: 'cong', xThe: the, label: T.stamp.cong }); }
    if (ev.toiTrang) { the *= CFG.TOI_TRANG_X; steps.push({ kind: 'bonus', ref: 'toiTrang', xThe: the, label: T.stamp.toiTrang }); }
    return { diem: d, the: the, total: Math.floor(d * the), steps: steps };
  }

  function preview(run, combo) {
    const s = scorePlay(run, 0, combo, { chat: false });
    return { diem: s.diem, the: s.the, level: run.sao[combo.type] || 1 };
  }

  TL.Scoring = { scorePlay: scorePlay, onEvent: onEvent, vanBonus: vanBonus, preview: preview, slotOf: slotOf };
})(globalThis.TL = globalThis.TL || {});
