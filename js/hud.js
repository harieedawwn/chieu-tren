/* js/hud.js  (owner HUD) layout, drawing and hit-testing of the table chrome. Needs config, data, art (fx/sprite/audio optional, ?hud demo only).
 * API  TL.HUD   (all units CSS px; Rect = {x,y,w,h})
 *   layout(w, h, safe?) -> rects   safe = {t,r,b,l} insets. rects = {mode:'landscape'|'portrait', panel (landscape) | topBar (portrait),
 *        qnRow, qnSlot[5] (3:4, art 48x64), oppSeat, oppPlate, oppHand, deck, deckCol, table, tablePlay (free area for played cards), pot, ribbon, comboBox, diemBox, theBox, dbBox (Điểm bàn box / top bar),
 *        info{head,score,stats,...} (landscape), hand, btn{danh,bo,goiy,xep,menu}, cardH (hand card height), tableCardH, oppCardH, qnH}
 *   scaleFor(cssH, dpr) -> int     largest integer art scale whose 64-px card fits cssH; Game.scale = scaleFor(rects.cardH, dpr)
 *   draw(ctx, vm, rects)           chrome + recessed sprite slots. Call BEFORE sprites (nothing opaque lies on a sprite area)
 *   drawOver(ctx, vm, rects)       small labels on top of sprites (Quy nhan names, Heo dat counter). Call AFTER sprites
 *   hit(rects, x, y, all?) -> 'danh'|'bo'|'goiy'|'xep'|'menu'|null   disabled buttons are ignored unless all is true (uses the states of the last draw)
 *   isEnabled(rects, id) -> bool
 *   demoScreen() -> Screen         the ?hud screen: fake mid-game vm, real card textures placed with Sprite.fan, clickable cards and buttons
 * vm extras read when present: hoverBtn, downBtn (button id -> hover/pressed look), house.short, deckLeft, live (false = before the deal: no turn ribbon, no card count),
 *   x2 (bool: Gấp đôi pending, draws a ×2 badge on the Nhân box), vanNo (current ván, 1-based; shown "Ván n/max"), j{diem,the,pot,diemBan,van,house} (FX.juice holders: the number swells), hl (tutorial spotlight, read by the tutorial only).
 * Text: every string goes through TL.Art.textC / TL.Art.badge (measured, centred from the ink box); Quy nhan name bars are labelled in drawOver only when the name fits at 9 px or more.
 */
