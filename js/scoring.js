/* js/scoring.js  (owner BALANCE) Điểm × Thế, Quý nhân and Sao effects, SPEC §6. Pure logic, no DOM. Needs config, data, cards.
 * API  (run = RunState; Score = {diem, the, total, steps, xPot?}; ScoreStep per SPEC §4)
 *   TL.Scoring.scorePlay(run, seat, combo, ctx) -> Score   pure; ctx = {chat, target, pot, lead}; seat 1 gets base + cards (+ chặt) only
 *   TL.Scoring.onEvent(run, event)              -> ScoreStep[]   sole owner of Quý nhân state (stack, Heo đất n, break); mutates run
 *   TL.Scoring.vanBonus(run, vanEndEvent)       -> Score   pure; player win = bonus, opponent win = negative total (thối heo penalty)
 *   TL.Scoring.preview(run, combo)              -> {diem, the, level}   base + cards + Sao + Quý nhân, no chặt
 *   TL.Scoring.slotOf(run, id)                  -> slot index or -1
 * Info-only Quý nhân (Thầy bói reveal, Cô hàng xóm heo count) are read by Run/screens, not scored.
 */
(function (TL) {
  'use strict';
  const CFG = TL.CFG, D = TL.DATA, T = D.TEXT, Q = CFG.QN;
  const hasHeo = cards => cards.some(c => (c >> 2) === 12);
  const slotOf = (run, id) => run.qn.findIndex(s => s && s.id === id);
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
      run.qn.forEach(function (s, slot) {
        if (!s) return;
        let d = 0, t = 0;
        if (s.id === 'chu_xe_om' && combo.type === 'sanh') d = Q.XE_OM_DIEM * combo.len;
        else if (s.id === 'thang_ban_than') t = run.van.stack || 0;
        else if (s.id === 'heo_dat') t = s.n || 0;
        else if (s.id === 'ba_ban_xoi' && combo.type === 'rac') t = Q.BAN_XOI_THE;
        else if (s.id === 'ong_do' && combo.type === 'doi') t = Q.ONG_DO_THE;
        if (!d && !t) return;
        diem += d; the += t;
        steps.push({ kind: 'qn', ref: s.id, slot: slot, diem: d || undefined, the: t || undefined, label: d ? '+' + d + ' ' + T.hud.diem : '+' + t + ' ' + T.hud.the });
      });
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

  function onEvent(run, ev) {
    const out = [];
    if (ev.type === 'play' && ev.seat === 0) run.van.stack = 0;
    else if (ev.type === 'pass' && ev.seat === 0) {
      const s = slotOf(run, 'thang_ban_than');
      if (s >= 0) {
        run.van.stack = (run.van.stack || 0) + Q.BAN_THAN_THE;
        out.push({ kind: 'qn', ref: 'thang_ban_than', slot: s, the: Q.BAN_THAN_THE, label: '+' + Q.BAN_THAN_THE + ' ' + T.hud.the });
      }
    } else if (ev.type === 'vong' && ev.winner === 0 && ev.combo && hasHeo(ev.combo.cards)) {
      const s = slotOf(run, 'heo_dat');
      if (s >= 0) {
        run.qn[s].n = (run.qn[s].n || 0) + Q.HEO_DAT_THE;
        out.push({ kind: 'qn', ref: 'heo_dat', slot: s, the: Q.HEO_DAT_THE, label: '+' + Q.HEO_DAT_THE + ' ' + T.hud.the });
      }
    } else if (ev.type === 'chat' && ev.victim === 0 && ev.target && hasHeo(ev.target.cards)) {
      const s = slotOf(run, 'heo_dat');
      if (s >= 0) {
        run.qn[s] = null;
        out.push({ kind: 'qn', ref: 'heo_dat', slot: s, dissolve: true, label: T.stamp.heoVo });
      }
    } else if (ev.type === 'deal') {
      const s = slotOf(run, 'thay_boi');
      if (s >= 0) out.push({ kind: 'qn', ref: 'thay_boi', slot: s, label: T.stamp.thayBoi });
    }
    return out;
  }

  function vanBonus(run, ev) {
    if (ev.winner !== 0) {
      const pen = CFG.THOI_PENALTY * ev.heo[0];
      return { diem: -pen, the: 1, total: -pen, steps: pen ? [{ kind: 'bonus', ref: 'thoi', diem: -pen, label: fill(ev.heo[0] > 1 ? T.stamp.thoiHeoN : T.stamp.thoiHeo, ev.heo[0]) }] : [] };
    }
    const steps = [], d = ev.left[1] * CFG.LEFT_PTS;
    let the = 1;
    steps.push({ kind: 'bonus', ref: 'veNhat', diem: d, label: T.stamp.veNhat });
    const h = ev.heo[1];
    if (h > 0) { the *= Math.pow(CFG.THOI_X, h); steps.push({ kind: 'bonus', ref: 'thoi', xThe: the, label: fill(h > 1 ? T.stamp.thoiHeoN : T.stamp.thoiHeo, h) }); }
    if (ev.cong) { the *= CFG.CONG_X; steps.push({ kind: 'bonus', ref: 'cong', xThe: the, label: T.stamp.cong }); }
    if (ev.toiTrang) { the *= CFG.TOI_TRANG_X; steps.push({ kind: 'bonus', ref: 'toiTrang', xThe: the, label: T.stamp.toiTrang }); }
    return { diem: d, the: the, total: Math.floor(d * the), steps: steps };
  }

  function preview(run, combo) {
    const s = scorePlay(run, 0, combo, { chat: false });
    return { diem: s.diem, the: s.the, level: run.sao[combo.type] || 1 };
  }

  TL.Scoring = { scorePlay: scorePlay, onEvent: onEvent, vanBonus: vanBonus, preview: preview, slotOf: slotOf };
})(globalThis.TL = globalThis.TL || {});