(function (TL) {
  'use strict';
  const CFG = TL.CFG, DATA = TL.DATA, TX = DATA.TEXT, PAL = CFG.PAL;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const R = (x, y, w, h) => ({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
  const BTN_IDS = ['danh', 'bo', 'goiy', 'xep', 'menu'];
  const CAP = 22; // caption band under the Quy nhan slots
  let UI = 1;      // text scale of the current draw pass (rects.ui, or the info-panel unit)

  function scaleFor(cssH, dpr) { return Math.max(1, Math.floor((cssH * (dpr || 1)) / 64 + 1e-6)); }

  // ------------------------------------------------------------------ layout
  function layout(w, h, safe) {
    safe = safe || { t: 0, r: 0, b: 0, l: 0 };
    const portrait = w / h < CFG.LAYOUT.portraitBelow;
    const pad = Math.round(clamp(Math.min(w, h) * 0.016, 4, 14)), gap = pad;
    const X0 = safe.l + pad, X1 = w - safe.r - pad, Y0 = safe.t + pad, Y1 = h - safe.b - pad;
    const W = X1 - X0, H = Y1 - Y0;
    return portrait ? layoutPortrait(w, h, X0, Y0, W, H, gap) : layoutLandscape(w, h, X0, Y0, W, H, gap);
  }

  function qnGeometry(x, y, slotH, g) {
    const slotW = Math.round(slotH * 0.75), slots = [];
    for (let i = 0; i < CFG.LAYOUT.qnSlots; i++) slots.push(R(x + i * (slotW + g), y, slotW, slotH));
    return { slots: slots, row: R(x, y, 5 * slotW + 4 * g, slotH + CAP), slotW: slotW };
  }

  // the stage: pot plate centred under a popup lane, turn ribbon in the corner, played cards centred and large.
  // On a short table (phones) the pot moves to the left edge and the cards take the full height.
  function stage(table, mode, cardH) {
    const compact = table.h < 210, rh = Math.round(clamp(table.h * (compact ? 0.15 : 0.1), 20, 34));
    let pot, ribbon, tablePlay;
    if (compact) {
      const potW = Math.round(clamp(table.w * 0.2, 84, 160)), potH = Math.round(clamp(table.h * 0.4, 38, 64)), lane = Math.round(clamp(table.h * 0.18, 18, 28));
      pot = R(table.x + 10, table.y + lane + Math.round((table.h - lane - 10 - potH) / 2), potW, potH);
      ribbon = R(table.x + table.w - 10 - 10, table.y + 8, 10, rh);
      const x0 = pot.x + pot.w + 10, y0 = table.y + 8 + rh + 14;
      tablePlay = R(x0, y0, table.x + table.w - 10 - x0, table.y + table.h - 8 - y0);
    } else {
      const lane = Math.round(clamp(table.h * 0.1, 26, 44));
      const potW = Math.round(clamp(table.w * (mode === 'portrait' ? 0.34 : 0.2), 100, 250)), potH = Math.round(clamp(table.h * 0.2, 46, 84));
      pot = R(table.x + (table.w - potW) / 2, table.y + lane, potW, potH);
      ribbon = R(table.x + 10, table.y + 8, 10, rh);
      const pl = Math.round(clamp(table.h * 0.07, 20, 34));   // popup lane above the played cards
      tablePlay = R(table.x + 10, pot.y + pot.h + 8 + pl, table.w - 20, table.y + table.h - 10 - (pot.y + pot.h + 8 + pl));
    }
    const tableCardH = Math.floor(Math.min(cardH * (mode === 'portrait' ? 0.95 : 1.12), tablePlay.h * 0.94));
    return { pot: pot, ribbon: ribbon, tablePlay: tablePlay, tableCardH: tableCardH, compact: compact };
  }

  function oppGeometry(oppSeat, slotH, mode) {
    const gapX = 6;
    let plateW = Math.round(clamp(oppSeat.w * (mode === 'portrait' ? 0.5 : 0.5), 140, 340));
    plateW = Math.max(120, Math.min(plateW, oppSeat.w - gapX - 130));
    const plate = R(oppSeat.x, oppSeat.y, plateW, oppSeat.h - 4);
    const fanW = oppSeat.w - plateW - gapX;
    const oppCardH = Math.round(Math.max(40, Math.min(slotH * 0.8, 130, ((fanW * 0.94) / 5.5) / 0.75)));
    const fanH = Math.round(oppCardH * 1.2) + 4;
    const oppHand = R(oppSeat.x + plateW + gapX, oppSeat.y + Math.max(0, (oppSeat.h - 4 - fanH) / 2), fanW, fanH);
    return { plate: plate, plateW: plateW, oppCardH: oppCardH, oppHand: oppHand };
  }

  function layoutLandscape(w, h, X0, Y0, W, H, gap) {
    const L = CFG.LAYOUT;
    const pw = Math.round(clamp(w * L.panelFrac, 196, 460));
    const panel = R(X0, Y0, pw, H);
    const ax = X0 + pw + gap, aW = X0 + W - ax;
    const btnW = Math.round(clamp(aW * 0.3, 148, 340));
    const handW = aW - btnW - gap;
    let cardH = Math.round(clamp(h * L.cardHFrac, 56, 300));
    cardH = Math.min(cardH, Math.floor(((handW / 4.6) * 64) / 48));
    let slotH = Math.min(Math.round(H * 0.2), Math.round(cardH * (cardH <= 120 ? 0.85 : 0.62)));
    slotH = Math.max(slotH, 44);
    const qg = Math.round(clamp(slotH * 0.07, 4, 10));
    while (slotH > 40 && aW - (5 * Math.round(slotH * 0.75) + 4 * qg) - gap < 300) slotH -= 2;
    const topH = slotH + CAP;
    const handHof = c => Math.round(c * 1.2) + 4;
    const tableMin = H * 0.3;
    cardH = Math.min(cardH, Math.floor((H - topH - tableMin - 2 * gap - 4) / 1.2));
    cardH = Math.max(cardH, 48);
    const bandH = Math.max(handHof(cardH), 106);
    const handY = Y0 + H - bandH;
    const hand = R(ax, handY + (bandH - handHof(cardH)), handW, handHof(cardH));
    // buttons: top row Danh | Bo luot, bottom row Goi y | Xep, bottom-aligned with the band
    const bx = X0 + W - btnW, r2 = clamp(Math.round(bandH * 0.4), 48, 76), r1 = clamp(bandH - r2 - 6, 52, 100), bg = 6, hw = Math.floor((btnW - bg) / 2);
    const by2 = Y0 + H - r2, by1 = by2 - bg - r1;
    const qn = qnGeometry(ax, Y0, slotH, qg);
    const oppSeat = R(ax + qn.row.w + gap, Y0, aW - qn.row.w - gap, topH);
    const og = oppGeometry(oppSeat, slotH, 'landscape');
    // table (stage) with the draw pile in its own recessed column on the right, outside the table
    const tY = Y0 + topH + gap, tH = handY - gap - tY;
    const deckH = Math.round(clamp(Math.min(tH * 0.46, cardH * 0.7), 44, 190)), deckW = Math.round(deckH * 0.75);
    const colW = deckW + Math.round(clamp(deckW * 0.4, 14, 30));
    const table = R(ax, tY, aW - colW - gap, tH);
    const deckCol = R(table.x + table.w + gap, tY, colW, tH);
    const deck = R(deckCol.x + (colW - deckW) / 2, deckCol.y + Math.round((tH - deckH) / 2) - 8, deckW, deckH);
    const sg = stage(table, 'landscape', cardH);
    // ---- left info panel: four blocks + menu, equally spaced
    const ip = 8, inner = pw - 2 * ip, GAPMIN = 8;
    const BASE = { head: 50, score: 66, combo: 104, stats: 34 }, baseSum = BASE.head + BASE.score + BASE.combo + BASE.stats;
    const u = clamp(Math.min((H - 2 * ip - 64 - GAPMIN * 4) / baseSum, inner / 168), 0.72, 3);
    const menuH = Math.round(clamp(40 * u, 46, 84));
    const hh = { head: Math.round(BASE.head * u), score: Math.round(BASE.score * u), combo: Math.round(BASE.combo * u), stats: Math.round(BASE.stats * u) };
    const free = H - 2 * ip - hh.head - hh.score - hh.combo - hh.stats - menuH;
    const g2 = Math.max(GAPMIN, Math.floor(free / 4));
    let y = Y0 + ip;
    const info = { u: u, inner: inner, gap: g2 };
    info.head = R(X0 + ip, y, inner, hh.head); y += hh.head + g2;
    info.score = R(X0 + ip, y, inner, hh.score); y += hh.score + g2;
    const comboBox = R(X0 + ip, y, inner, hh.combo); y += hh.combo + g2;
    info.stats = R(X0 + ip, y, inner, hh.stats);
    info.nameH = Math.round(22 * u); info.lane = Math.round(12 * u);
    info.dbBox = R(info.score.x, info.score.y + Math.round(18 * u) + Math.round(4 * u), info.score.w, Math.round(34 * u));
    const bh = hh.combo - info.nameH - info.lane, bw = Math.floor((inner - Math.round(16 * u)) / 2), by = comboBox.y + info.nameH + info.lane;
    const diemBox = R(comboBox.x, by, bw, bh), theBox = R(comboBox.x + inner - bw, by, bw, bh);
    const menu = R(X0 + ip, Y0 + H - ip - menuH + 4, inner, menuH);
    return {
      mode: 'landscape', panel: panel, qnRow: qn.row, qnSlot: qn.slots, oppSeat: oppSeat, oppPlate: og.plate, oppHand: og.oppHand, deck: deck, deckCol: deckCol, table: table, tablePlay: sg.tablePlay,
      pot: sg.pot, ribbon: sg.ribbon, comboBox: comboBox, diemBox: diemBox, theBox: theBox, dbBox: info.dbBox, hand: hand,
      btn: { danh: R(bx, by1, hw, r1), bo: R(bx + hw + bg, by1, btnW - hw - bg, r1), goiy: R(bx, by2, hw, r2), xep: R(bx + hw + bg, by2, btnW - hw - bg, r2), menu: menu },
      cardH: cardH, tableCardH: sg.tableCardH, compact: sg.compact, oppCardH: og.oppCardH, qnH: slotH, ui: clamp(cardH / 96, 1, 2.2), info: info, plateW: og.plateW, caption: CAP,
    };
  }

  function layoutPortrait(w, h, X0, Y0, W, H, gap) {
    const tb = Math.round(clamp(H * 0.115, 66, 104));
    const qg = Math.max(4, Math.round(gap * 0.8));
    let slotW = Math.floor((W - 5 * qg) / 6), slotH = Math.min(Math.round((slotW * 4) / 3), Math.round(H * 0.125));
    slotW = Math.round(slotH * 0.75);
    const oppH = Math.round(clamp(H * 0.1, 58, 110)), comboH = Math.round(clamp(H * 0.095, 58, 96)), btnH = Math.round(clamp(H * 0.075, 52, 66));
    let cardH = Math.min(Math.round(h * CFG.LAYOUT.cardHFrac), Math.floor(((W / 4.6) * 64) / 48));
    const handHof = c => Math.round(c * 1.2) + 4;
    const qnH = slotH + CAP;
    const fixed = tb + qnH + oppH + comboH + btnH + 6 * gap;
    const tableMin = Math.max(110, H * 0.19);
    cardH = Math.max(48, Math.min(cardH, Math.floor((H - fixed - tableMin - 4) / 1.2)));
    const handH = handHof(cardH);
    let y = Y0;
    const topBar = R(X0, y, W, tb); y += tb + gap;
    const qn = qnGeometry(X0, y, slotH, qg);
    const deck = R(X0 + 5 * (slotW + qg), y, slotW, slotH);
    y += qnH + gap;
    const oppSeat = R(X0, y, W, oppH); y += oppH + gap;
    const tableH = H - (y - Y0) - comboH - handH - btnH - 3 * gap;
    const table = R(X0, y, W, tableH); y += tableH + gap;
    const comboBox = R(X0, y, W, comboH); y += comboH + gap;
    const hand = R(X0, y, W, handH); y += handH + gap;
    const bg = 6, bw = Math.floor((W - 3 * bg) / 4), by = Y0 + H - btnH;
    const btn = {};
    ['danh', 'bo', 'goiy', 'xep'].forEach((id, i) => { btn[id] = R(X0 + i * (bw + bg), by, i === 3 ? W - 3 * (bw + bg) : bw, btnH); });
    const mS = 48;
    btn.menu = R(topBar.x + topBar.w - mS - 6, topBar.y + Math.round((tb - mS) / 2), mS, mS);
    const og = oppGeometry(oppSeat, oppH, 'portrait');
    const sg = stage(table, 'portrait', cardH);
    // combo box internals: name block left, Diem x The right
    const boxH = comboH - 10, rightW = Math.round(W * 0.64), bw2 = Math.floor((rightW - 22) / 2);
    const diemBox = R(comboBox.x + comboBox.w - rightW - 6, comboBox.y + 5, bw2, boxH);
    const theBox = R(comboBox.x + comboBox.w - 6 - bw2, comboBox.y + 5, bw2, boxH);
    return {
      mode: 'portrait', topBar: topBar, qnRow: qn.row, qnSlot: qn.slots, oppSeat: oppSeat, oppPlate: og.plate, oppHand: og.oppHand, deck: deck, table: table, tablePlay: sg.tablePlay,
      pot: sg.pot, ribbon: sg.ribbon, comboBox: comboBox, diemBox: diemBox, theBox: theBox, dbBox: topBar, hand: hand, btn: btn,
      cardH: cardH, tableCardH: sg.tableCardH, compact: sg.compact, oppCardH: og.oppCardH, qnH: slotH, ui: clamp(cardH / 96, 1, 2.2), plateW: og.plateW, caption: CAP,
    };
  }

  // ------------------------------------------------------------------ drawing helpers
  const A = () => TL.Art;
  const scaleOf = ctx => Math.max(1, ctx.getTransform().a);

  // text centred on (x, cy) vertically from its measured ink box; size is scaled by the pass unit UI unless raw
  function txt(ctx, str, x, cy, size, o) {
    o = o || {};
    const min = o.min || 10;
    size = Math.max(min, Math.round(size * (o.raw ? 1 : UI))); str = String(str);
    if (o.maxW) {
      while (size > min && A().textWidth(str, size) > o.maxW) size--;
      if (A().textWidth(str, size) > o.maxW) {
        while (str.length > 1 && A().textWidth(str + '…', size) > o.maxW) str = str.slice(0, -1);
        str += '…';
      }
    }
    const op = { size: size, color: o.color || PAL.giayDo, align: o.align || 'left', outline: o.outline === undefined ? (size >= 15 ? PAL.denSon : false) : o.outline, shadow: o.shadow === undefined ? PAL.denSon : o.shadow };
    if (o.alpha != null) { ctx.save(); ctx.globalAlpha = o.alpha; }
    const wd = A().textC(ctx, str, x, cy, op);
    if (o.alpha != null) ctx.restore();
    return wd;
  }
  const TW = (str, size) => A().textWidth(str, Math.max(10, Math.round(size * UI)));
  function chip(ctx, str, cx, cy, size, o) {   // small rounded label sized from its text
    o = o || {};
    const sz = Math.max(10, Math.round(size * (o.raw ? 1 : UI)));
    if (o.left) cx += A().badgeSize(str, sz, { minW: o.minW }).w / 2;   // cx is the left edge
    return A().badge(ctx, str, cx, cy, { size: sz, fill: o.fill || PAL.doSon, ink: o.ink || PAL.giayDo, edge: o.edge, shadow: o.shadow === undefined ? false : o.shadow, radius: o.radius, minW: o.minW, minH: o.minH });
  }
  function wrap(str, size, maxW, maxLines) {
    const words = String(str).split(' '), lines = [''];
    words.forEach(wd => {
      const cur = lines[lines.length - 1], t = cur ? cur + ' ' + wd : wd;
      if (!cur || TW(t, size) <= maxW) lines[lines.length - 1] = t;
      else lines.push(wd);
    });
    if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/[.,;]?$/, '') + '…'; }
    return lines;
  }
  function blit(ctx, cv, x, y, boxH, boxW, align) { // integer-scaled, centred in the box
    const s = scaleOf(ctx), k = Math.max(1, Math.floor(Math.min(boxH / cv.height, boxW == null ? 1e9 : boxW / cv.width) * s + 1e-6));
    const w = (cv.width * k) / s, hh = (cv.height * k) / s;
    const ox = align === 'left' ? 0 : ((boxW == null ? w : boxW) - w) / 2;
    const dx = Math.round((x + ox) * s), dy = Math.round((y + (boxH - hh) / 2) * s);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cv, dx, dy, cv.width * k, cv.height * k); ctx.restore();
    return { w: w, h: hh };
  }
  function fillR(ctx, color, x, y, w, h, alpha) {
    const s = scaleOf(ctx), x0 = Math.round(x * s) / s, y0 = Math.round(y * s) / s;
    const w0 = Math.round((x + w) * s) / s - x0, h0 = Math.round((y + h) * s) / s - y0;
    ctx.save(); if (alpha != null) ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.fillRect(x0, y0, w0, h0); ctx.restore();
  }
  function inset(ctx, r, color, alpha, off) {
    off = off || 4;
    fillR(ctx, color, r.x + off, r.y + off, r.w - 2 * off, 1, alpha); fillR(ctx, color, r.x + off, r.y + r.h - off - 1, r.w - 2 * off, 1, alpha);
    fillR(ctx, color, r.x + off, r.y + off, 1, r.h - 2 * off, alpha); fillR(ctx, color, r.x + r.w - off - 1, r.y + off, 1, r.h - 2 * off, alpha);
  }
  function lacquer(ctx, r, fill, o) {
    o = o || {};
    A().panel(ctx, r, { fill: fill, border: o.border === undefined ? PAL.vangKim : o.border, shadow: o.shadow === undefined ? PAL.denSon : o.shadow, radius: o.radius });
    if (o.line !== false) inset(ctx, r, PAL.vangKim, 0.35, o.off || 5);
  }
  function icon(ctx, name, x, y, size) { return blit(ctx, A().icon(name), x, y, size, size, 'left'); }
  const juiced = (vm, k) => (TL.FX && vm.j && vm.j[k] ? TL.FX.juiceOf(vm.j[k]).s : 1);
  function scoreBox(ctx, r, label, value, fill, empty, js) {
    A().panel(ctx, r, { fill: fill, border: PAL.denSon, shadow: PAL.denSon, radius: 5 });
    fillR(ctx, PAL.giayDo, r.x + 5, r.y + 3, r.w - 10, 1, 0.3);
    const ls = clamp(r.h * 0.24, 10, 24);
    txt(ctx, label, r.x + r.w / 2, r.y + r.h * 0.26, ls, { align: 'center', alpha: 0.9, maxW: r.w - 8, raw: true });
    const vs = clamp(r.h * 0.46, 14, 64);
    if (empty) txt(ctx, '–', r.x + r.w / 2, r.y + r.h * 0.67, vs, { align: 'center', alpha: 0.4, shadow: false, outline: false, raw: true });
    else txt(ctx, TL.fmt(value), r.x + r.w / 2, r.y + r.h * 0.67, vs * (js || 1), { align: 'center', maxW: r.w - 10, min: 12, raw: true });
  }
  function bar(ctx, r, frac) {
    fillR(ctx, PAL.denSon, r.x, r.y, r.w, r.h);
    fillR(ctx, PAL.nauCanhGian, r.x + 1, r.y + 1, r.w - 2, r.h - 2);
    const fw = Math.round((r.w - 2) * clamp(frac, 0, 1));
    if (fw > 0) fillR(ctx, frac >= 1 ? PAL.vangKim : PAL.laXanh, r.x + 1, r.y + 1, fw, r.h - 2);
  }
  function btnState(vm, id, enabled) {
    if (!enabled) return 'disabled';
    if (vm.downBtn === id) return 'down';
    if (vm.hoverBtn === id) return 'hover';
    return 'idle';
  }
  function enabledMap(vm) {
    const mine = vm.turn === 0 && !vm.busy;
    return { danh: mine && !!vm.canPlay, bo: mine && !!vm.canPass, goiy: mine, xep: !vm.busy, menu: true };
  }
  const vanText = vm => TX.hud.van + ' ' + (vm.vanNo || 1) + '/' + vm.vanMax;

  // ------------------------------------------------------------------ draw
  function drawTable(ctx, vm, r) {
    A().panel(ctx, r.table, { fill: PAL.denSon, border: false, shadow: false, radius: 8 });
    inset(ctx, r.table, PAL.vangKim, 0.18, 3);
    // pot plate, centred at the top of the stage; the lane above it is where its popups rise
    const p = r.pot;
    lacquer(ctx, p, PAL.nauCanhGian, { off: 4, radius: 5 });
    txt(ctx, TX.hud.pot, p.x + p.w / 2, p.y + p.h * 0.27, clamp(p.h * 0.24, 10, 22), { align: 'center', alpha: 0.9, maxW: p.w - 10, raw: true });
    txt(ctx, TL.fmt(vm.pot || 0), p.x + p.w / 2, p.y + p.h * 0.67, clamp(p.h * 0.42, 14, 48) * juiced(vm, 'pot'), { align: 'center', color: PAL.vangKim, maxW: p.w - 12, min: 12, raw: true });
    // turn ribbon: only once the cards are dealt
    if (vm.live) {
      const mine = vm.turn === 0, label = mine ? TX.hud.yourTurn : TX.hud.oppTurn, sz = Math.round(clamp(r.table.h * 0.07, 11, 20));
      const o = { size: sz, padX: Math.round(sz * 0.7), padY: Math.round(sz * 0.35) }, bs = A().badgeSize(label, sz, o);
      const right = r.mode === 'portrait' || r.compact, room = right ? r.table.w - 20 : Math.max(60, r.pot.x - r.table.x - 24), w = Math.min(bs.w, room);
      const x = right ? r.table.x + r.table.w - w - 10 : r.table.x + 10;
      A().badge(ctx, label, x + w / 2, r.table.y + 8 + bs.h / 2, Object.assign(o, { minW: w, fill: mine ? PAL.doSon : PAL.nauCanhGian, ink: mine ? PAL.vangKim : PAL.giayDo, edge: mine ? PAL.vangKim : false, shadow: false, bw: 1 }));
    }
  }
  function drawDeck(ctx, vm, r) {
    const d = r.deck;
    if (r.deckCol) A().slot(ctx, r.deckCol, { radius: 6 });
    for (let i = 2; i >= 0; i--) {
      const cv = A().back(), s = scaleOf(ctx), k = scaleFor(d.h, s);
      const px = (cv.width * k) / s, pyh = (cv.height * k) / s;
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
      ctx.drawImage(cv, Math.round((d.x + (d.w - px) / 2 - i * 2) * s), Math.round((d.y + (d.h - pyh) - i * 2) * s), cv.width * k, cv.height * k);
      ctx.restore();
    }
    if (typeof vm.deckLeft === 'number') {
      const sz = Math.round(clamp(d.h * 0.13, 11, 20));
      chip(ctx, vm.deckLeft, d.x + d.w / 2, d.y + d.h + Math.round(sz * 1.1), sz, { raw: true, fill: PAL.denSon, ink: PAL.vangKim, edge: PAL.vangKim, minW: Math.round(sz * 2.6) });
    }
  }

  function drawQnSlots(ctx, vm, r) {
    r.qnSlot.forEach((s, i) => {
      const has = vm.qn && vm.qn[i];
      A().slot(ctx, s, { radius: 4 });
      if (!has) { // a tiny diamond, not a numeral: the slot is empty, not a button
        const cx = s.x + s.w / 2, cy = s.y + s.h / 2, q = Math.max(2, Math.round(s.h * 0.035));
        [[0, -2], [-1, -1], [0, -1], [1, -1], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [0, 2]].forEach(o => fillR(ctx, PAL.vangKim, cx + o[0] * q - q / 2, cy + o[1] * q - q / 2, q, q, 0.2));
      }
    });
    const n = (vm.qn || []).filter(Boolean).length, c = r.qnRow;
    txt(ctx, TX.hud.qn + ' ' + n + '/' + r.qnSlot.length, c.x + c.w / 2, c.y + c.h - CAP / 2 + 3, clamp(r.qnH * 0.11, 11, 17), { align: 'center', alpha: 0.9, maxW: c.w, shadow: PAL.denSon, raw: true, min: 11 });
  }

  function drawOppSeat(ctx, vm, r) {
    const pl = r.oppPlate;
    lacquer(ctx, pl, PAL.nauCanhGian, { off: 4, radius: 5 });
    const pad = Math.round(clamp(pl.h * 0.07, 5, 12));
    const ps = Math.min(pl.h - 2 * pad, Math.round(pl.w * 0.44)), pw = A().portrait(vm.oppId);
    const pr = blit(ctx, pw, pl.x + pad, pl.y + pad, pl.h - 2 * pad, ps, 'left');
    const tx = pl.x + pad + pr.w + pad + 2, tw = pl.x + pl.w - pad - tx;
    const hs = Math.round(clamp(pl.h * 0.22, 13, 34)), cs = Math.round(clamp(pl.h * 0.14, 11, 22));
    // the text column: name / luật nhà chip + rule / card count, spaced evenly and centred in the plate
    const nameH = Math.round(hs * 1.15), chipH = A().badgeSize('Lj', cs, {}).h;
    const room = pl.h - 2 * pad, ruleH = Math.round(cs * 1.2);
    const showRule = !!vm.house && nameH + 2 * chipH + ruleH + 3 * 3 <= room;   // a short plate keeps the chip and drops the rule line
    const rows = [{ h: nameH }];
    if (vm.house) rows.push({ h: chipH }); if (showRule) rows.push({ h: ruleH });
    rows.push({ h: chipH });
    const used = rows.reduce((a, b) => a + b.h, 0);
    const gap = Math.max(2, Math.min(Math.round(pl.h * 0.09), Math.floor((room - used) / Math.max(1, rows.length - 1))));
    let y = pl.y + pad + Math.max(0, (room - used - gap * (rows.length - 1)) / 2);
    const mid = h => y + h / 2;
    txt(ctx, vm.oppName || '', tx, mid(nameH), hs, { maxW: tw, color: PAL.vangKim, min: 11, raw: true }); y += nameH + gap;
    if (vm.house) {
      chip(ctx, TX.hud.house, tx, mid(chipH), Math.round(cs * juiced(vm, 'house')), { raw: true, left: true, fill: PAL.doSon, ink: PAL.giayDo });
      y += chipH + gap;
      if (showRule) { txt(ctx, vm.house.short || vm.house.name, tx, mid(ruleH), Math.round(cs * juiced(vm, 'house')), { maxW: tw, alpha: 0.95, shadow: false, raw: true }); y += ruleH + gap; }
    }
    if (vm.oppCount > 0) {
      const parts = [TX.hud.oppCards.replace('%d', vm.oppCount)];
      if (vm.oppHeo != null) parts.push(TX.hud.oppHeo.replace('%d', vm.oppHeo));
      let lab = parts.join(' · '), size = cs;
      while (size > 10 && A().textWidth(lab, size) + size * 1.1 > tw) size--;
      const bs = A().badgeSize(lab, size, {});
      A().badge(ctx, lab, tx + Math.min(bs.w, tw) / 2, mid(chipH), { size: size, fill: PAL.denSon, ink: PAL.giayDo, edge: PAL.vangKim, shadow: false, bw: 1, minW: Math.min(bs.w, tw) });
    }
  }

  function drawInfoLandscape(ctx, vm, r) {
    const p = r.panel, I = r.info, u = I.u; UI = u;
    lacquer(ctx, p, PAL.nauCanhGian, { off: 4, radius: 6 });
    // block 1: bàn info (chặng, kind chip + bàn n/3)
    const hd = I.head, row1 = hd.y + hd.h * 0.27, row2 = hd.y + hd.h * 0.74;
    txt(ctx, vm.chang && vm.chang.name || '', hd.x + 2, row1, 17, { color: PAL.vangKim, maxW: hd.w - 4 });
    const kind = TX.kind[vm.ban && vm.ban.kind] || '', ks = 11;
    const kb = chip(ctx, kind, hd.x + 2, row2, ks, { fill: PAL.doSon, ink: PAL.vangKim, left: true });
    txt(ctx, TX.hud.ban + ' ' + ((vm.ban && vm.ban.idx || 0) + 1) + '/3', kb.x + kb.w + 8, row2, 13, { maxW: hd.x + hd.w - kb.x - kb.w - 10, alpha: 0.95 });
    // block 2: target, Điểm bàn, progress
    const sc = I.score, ic = Math.round(16 * u), rowH = Math.round(18 * u);
    icon(ctx, 'muc_tieu', sc.x + 1, sc.y + (rowH - ic) / 2, ic);
    txt(ctx, TX.hud.target, sc.x + ic + 6, sc.y + rowH / 2, 12, { alpha: 0.9, maxW: sc.w * 0.5 });
    txt(ctx, TL.fmt(vm.target || 0), sc.x + sc.w - 2, sc.y + rowH / 2, 15, { align: 'right', color: PAL.vangKim, maxW: sc.w * 0.42 });
    const bx = I.dbBox;
    A().panel(ctx, bx, { fill: PAL.denSon, border: PAL.vangKim, shadow: false, radius: 4 });
    txt(ctx, TX.hud.diemBan, bx.x + 8, bx.y + bx.h / 2, 12, { alpha: 0.9, maxW: bx.w * 0.4 });
    txt(ctx, TL.fmt(vm.diemBan || 0), bx.x + bx.w - 8, bx.y + bx.h / 2, 20 * juiced(vm, 'diemBan'), { align: 'right', maxW: bx.w * 0.58, min: 12 });
    bar(ctx, R(sc.x, bx.y + bx.h + 5 * u, sc.w, Math.max(5, Math.round(6 * u))), (vm.diemBan || 0) / Math.max(1, vm.target || 1));
    // block 3: combo name + level, Điểm × Thế
    drawCombo(ctx, vm, r, I.nameH);
    // block 4: ván + lì xì
    const st = I.stats, half = Math.floor((st.w - 6) / 2);
    const boxes = [
      { ic: 'van', t: vanText(vm), r: R(st.x, st.y, half, st.h) },
      { ic: 'lixi', t: TL.fmt(vm.lixi || 0), r: R(st.x + st.w - half, st.y, half, st.h), gold: true },
    ];
    boxes.forEach(b => {
      A().panel(ctx, b.r, { fill: PAL.denSon, border: PAL.vangKim, shadow: false, radius: 4 });
      const s2 = Math.min(Math.round(20 * u), b.r.h - 8), iy = b.r.y + (b.r.h - s2) / 2;
      icon(ctx, b.ic, b.r.x + 6, iy, s2);
      txt(ctx, b.t, b.r.x + 6 + s2 + 6, b.r.y + b.r.h / 2, 13 * (b.ic === 'van' ? juiced(vm, 'van') : 1), { maxW: b.r.w - s2 - 18, color: b.gold ? PAL.vangKim : PAL.giayDo, min: 11 });
    });
  }

  function drawCombo(ctx, vm, r, nameH) {
    const cb = r.comboBox, land = r.mode === 'landscape', empty = !vm.combo;
    const jd = juiced(vm, 'diem'), jt = juiced(vm, 'the');
    if (land) {
      const ny = cb.y + nameH / 2;
      if (vm.msg) {
        A().panel(ctx, R(cb.x, cb.y, cb.w, nameH), { fill: PAL.doSon, border: false, shadow: false, radius: 3 });
        txt(ctx, vm.msg, cb.x + 6, ny, 11, { maxW: cb.w - 12, color: PAL.giayDo, shadow: false });
      } else if (vm.combo) {
        const lv = TX.hud.level.replace('%d', vm.combo.level), wl = TW(lv, 11) + 4;
        txt(ctx, vm.combo.name, cb.x + 2, ny, 15, { color: PAL.vangKim, maxW: cb.w - wl - 6 });
        txt(ctx, lv, cb.x + cb.w - 2, ny, 11, { align: 'right', alpha: 0.9 });
      } else txt(ctx, TX.msg.pickCards, cb.x + 2, ny, 12, { alpha: 0.6, maxW: cb.w });
    } else {
      lacquer(ctx, cb, PAL.nauCanhGian, { off: 3, radius: 5 });
      const lx = cb.x + 10, lw = r.diemBox.x - lx - 8, cy = cb.y + cb.h / 2;
      if (vm.msg) {
        wrap(vm.msg, 11, lw, 3).forEach((ln, i, a) => txt(ctx, ln, lx, cy + (i - (a.length - 1) / 2) * 13 * UI, 11, { maxW: lw, color: PAL.giayDo }));
      } else if (vm.combo) {
        txt(ctx, vm.combo.name, lx, cy - 8 * UI, 15, { color: PAL.vangKim, maxW: lw });
        txt(ctx, TX.hud.level.replace('%d', vm.combo.level), lx, cy + 11 * UI, 11, { alpha: 0.9, maxW: lw });
      } else txt(ctx, TX.msg.pickCards, lx, cy, 12, { alpha: 0.6, maxW: lw });
    }
    scoreBox(ctx, r.diemBox, TX.hud.diem, vm.diem || 0, PAL.menLam, empty, jd);
    scoreBox(ctx, r.theBox, TX.hud.the, vm.the || 0, PAL.doSon, empty, jt);
    if (vm.x2) A().badge(ctx, TX.hud.x2, r.theBox.x + r.theBox.w - 16, r.theBox.y - 2, { size: 14, fill: PAL.vangKim, ink: PAL.denSon, edge: PAL.denSon, anchor: 'bottom', shadow: false, bw: 1 });   // Gấp đôi pending
    txt(ctx, '×', (r.diemBox.x + r.diemBox.w + r.theBox.x) / 2, r.diemBox.y + r.diemBox.h / 2, land ? 18 : 16, { align: 'center', color: PAL.vangKim, min: 14, alpha: empty ? 0.45 : 1 });
  }

  function drawTopBar(ctx, vm, r) {
    const t = r.topBar, m = r.btn.menu;
    lacquer(ctx, t, PAL.nauCanhGian, { off: 3, radius: 6 });
    const lx = t.x + 10, rx = m.x - 8, w = rx - lx, kind = TX.kind[vm.ban && vm.ban.kind] || '';
    const r1 = t.y + t.h * 0.3, r2 = t.y + t.h * 0.7;
    // row 1: kind chip, chặng · bàn | right: lì xì + ván
    const ks = 11;
    const kb = A().badgeSize(kind, Math.round(ks * UI), {});
    chip(ctx, kind, lx + kb.w / 2, r1, ks, { fill: PAL.doSon, ink: PAL.vangKim });
    const stat = [{ ic: 'lixi', t: TL.fmt(vm.lixi || 0), c: PAL.vangKim }, { ic: 'van', t: vanText(vm), c: PAL.giayDo }];
    let sx = rx;
    stat.forEach(sv => {
      const wt = TW(sv.t, 12), isz = Math.round(16 * UI); sx -= wt;
      txt(ctx, sv.t, sx, r1, 12 * (sv.ic === 'van' ? juiced(vm, 'van') : 1), { color: sv.c, min: 11 }); sx -= isz + 2; icon(ctx, sv.ic, sx, r1 - isz / 2, isz); sx -= 10;
    });
    const nx = lx + kb.w + 8, nw = sx - nx;
    txt(ctx, (vm.chang && vm.chang.name || '') + ' · ' + TX.hud.ban + ' ' + ((vm.ban && vm.ban.idx || 0) + 1) + '/3', nx, r1, 13, { color: PAL.vangKim, maxW: nw, min: 10 });
    // row 2: progress with numbers
    const bh = Math.round(t.h * 0.3), by = r2 - bh / 2 + 2, bw = w;
    fillR(ctx, PAL.denSon, lx, by, bw, bh);
    fillR(ctx, PAL.nauCanhGian, lx + 1, by + 1, bw - 2, bh - 2);
    const fr = clamp((vm.diemBan || 0) / Math.max(1, vm.target || 1), 0, 1);
    if (fr > 0) fillR(ctx, fr >= 1 ? PAL.vangKim : PAL.laXanh, lx + 1, by + 1, Math.round((bw - 2) * fr), bh - 2);
    const label = TX.hud.diemBan + ' ' + TL.fmt(vm.diemBan || 0) + ' / ' + TL.fmt(vm.target || 0);
    txt(ctx, label, lx + bw / 2, by + bh / 2, clamp(bh - 6, 10, 28), { align: 'center', maxW: bw - 8, min: 10, shadow: PAL.denSon, outline: PAL.denSon, raw: true });
  }

  function drawButtons(ctx, vm, r) {
    const en = enabledMap(vm), st = {};
    BTN_IDS.forEach(id => {
      const label = id === 'xep' ? (vm.sortMode === 'suit' ? TX.btn.xepSuit : TX.btn.xepRank) : TX.btn[id];
      st[id] = btnState(vm, id, en[id]);
      if (id === 'menu' && r.mode === 'portrait') {
        A().button(ctx, r.btn.menu, '', st[id]);
        const m = r.btn.menu;
        blit(ctx, A().icon('menu'), m.x, m.y + (st[id] === 'down' ? 3 : 1), m.h - 4, m.w, 'center');
      } else A().button(ctx, r.btn[id], label, st[id]);
    });
    r._st = st;
  }

  function draw(ctx, vm, r) {
    ctx.imageSmoothingEnabled = false;
    UI = r.ui;
    drawTable(ctx, vm, r);
    drawDeck(ctx, vm, r);
    drawQnSlots(ctx, vm, r);
    drawOppSeat(ctx, vm, r);
    if (r.mode === 'landscape') drawInfoLandscape(ctx, vm, r); else { drawTopBar(ctx, vm, r); drawCombo(ctx, vm, r, 0); }
    UI = r.ui;
    drawButtons(ctx, vm, r);
    if (TL.FX && TL.FX.flame) { const on = !!vm.flames; if (r._fl !== on) { TL.FX.flame(r.diemBox, on); TL.FX.flame(r.theBox, on); r._fl = on; } }
  }

  function drawOver(ctx, vm, r) {
    UI = r.ui;
    (vm.qn || []).forEach((q, i) => {
      if (!q) return;
      const s = r.qnSlot[i], def = DATA.QUY_NHAN[q.id], by = s.y + s.h * (51.5 / 64);
      if (def) {
        const maxW = s.w * 0.74; let sz = 11;
        while (sz > 8 && A().textWidth(def.name, sz) > maxW) sz--;
        if (sz >= 9) txt(ctx, def.name, s.x + s.w / 2, by, sz, { align: 'center', min: 8, shadow: false, outline: false, color: PAL.giayDo, raw: true });
      }
      if (q.n > 0) {
        const t = '+' + q.n, sz = Math.max(10, Math.round(11 * UI)), bs = A().badgeSize(t, sz, {});
        A().badge(ctx, t, s.x + s.w - bs.w / 2 - 2, s.y + 3 + bs.h / 2, { size: sz, fill: PAL.doSon, ink: PAL.giayDo, edge: PAL.vangKim, shadow: false, bw: 1 });
      }
    });
  }

  function hit(r, x, y, all) {
    for (const id of BTN_IDS) {
      const b = r.btn[id];
      if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return (all || !r._st || r._st[id] !== 'disabled') ? id : null;
    }
    return null;
  }
  function isEnabled(r, id) { return !r._st || r._st[id] !== 'disabled'; }

  // ------------------------------------------------------------------ ?hud demo
  function demoVm() {
    const chang = DATA.CHANG[1], ban = chang.ban[2], hr = DATA.HOUSE_RULES[ban.house];
    return {
      chang: { idx: 1, name: chang.name }, ban: { idx: 2, kind: ban.kind, name: ban.name }, target: CFG.TARGETS[1][2], diemBan: 1240, pot: 185,
      combo: { name: DATA.COMBO_NAME.sanh, level: 2 }, diem: 118, the: 7, vanLeft: 2, vanMax: 3, lixi: 11, oppId: ban.id, oppName: ban.name,
      house: { name: hr.name, quote: hr.quote, short: hr.short }, oppCount: 6, oppHeo: 1, oppReveal: [], deckLeft: 32,
      qn: [{ id: 'chu_xe_om', n: 0 }, { id: 'heo_dat', n: 3 }, { id: 'ba_ban_xoi', n: 0 }, { id: 'dan_cho_lon', n: 0 }, null],
      turn: 0, canPlay: true, canPass: true, busy: false, sortMode: 'rank', msg: null, flames: false, live: true, vanNo: 2, j: {},
    };
  }

  function demoScreen() {
    const G = TL.Game, FX = TL.FX, SP = TL.Sprite, vm = demoVm();
    let r = null, key = '', hand = [], table = [], opp = [], qn = [], down = null, hov = null;
    const HAND = [2, 9, 13, 20, 24, 28, 33, 38, 44, 51], SEL = [20, 24, 28], TABLE = [17, 22, 25];
    function mk(id, sc, back) { return SP.create({ tex: back ? A().back() : A().card(id), x: 0, y: 0, scale: sc }); }
    function build() {
      r = layout(G.w, G.h, G.safe); key = G.w + 'x' + G.h + 'x' + G.dpr;
      const d = G.dpr || 1, hs = scaleFor(r.cardH, d), ts = scaleFor(r.tableCardH, d), os = scaleFor(r.oppCardH, d);
      hand = HAND.map(id => { const s = mk(id, hs); s.id = id; s.selected = SEL.indexOf(id) >= 0; return s; });
      SP.fan(hand, r.hand);
      table = TABLE.map(id => mk(id, ts)); SP.fan(table, r.tablePlay, { overlap: 0.3, curve: 0 });
      opp = []; for (let i = 0; i < vm.oppCount; i++) opp.push(mk(0, os, true)); SP.fan(opp, r.oppHand, { overlap: 0.5, curve: 0.6 });
      qn = []; vm.qn.forEach((q, i) => { if (q) { const s = mk(0, scaleFor(r.qnSlot[i].h, d)); s.tex = A().quyNhan(q.id); s.sway = false; s.T.x = s.V.x = r.qnSlot[i].x + r.qnSlot[i].w / 2; s.T.y = s.V.y = r.qnSlot[i].y + r.qnSlot[i].h / 2; qn.push(s); } });
      [hand, table, opp].forEach(l => l.forEach(s => { s.V.x = s.T.x; s.V.y = s.T.y; s.V.rot = s.T.rot; s._sp.x.x = s.T.x; s._sp.y.x = s.T.y; s._sp.rot.x = s.T.rot; }));
    }
    function say(m) { vm.msg = m; if (FX) FX.after(2, () => { if (vm.msg === m) vm.msg = null; }); }
    return {
      enter() { if (TL.BG) TL.BG.setMood('boss'); build(); },
      exit() {},
      update(dt) {
        if (key !== G.w + 'x' + G.h + 'x' + G.dpr) build();
        [hand, table, opp, qn].forEach(l => l.forEach(s => s.update(dt)));
      },
      draw(ctx) {
        vm.hoverBtn = hov; vm.downBtn = down;
        draw(ctx, vm, r);
        SP.drawAll(ctx, qn); SP.drawAll(ctx, opp); SP.drawAll(ctx, table); SP.drawAll(ctx, hand);
        drawOver(ctx, vm, r);
      },
      pointer(e) {
        const id = hit(r, e.x, e.y, true);
        if (e.type === 'move') { hov = id && isEnabled(r, id) ? id : null; SP.hover(hand, e.x, e.y); return; }
        if (e.type === 'down') {
          if (id && isEnabled(r, id)) { down = id; if (TL.Audio) TL.Audio.play('button'); return; }
          const s = SP.pick(hand, e.x, e.y);
          if (s) { s.selected = !s.selected; s.juice && s.juice(0.6); if (TL.Audio) TL.Audio.play('select'); }
        } else if (e.type === 'up') {
          if (down && id === down) {
            if (down === 'xep') { vm.sortMode = vm.sortMode === 'rank' ? 'suit' : 'rank'; }
            else if (down === 'danh') say(DATA.TEXT.msg.cantBeat);
            else if (down === 'bo') say(DATA.TEXT.msg.mustBeat);
            else if (down === 'menu' && TL.Screens && TL.Screens.settings) G.setScreen('settings');
          }
          down = null;
        }
      },
      key(e) { if (e.key === 's') vm.sortMode = vm.sortMode === 'rank' ? 'suit' : 'rank'; },
    };
  }

  TL.HUD = { layout: layout, scaleFor: scaleFor, draw: draw, drawOver: drawOver, hit: hit, isEnabled: isEnabled, demoScreen: demoScreen, _demoVm: demoVm };
})(globalThis.TL = globalThis.TL || {});
