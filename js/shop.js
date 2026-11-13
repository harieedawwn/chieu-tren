/* js/shop.js  (owner SCREENS) Chợ Tết: replaces TL.Screens.shop from screens.js (that old shop code is no longer used). Needs everything before it.
 * API  TL.Screens.shop = Screen {enter({run}), exit(), resize(), update(dt), draw(ctx), pointer(e), key(e), tutRects()}
 *   Layout: top bar (lì xì, title, menu); owned Quý nhân row (5) + Quẻ slots (2); "Đang bán": 2 Quý nhân, 2 Sao, 1 Quẻ, 1 Bao lì xì as card sprites
 *   with price tags and a rarity mark (thường plain, hiếm men lam, quý vàng kim); info panel with Mua/Bán/Dùng/Mở, Đổi hàng, Đi tiếp.
 *   Bao lì xì: envelope shakes, tears, 3 cards fan out and flip, pick 1 (Chọn) or Bỏ qua, the pick flies to its slot. State lives in run.pack, so a reload resumes it.
 *   Input: mouse, touch, keyboard (arrows move the selection, Enter = main action, Space = Đi tiếp, Esc = settings). Saves with Run.save after every change.
 *   ?auto buys every affordable item (packs included, picks the first card) and continues.
 */
(function (TL) {
  'use strict';
  const CFG = TL.CFG, D = TL.DATA, T = D.TEXT, PAL = CFG.PAL, FX = TL.FX, SP = TL.Sprite, A = TL.Art, fmt = TL.fmt;
  const G = () => TL.Game;
  const snd = (n, o) => { try { TL.Audio && TL.Audio.play(n, o); } catch (e) {} };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const inR = (b, x, y) => !!b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  const ctr = b => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
  const rr = r => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) });
  const txt = (ctx, s, x, y, size, color, align) => A.text(ctx, s, x, y, { size: size, color: color || PAL.giayDo, align: align || 'left' });
  const fit = (s, size, maxW, min) => { while (size > (min || 9) && A.textWidth(s, size) > maxW) size--; return size; };
  const base = () => Math.round(clamp(Math.min(G().w, G().h) / 36, 12, 22));
  const wrap = (s, size, maxW) => { const out = []; let line = ''; String(s).split(' ').forEach(w => { const t = line ? line + ' ' + w : w; if (line && A.textWidth(t, size) > maxW) { out.push(line); line = w; } else line = t; }); if (line) out.push(line); return out; };
  const saveRun = run => { if (G().flags.auto || !run || run.phase === 'won' || run.phase === 'lost') return; try { localStorage.setItem(CFG.STORAGE.save, TL.Run.save(run)); } catch (e) {} };
  const clearSave = () => { try { localStorage.removeItem(CFG.STORAGE.save); } catch (e) {} };
  const drawIcon = (ctx, name, x, y, k) => { const c = A.icon(name); if (!c) return; ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(c, Math.round(x), Math.round(y), 16 * k, 16 * k); ctx.restore(); };
  const menuRect = () => { const g = G(); return { x: g.w - g.safe.r - 8 - 44, y: g.safe.t + 6, w: 44, h: 44 }; };

  function Btns() {
    const o = { list: [], hover: null, down: null };
    const hit = (x, y) => o.list.find(b => b.on !== false && inR(b.r, x, y)) || null;
    o.draw = ctx => o.list.forEach(b => A.button(ctx, b.r, b.label, b.on === false ? 'disabled' : o.down === b.id ? 'down' : o.hover === b.id ? 'hover' : 'idle'));
    o.pointer = (e, fn) => {
      if (e.type === 'move') { const b = hit(e.x, e.y); o.hover = b ? b.id : null; return false; }
      if (e.type === 'down') { const b = hit(e.x, e.y); o.down = b ? b.id : null; o.hover = o.down; if (b) snd('button'); return !!b; }
      if (e.type === 'up') { const b = hit(e.x, e.y), d = o.down; o.down = null; o.hover = null; if (b && d === b.id) { fn(b.id); return true; } }
      return false;
    };
    return o;
  }

  const data = (kind, id) => kind === 'qn' ? D.QUY_NHAN[id] : kind === 'que' ? D.QUE[id] : kind === 'sao' ? D.SAO[id] : D.PACK;
  const texOf = (kind, id) => kind === 'qn' ? A.quyNhan(id) : kind === 'que' ? A.que(id) : kind === 'sao' ? A.sao(id) : A.pack(false);
  const RC = { thuong: PAL.giayDo, hiem: PAL.menLam, quy: PAL.vangKim, bau: TL.CFG.BAU.AURA[1] };
  const statsOf = (type, lv) => { const b = CFG.BASE[type], g = CFG.SAO_GAIN[type]; return { diem: b.diem + (lv - 1) * g.diem, the: b.the + (lv - 1) * g.the }; };
  const sellValue = (kind, id) => Math.floor((kind === 'que' ? CFG.PRICE.QUE[id] : CFG.PRICE.QN[id]) * CFG.SHOP.SELL_RATIO);

  let run, items, ownS, queS, shopS, fly, sel, btns, cv, L, key, lvl, note, noteTok = 0, bauSeen = -1, humAt = -1, menuDown = false, menuHov = false, pk = null;

  const freeQn = () => { for (let i = 0; i < (run.qnMax || CFG.SHOP.QN_SLOTS); i++) if (!run.qn[i]) return i; return -1; }, freeQue = () => run.que.indexOf(null);
  const rerollCost = () => CFG.SHOP.REROLL_BASE + CFG.SHOP.REROLL_STEP * run.shop.rerolls;
  function why(i) {
    const it = items[i]; if (!it || it.sold) return 'sold';
    if ((it.kind === 'qn' && freeQn() < 0) || (it.kind === 'que' && freeQue() < 0) || (it.kind === 'pack' && freeQn() < 0 && freeQue() < 0)) return 'slots';
    return run.money < it.price ? 'money' : null;
  }
  const say = (m, s) => { note = m; const t = ++noteTok; FX.after(s || 2.2, () => { if (noteTok === t) note = null; }); };

  // ---------------------------------------------------------------- layout
  function lay() {
    const g = G(), w = g.w, h = g.h, sf = g.safe, dpr = g.dpr, k = [w, h, dpr, sf.t, sf.r, sf.b, sf.l].join();
    if (k === key) return false; key = k;
    const X0 = sf.l + 8, X1 = w - sf.r - 8, Y0 = sf.t + 6, Y1 = h - sf.b - 8, u = base(), gap = Math.max(6, Math.round(u * 0.5)), o = { u: u, gap: gap };
    o.menu = menuRect(); o.bar = { x: X0, y: Y0, w: X1 - X0, h: 44 };
    const wide = (X1 - X0) / (Y1 - Y0) > 1.25, btnH = 48, labelH = Math.round(u * 1.3), tagH = Math.round(u * 1.3) + 32, top = Y0 + 44 + gap;
    const colW = wide ? Math.round((X1 - X0) * 0.6) : X1 - X0, infoMin = Math.round(u * 5.5), cols = wide ? 6 : 3, rowsB = 6 / cols, lift = 14;
    const availH = wide ? Y1 - top : Y1 - top - infoMin - btnH * 2 - gap * 4;
    const us = cw => Math.max(1, Math.floor((cw / 48) * dpr + 1e-6)), ssMax = us((colW - (cols - 1) * gap) / cols), soMax = us((colW - 8 * gap) / 7);
    const need = (ss, so) => labelH * 2 + lift * 2 + (64 * so) / dpr + rowsB * ((64 * ss) / dpr + tagH) + (rowsB - 1) * gap + gap * 3;
    let ss = ssMax, so = Math.min(ss, soMax);
    outer: for (; ss >= 1; ss--) for (so = Math.min(ss, soMax); so >= 1; so--) if (need(ss, so) <= availH) break outer;
    if (ss < 1) { ss = 1; so = 1; }
    o.shopScale = ss; o.ownScale = so; o.wide = wide;
    const sw = (48 * ss) / dpr, sh = (64 * ss) / dpr, ow = (48 * so) / dpr, oh = (64 * so) / dpr;
    const tot = need(ss, so);
    let y = wide ? top + Math.max(0, (Y1 - top - tot) / 2) : top;
    const cx0 = X0 + (colW - (7 * ow + 4 * gap + 2 * gap)) / 2;
    y += lift; o.labelA = Math.round(y); y += labelH + lift;
    o.own = [0, 1, 2, 3, 4].map(i => rr({ x: cx0 + i * (ow + gap), y: y, w: ow, h: oh }));
    o.que = [0, 1].map(i => rr({ x: cx0 + 5 * (ow + gap) + gap + i * (ow + gap), y: y, w: ow, h: oh }));
    y += oh + gap * 1.5;
    o.labelB = Math.round(y); y += labelH + lift;
    const sx = X0 + (colW - (cols * sw + (cols - 1) * gap)) / 2, y1 = y;
    o.card = [0, 1, 2, 3, 4, 5].map(i => rr({ x: sx + (i % cols) * (sw + gap), y: y1 + Math.floor(i / cols) * (sh + tagH + gap), w: sw, h: sh }));
    o.tag = o.card.map(c => ({ x: c.x - 2, y: c.y + c.h + 4, w: c.w + 4, h: tagH - 4 }));
    y += rowsB * (sh + tagH) + (rowsB - 1) * gap + gap;
    o.btnH = btnH;
    if (wide) {
      const rx = X0 + colW + gap * 2, rw = X1 - rx, bw = Math.min(rw, 380), bx = rx + (rw - bw) / 2, bTot = 4 * btnH + 3 * 8;
      o.info = rr({ x: rx, y: top, w: rw, h: Y1 - top - bTot - gap });
      o.slots = [0, 1, 2, 3].map(i => rr({ x: bx, y: Y1 - bTot + i * (btnH + 8), w: bw, h: btnH }));
      o.slotsFull = o.slots;
    } else {
      const bw = Math.floor((X1 - X0 - gap) / 2), by = Y1 - 2 * btnH - 8;
      o.info = rr({ x: X0, y: y, w: X1 - X0, h: Math.max(infoMin, by - gap - y) });
      o.slots = [rr({ x: X0, y: by, w: bw, h: btnH }), rr({ x: X0 + bw + gap, y: by, w: bw, h: btnH }), rr({ x: X0, y: by + btnH + 8, w: bw, h: btnH }), rr({ x: X0 + bw + gap, y: by + btnH + 8, w: bw, h: btnH })];
      o.slotsFull = [o.slots[0], o.slots[1], o.slots[2], rr({ x: X0, y: by + btnH + 8, w: X1 - X0, h: btnH })];
    }
    o.lixi = { x: X0 + 4, y: Y0 + 6 }; o.dealFrom = { x: o.slots[1].x + o.slots[1].w / 2, y: o.slots[1].y };
    // pack overlay
    const pcw = Math.min((w - 24) / 3.3, (h * 0.4 * 48) / 64), ps = us(pcw), pw = (48 * ps) / dpr, ph = (64 * ps) / dpr;
    o.pkScale = ps; o.pkCards = { x: w / 2 - (3 * pw + 2 * gap) / 2, y: Math.max(Y0 + 44 + gap + 36, h * 0.3 - ph / 2), w: 3 * pw + 2 * gap, h: ph };
    const pyb = o.pkCards.y + ph + gap * 2, pbw = Math.min(190, (w - 24 - gap) / 2);
    o.pkInfo = rr({ x: Math.max(X0, w / 2 - 230), y: pyb, w: Math.min(460, X1 - X0), h: Math.max(infoMin, Math.min(Y1 - btnH - gap * 2 - pyb, u * 8)) });
    o.pkBtn = [rr({ x: w / 2 - pbw - gap / 2, y: Math.min(Y1 - btnH, o.pkInfo.y + o.pkInfo.h + gap), w: pbw, h: btnH }), rr({ x: w / 2 + gap / 2, y: Math.min(Y1 - btnH, o.pkInfo.y + o.pkInfo.h + gap), w: pbw, h: btnH })];
    o.pkCenter = { x: w / 2, y: o.pkCards.y + ph / 2 };
    L = o; return true;
  }
  function place(s, rect, scale) { const c = ctr(rect); s.scale = scale; s.T.x = s.V.x = c.x; s.T.y = s.V.y = c.y; s._sp.x.x = c.x; s._sp.y.x = c.y; }
  function mkOwn(i) { const q = run.qn[i]; if (!q) return null; const s = SP.create({ tex: A.quyNhan(q.id), scale: L.ownScale }); s.sway = false; place(s, L.own[i], L.ownScale); return s; }
  function mkQue(i) { const q = run.que[i]; if (!q) return null; const s = SP.create({ tex: A.que(q), scale: L.ownScale }); s.sway = false; place(s, L.que[i], L.ownScale); return s; }
  function mkShop(i) { const it = items[i]; if (it.sold) return null; const s = SP.create({ tex: texOf(it.kind, it.id), scale: L.shopScale }); place(s, L.card[i], L.shopScale); return s; }
  function build() { ownS = run.qn.map((q, i) => mkOwn(i)); queS = run.que.map((q, i) => mkQue(i)); shopS = items.map((it, i) => mkShop(i)); }
  function relayout() {
    ownS.forEach((s, i) => { if (s) place(s, L.own[i], L.ownScale); }); queS.forEach((s, i) => { if (s) place(s, L.que[i], L.ownScale); }); shopS.forEach((s, i) => { if (s) place(s, L.card[i], L.shopScale); });
    if (pk) relayoutPack();
  }

  // ---------------------------------------------------------------- buttons
  function mainLabel() {
    if (!sel) return T.shop.buy;
    if (sel.z === 'shop') return items[sel.i].kind === 'pack' ? T.shop.open : T.shop.buy;
    return sel.z === 'que' ? T.shop.use : T.shop.sell;
  }
  function buildBtns() {
    if (pk) { btns.list = [{ id: 'choose', label: T.btn.chon, r: L.pkBtn[0], on: pk.phase === 'pick' && pk.sel != null }, { id: 'skip', label: T.pack.skip, r: L.pkBtn[1], on: pk.phase === 'pick' }]; return; }
    const hasSel = !!sel && (sel.z === 'shop' ? !!shopS[sel.i] : sel.z === 'own' ? !!run.qn[sel.i] : !!run.que[sel.i]);
    const canHold = hasSel && sel.z === 'shop' && run.perk && run.perk.giu && items[sel.i] && items[sel.i].kind !== 'pack' && !items[sel.i].sold, sell2 = hasSel && (sel.z === 'que' || canHold), S = sell2 ? L.slots : L.slotsFull;
    btns.list = [
      { id: 'buy', label: mainLabel(), r: S[0], on: hasSel && (sel.z !== 'shop' || !why(sel.i)) },
      { id: 'reroll', label: T.shop.reroll + ' · ' + rerollCost(), r: S[1], on: run.money >= rerollCost() },
    ].concat(sell2 ? [canHold ? { id: 'hold', label: items[sel.i].keep ? D.TEXT.modes.unhold : D.TEXT.modes.hold, r: S[2] } : { id: 'sell', label: T.shop.sell, r: S[2] }] : [], [{ id: 'next', label: T.shop.next, r: sell2 ? S[3] : S[2], on: true }]);
  }

  // ---------------------------------------------------------------- flow
  function enter(args) {
    const g = G(); run = (args && args.run) || g.run; g.run = run;
    FX.reset(); if (TL.BG) TL.BG.setMood('shop');
    items = TL.Run.shop(run); cv = { lixi: run.money }; sel = null; lvl = null; fly = []; btns = Btns(); key = ''; note = null; menuDown = false; pk = null;
    lay(); build(); buildBtns(); saveRun(run); bauIntro();
    if (TL.Tutorial && !g.flags.auto) TL.Tutorial.onShop();
    shopS.forEach((s, i) => { if (s) s.deal({ x: L.dealFrom.x, y: L.dealFrom.y }, 0.1 + i * 0.08, texOf(items[i].kind, items[i].id)); });
    snd('shuffle');
    if (run.pack) resumePack();
    if (g.flags.auto) auto();
  }
  function auto() {
    const q = FX.queue;
    items.forEach((it, i) => { q.add(() => { if (!why(i)) { doBuy(i); return 0.6; } return 0; }, 0.3); q.wait(() => !pk); });
    q.add(() => { go(); return 0; }, 0.4);
  }
  function setMoney(delta, at) {
    FX.counter(cv, 'lixi', run.money, 0.5);
    if (delta) { const p = at || { x: L.lixi.x + 60, y: L.lixi.y + 40 }; FX.popup((delta > 0 ? '+' : '') + delta, p.x, p.y, delta > 0 ? 'gold' : 'bad'); }
  }
  function unselect() { [].concat(ownS, queS, shopS).forEach(s => { if (s) s.selected = false; }); sel = null; }
  function flyTo(s, rect, scale, then) {
    if (!s) return;
    const c = ctr(rect); fly.push(s); s.sway = false; s.T.sx = s.T.sy = scale / s.scale; s.moveTo(c.x, c.y, 0.45); s.juice(0.8);
    FX.after(0.55, () => { fly = fly.filter(f => f !== s); then(); });
  }
  function toSlot(kind, id) {
    if (kind === 'qn') { const slot = run.qn.findIndex(q => q && q.id === id); return { rect: L.own[slot], mk: () => { const n = mkOwn(slot); if (n) { ownS[slot] = n; n.juice(1); snd('place'); } } }; }
    const slot = run.que.indexOf(id); return { rect: L.que[slot], mk: () => { const n = mkQue(slot); if (n) { queS[slot] = n; n.juice(1); snd('place'); } } };
  }
  function doBuy(i) {
    const it = items[i], s = shopS[i], w = why(i);
    if (w) { say(w === 'money' ? T.shop.poor : w === 'slots' ? T.shop.full : T.shop.sold); return false; }
    if (it.kind === 'pack') { startPack(i); return true; }
    const before = it.kind === 'sao' ? run.sao[D.SAO[it.id].combo] : 0;
    const res = TL.Run.buy(run, i); if (!res.ok) return false;
    snd('buy'); snd('coin', { pitch: 0.8, vol: 0.6 }); setMoney(-it.price); unselect(); shopS[i] = null; lvl = null;
    if (s) s.selected = false;
    if (it.kind === 'sao') {
      const type = D.SAO[it.id].combo, lv = run.sao[type], a = statsOf(type, before), b = statsOf(type, lv);
      lvl = { name: D.SAO[it.id].name, combo: D.COMBO_NAME[type], from: before, to: lv, dv: a.diem, tv: a.the, type: type };
      FX.after(0.3, () => { FX.counter(lvl, 'dv', b.diem, 0.7); FX.counter(lvl, 'tv', b.the, 0.7); });
      FX.stamp(T.shop.level.replace('%d', lv), 'gold'); snd('mult');
      if (s) { fly.push(s); const c = ctr(L.info); s.T.sx = s.T.sy = 0.8; s.moveTo(c.x, c.y - L.info.h * 0.2, 0.4); FX.after(0.4, () => s.dissolve(0.7, () => { fly = fly.filter(f => f !== s); })); }
    } else { const d = toSlot(it.kind, it.id); flyTo(s, d.rect, L.ownScale, d.mk); }
    saveRun(run); return true;
  }
  function doSell(z, i) {
    const kind = z === 'que' ? 'que' : 'qn', id = kind === 'que' ? run.que[i] : run.qn[i] && run.qn[i].id; if (!id) return false;
    const v = sellValue(kind, id), s = kind === 'que' ? queS[i] : ownS[i];
    if (!(kind === 'que' ? TL.Run.sellQue(run, i) : TL.Run.sell(run, i)).ok) return false;
    snd('sell'); snd('dissolve', { vol: 0.7 }); setMoney(v); unselect(); lvl = null; if (kind === 'que') queS[i] = null; else ownS[i] = null;
    if (s) { fly.push(s); s.dissolve(0.7, () => { fly = fly.filter(f => f !== s); }); }
    saveRun(run); return true;
  }
  function doUse(i) {
    const id = run.que[i], s = queS[i], before = JSON.stringify(run.sao); if (!id) return false;
    const res = TL.Run.useQue(run, null, i, []);
    if (!res.ok) { say(res.msg); snd('button'); return false; }
    unselect(); queS[i] = null; if (s) { fly.push(s); s.dissolve(0.7, () => { fly = fly.filter(f => f !== s); }); }
    const e = res.events[0];
    if (e.lixi) { setMoney(e.lixi); snd('coin'); } else if (e.sao) { snd('mult'); FX.stamp(T.que.gotSao.replace('%s', D.COMBO_NAME[e.sao]), 'gold'); }
    saveRun(run); return true;
  }
  function doReroll() {
    const r = TL.Run.reroll(run); if (!r.ok) { say(T.shop.poor); return; }
    snd('shuffle'); setMoney(0); unselect(); lvl = null; items = TL.Run.shop(run); shopS = items.map((it, i) => mkShop(i));
    shopS.forEach((s, i) => { if (s) s.deal({ x: L.dealFrom.x, y: L.dealFrom.y }, 0.05 + i * 0.08, texOf(items[i].kind, items[i].id)); });
    saveRun(run);
  }
  function go() {
    if (pk) return;
    const g = G(), r = TL.Run.nextBan(run);
    if (r === 'won') { clearSave(); g.setScreen('end', { result: 'won', run: run }); return; }
    saveRun(run); g.setScreen('table');
  }
  function act(id) {
    if (id === 'choose') return chooseCard();
    if (id === 'skip') return skipPack();
    if (pk) return;
    if (id === 'buy') { if (!sel) return; if (sel.z === 'shop') doBuy(sel.i); else if (sel.z === 'que') doUse(sel.i); else doSell('own', sel.i); }
    else if (id === 'sell') { if (sel && sel.z === 'que') doSell('que', sel.i); }
    else if (id === 'hold') { if (sel && sel.z === 'shop') { const r = TL.Run.hold(run, sel.i); if (r.ok) { snd('place'); saveRun(run); buildBtns(); } } }
    else if (id === 'reroll') doReroll();
    else if (id === 'next') go();
  }

  // ---------------------------------------------------------------- Bao lì xì
  function startPack(i) {
    const it = items[i], s = shopS[i], res = TL.Run.openPack(run, i);
    if (!res.ok) { say(res.why === 'money' ? T.shop.poor : T.shop.full); return; }
    snd('buy'); snd('coin', { pitch: 0.8, vol: 0.6 }); setMoney(-it.price); unselect(); shopS[i] = null; lvl = null;
    if (s) s.selected = false;
    const env = s || SP.create({ tex: A.pack(false), scale: L.shopScale, x: L.card[i].x, y: L.card[i].y });
    pk = { phase: 'open', env: env, cards: [], choices: res.choices, sel: null };
    saveRun(run);
    const c = L.pkCenter; env.sway = false; env.T.sx = env.T.sy = L.pkScale / env.scale; env.moveTo(c.x, c.y, 0.4);
    FX.after(0.5, () => { snd('shuffle'); for (let k = 0; k < 7; k++) FX.after(k * 0.07, () => { env.T.rot = k === 6 ? 0 : (k % 2 ? 1 : -1) * (5 + k); env.juice(0.3); }); });
    FX.after(1.15, () => { env.flip(A.pack(true)); env.juice(1.1); snd('stamp'); FX.confetti(c.x, c.y - 20, 22); });
    FX.after(1.55, () => { snd('deal'); fanOut(true); FX.after(0.6, () => env.dissolve(0.6, () => {})); });
  }
  function resumePack() {
    pk = { phase: 'open', env: null, cards: [], choices: run.pack.choices.map(c => Object.assign({}, c)), sel: null };
    FX.after(0.2, () => fanOut(false));
  }
  function fanOut(fromEnv) {
    const from = L.pkCenter;
    pk.cards = pk.choices.map(c => { const s = SP.create({ tex: A.back(), x: from.x, y: from.y, scale: L.pkScale }); s.sway = false; s.kind = c.kind; s.cid = c.id; return s; });
    SP.fan(pk.cards, L.pkCards, { overlap: 0.08, curve: 0.2, dur: 0.45 });
    pk.cards.forEach((s, k) => FX.after(0.5 + k * 0.2, () => { s.flip(texOf(s.kind, s.cid), 0); snd('flip'); }));
    FX.after(0.5 + pk.cards.length * 0.2 + 0.4, () => {
      pk.phase = 'pick'; if (G().flags.auto) FX.after(0.3, () => { pk.sel = 0; chooseCard(); });
    });
  }
  function relayoutPack() {
    if (pk.cards.length) { SP.fan(pk.cards, L.pkCards, { overlap: 0.08, curve: 0.2 }); pk.cards.forEach(s => { s.scale = L.pkScale; }); }
  }
  function selectCard(k) { pk.cards.forEach((s, j) => { s.selected = j === k; }); pk.sel = k; snd('select'); }
  function chooseCard() {
    if (!pk || pk.phase !== 'pick' || pk.sel == null) return;
    const k = pk.sel, ch = pk.choices[k], res = TL.Run.choosePack(run, k);
    if (!res.ok) { say(T.shop.full); return; }
    pk.phase = 'done'; const picked = pk.cards[k], others = pk.cards.filter((s, j) => j !== k);
    snd('buy'); others.forEach(s => { fly.push(s); s.dissolve(0.6, () => { fly = fly.filter(f => f !== s); }); });
    picked.selected = false; const d = toSlot(ch.kind, ch.id); pk = null; saveRun(run);
    flyTo(picked, d.rect, L.ownScale, d.mk);
  }
  function skipPack() {
    if (!pk || pk.phase !== 'pick') return;
    TL.Run.choosePack(run, -1); const cs = pk.cards; pk = null; snd('sell');
    cs.forEach(s => { s.selected = false; fly.push(s); s.dissolve(0.6, () => { fly = fly.filter(f => f !== s); }); }); saveRun(run);
  }

  // ---------------------------------------------------------------- selection helpers
  const order = () => {   // keyboard order: owned, Quẻ, for sale
    const l = []; run.qn.forEach((q, i) => { if (q) l.push({ z: 'own', i: i }); }); run.que.forEach((q, i) => { if (q) l.push({ z: 'que', i: i }); });
    items.forEach((it, i) => { if (!it.sold) l.push({ z: 'shop', i: i }); }); return l;
  };
  function choose(p) {
    unselect(); lvl = null; if (!p) return;
    sel = { z: p.z, i: p.i }; const s = (p.z === 'shop' ? shopS : p.z === 'que' ? queS : ownS)[p.i]; if (s) s.selected = true; snd('select');
  }
  function pick(x, y) {
    let s = SP.pick(shopS.filter(Boolean), x, y); if (s) return { z: 'shop', i: shopS.indexOf(s) };
    s = SP.pick(ownS.filter(Boolean), x, y); if (s) return { z: 'own', i: ownS.indexOf(s) };
    s = SP.pick(queS.filter(Boolean), x, y); if (s) return { z: 'que', i: queS.indexOf(s) };
    return null;
  }

  // ---------------------------------------------------------------- update / draw
  function update(dt) {
    if (lay()) relayout();
    [].concat(ownS, queS, shopS, fly, pk ? pk.cards : [], pk && pk.env ? [pk.env] : []).forEach(s => { if (s) s.update(dt); });
    buildBtns();
  }
  function diamond(ctx, cx, cy, r, fill) {
    ctx.save(); ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = PAL.denSon; ctx.stroke(); ctx.restore();
  }
  function mark(ctx, rect, rarity) { if (rarity === 'thuong') return; diamond(ctx, rect.x + rect.w - 9, rect.y + 9, 7, RC[rarity]); }
  function tag(ctx, i) {
    const it = items[i], r = L.tag[i], d = data(it.kind, it.id);
    if (it.sold) return;
    const ns = fit(d.name, L.u, r.w, 9);
    txt(ctx, d.name, r.x + r.w / 2, r.y, ns, PAL.giayDo, 'center');
    const ok = !why(i) || run.money >= it.price, pw = Math.min(r.w, 92), ph = 28, px = r.x + (r.w - pw) / 2, py = r.y + Math.round(ns * 1.3) + 2;
    A.panel(ctx, { x: px, y: py, w: pw, h: ph }, { fill: ok ? PAL.nauCanhGian : PAL.denSon, border: ok ? PAL.vangKim : PAL.nauCanhGian, radius: 3 });
    ctx.save(); if (!ok) ctx.globalAlpha = 0.55;
    drawIcon(ctx, 'lixi', px + 6, py + 6, 1); txt(ctx, String(it.price), px + pw - 8, py + 5, 17, ok ? PAL.vangKim : PAL.giayDo, 'right');
    ctx.restore();
  }
  function chip(ctx, rarity, x, y) {
    const lab = T.rarity[rarity], c = rarity === 'bau' ? { fill: TL.CFG.BAU.AURA[0], ink: PAL.giayDo } : rarity === 'quy' ? { fill: PAL.vangKim, ink: PAL.denSon } : rarity === 'hiem' ? { fill: PAL.menLam, ink: PAL.giayDo } : { fill: PAL.denSon, ink: PAL.giayDo };
    A.badge(ctx, lab, x, y, { size: Math.max(11, L.u - 2), fill: c.fill, ink: c.ink, anchor: 'center' });
  }
  function infoText(ctx, rect, o) {   // o = {head, rarity, lines:[[text, color]]}
    const u = L.u, pad = 10, ww = rect.w - pad * 2; let y = rect.y + pad;
    const sz = fit(o.head, u + 3, ww - (o.rarity ? 70 : 0), 11); txt(ctx, o.head, rect.x + pad, y, sz, PAL.vangKim, 'left');
    if (o.rarity) chip(ctx, o.rarity, rect.x + rect.w - pad - 30, y + sz * 0.6);
    y += Math.round(sz * 1.5);
    o.lines.forEach(l => wrap(l[0], u, ww).forEach(t => { if (y + u < rect.y + rect.h - 2) txt(ctx, t, rect.x + pad, y, u, l[1] || PAL.giayDo, 'left'); y += Math.round(u * 1.3); }));
  }
  function describe(kind, id, extra) {
    const d = data(kind, id), lines = [[d.desc]]; if (d.quote) lines.push(['“' + d.quote + '”', PAL.laXanh]);
    return { head: d.name, rarity: kind === 'sao' ? null : d.rarity, lines: lines.concat(extra || []) };
  }
  function infoPanel(ctx, rect) {
    if (pk) { const c = pk.sel != null ? pk.choices[pk.sel] : null; return infoText(ctx, rect, c ? describe(c.kind, c.id) : { head: T.pack.title, lines: [[T.pack.pick]] }); }
    if (lvl) {
      return infoText(ctx, rect, { head: lvl.name + ' · ' + lvl.combo, lines: [[T.shop.level.replace('%d', lvl.from) + ' → ' + T.shop.level.replace('%d', lvl.to)], [T.hud.diem + ' ' + fmt(Math.round(lvl.dv)) + '  ×  ' + T.hud.the + ' ' + fmt(Math.round(lvl.tv)), PAL.vangKim]] });
    }
    if (!sel) return infoText(ctx, rect, { head: T.shop.title, lines: [[T.shop.slots.replace('%d', run.qn.filter(Boolean).length).replace('%d', CFG.SHOP.QN_SLOTS) + ' · ' + T.shop.queSlots.replace('%d', run.que.filter(Boolean).length).replace('%d', CFG.SHOP.QUE_SLOTS)], [T.shop.hint]] });
    if (sel.z === 'shop') {
      const it = items[sel.i]; let ex = [];
      if (it.kind === 'sao') { const d = D.SAO[it.id], lv = run.sao[d.combo], a = statsOf(d.combo, lv), b = statsOf(d.combo, lv + 1); ex = [[T.shop.level.replace('%d', lv) + ' → ' + T.shop.level.replace('%d', lv + 1) + ' · ' + a.diem + '×' + a.the + ' → ' + b.diem + '×' + b.the, PAL.vangKim]]; }
      const w = why(sel.i); if (w) ex.push([w === 'money' ? T.shop.poor : w === 'slots' ? T.shop.full : T.shop.sold, PAL.giayDo]);
      return infoText(ctx, rect, describe(it.kind, it.id, ex));
    }
    const kind = sel.z === 'que' ? 'que' : 'qn', id = kind === 'que' ? run.que[sel.i] : run.qn[sel.i] && run.qn[sel.i].id; if (!id) return;
    infoText(ctx, rect, describe(kind, id, [[T.shop.sellFor.replace('%d', sellValue(kind, id)), PAL.vangKim]]));
  }
  const isBau = id => D.QUY_NHAN[id] && D.QUY_NHAN[id].rarity === 'bau';
  function auras(ctx) {   // Báu vật: flat purple pixel fire around the card, only for qn slots / offers that are still there
    const t = Date.now() / 1000, px = Math.max(2, Math.round(L.u / 4));
    items.forEach((it, i) => { if (!it.sold && shopS[i] && it.kind === 'qn' && isBau(it.id)) { const r = L.card[i]; TL.Art.aura(ctx, r.x, r.y, r.w, r.h, t, px); } });
    run.qn.forEach((q, i) => { if (q && ownS[i] && isBau(q.id)) { const r = L.own[i]; TL.Art.aura(ctx, r.x, r.y, r.w, r.h, t, px); } });
  }
  function bauIntro() {   // a Báu vật in the offers: its cell shakes and the stamp slams down once per shop
    const i = items.findIndex(it => it.kind === 'qn' && !it.sold && isBau(it.id));
    if (i < 0 || bauSeen === run.shop.n) return; bauSeen = run.shop.n;
    setTimeout(() => { if (shopS[i]) shopS[i].juice(1.6); FX.stamp(T.stamp.bauVat, 'gold'); snd('stamp'); }, 450);
  }
  function draw(ctx) {
    lay();
    const u = L.u, B = L.bar, g = G();
    A.panel(ctx, { x: B.x, y: B.y, w: B.w - 52, h: 44 }, { fill: PAL.nauCanhGian, border: PAL.vangKim, radius: 4 });
    drawIcon(ctx, 'lixi', L.lixi.x + 2, L.lixi.y + 2, 2); txt(ctx, fmt(Math.round(cv.lixi)), L.lixi.x + 40, B.y + 8, 24, PAL.vangKim, 'left');
    txt(ctx, T.shop.title, B.x + (B.w - 52) / 2, B.y + 5, fit(T.shop.title, 30, B.w - 52 - 150, 16), PAL.vangKim, 'center');
    A.button(ctx, L.menu, '', menuDown ? 'down' : menuHov ? 'hover' : 'idle'); drawIcon(ctx, 'menu', L.menu.x + L.menu.w / 2 - 16, L.menu.y + (L.menu.h - 4) / 2 - 16 + (menuDown ? 2 : 1), 2);
    txt(ctx, T.shop.slots.replace('%d', run.qn.filter(Boolean).length).replace('%d', CFG.SHOP.QN_SLOTS), L.own[0].x, L.labelA, u, PAL.giayDo, 'left');
    txt(ctx, T.shop.queSlots.replace('%d', run.que.filter(Boolean).length).replace('%d', CFG.SHOP.QUE_SLOTS), L.que[0].x, L.labelA, u, PAL.giayDo, 'left');
    txt(ctx, T.shop.forSale, L.card[0].x, L.labelB, u, PAL.giayDo, 'left');
    L.own.concat(L.que).forEach(r => A.panel(ctx, r, { fill: PAL.denSon, border: PAL.nauCanhGian, shadow: null, radius: 3 }));
    for (let i = run.qnMax || CFG.SHOP.QN_SLOTS; i < CFG.SHOP.QN_SLOTS; i++) { const r = L.own[i]; ctx.save(); ctx.globalAlpha = 0.6; ctx.fillStyle = PAL.denSon; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.restore(); txt(ctx, D.TEXT.modes.lock, r.x + r.w / 2, r.y + r.h / 2 - 8, fit(D.TEXT.modes.lock, u, r.w - 6, 9), PAL.giayDo, 'center'); }
    L.card.forEach((r, i) => { if (items[i].sold || !shopS[i]) { A.panel(ctx, r, { fill: PAL.denSon, border: PAL.nauCanhGian, shadow: null, radius: 3 }); if (items[i].sold) txt(ctx, T.shop.sold, r.x + r.w / 2, r.y + r.h / 2 - 8, fit(T.shop.sold, u, r.w - 6, 9), PAL.giayDo, 'center'); } });
    if (sel && !pk) { const r = sel.z === 'shop' ? L.card[sel.i] : sel.z === 'que' ? L.que[sel.i] : L.own[sel.i]; if (r) A.panel(ctx, { x: r.x - 4, y: r.y - 4 - 16, w: r.w + 8, h: r.h + 8 + 16 }, { fill: PAL.denSon, border: PAL.vangKim, shadow: null, radius: 4 }); }
    auras(ctx);
    SP.drawAll(ctx, ownS.filter(Boolean)); SP.drawAll(ctx, queS.filter(Boolean)); SP.drawAll(ctx, shopS.filter(Boolean));
    shopS.forEach((s, i) => { if (!s || items[i].sold) return; if (why(i)) { const sz = s.size(); ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = PAL.denSon; ctx.fillRect(Math.round(s.V.x - sz.w / 2), Math.round(s.V.y - sz.h / 2), Math.round(sz.w), Math.round(sz.h)); ctx.restore(); } });
    items.forEach((it, i) => { if (!it.sold && shopS[i] && (it.kind === 'qn' || it.kind === 'que')) mark(ctx, L.card[i], data(it.kind, it.id).rarity); });
    run.qn.forEach((q, i) => { if (q) mark(ctx, L.own[i], D.QUY_NHAN[q.id].rarity); }); run.que.forEach((q, i) => { if (q) mark(ctx, L.que[i], D.QUE[q].rarity); });
    items.forEach((it, i) => tag(ctx, i));
    if (!pk) { A.panel(ctx, L.info, { fill: PAL.nauCanhGian, border: PAL.vangKim, radius: 5 }); infoPanel(ctx, L.info); if (note) txt(ctx, note, L.info.x + L.info.w - 10, L.info.y + L.info.h - u * 1.5 - 4, u, PAL.vangKim, 'right'); }
    if (pk) {
      ctx.save(); ctx.globalAlpha = 0.86; ctx.fillStyle = PAL.denSon; ctx.fillRect(0, L.bar.y + 52, g.w, g.h); ctx.restore();
      txt(ctx, T.pack.title, g.w / 2, L.bar.y + 54, fit(T.pack.title, 28, g.w - 40, 16), PAL.vangKim, 'center');
      if (pk.env) SP.drawAll(ctx, [pk.env]);
      SP.drawAll(ctx, pk.cards);
      pk.cards.forEach((s, k) => { if (pk.phase === 'pick' && s.tex !== A.back()) { const c = pk.choices[k], d = data(c.kind, c.id); mark(ctx, { x: s.V.x - s.size().w / 2, y: s.V.y - s.size().h / 2, w: s.size().w, h: s.size().h }, d.rarity); } });
      if (pk.phase === 'pick') { A.panel(ctx, L.pkInfo, { fill: PAL.nauCanhGian, border: PAL.vangKim, radius: 5 }); infoPanel(ctx, L.pkInfo); }
      if (note) txt(ctx, note, g.w / 2, L.pkInfo.y - u * 1.6, u, PAL.vangKim, 'center');
    }
    btns.draw(ctx);
    SP.drawAll(ctx, fly);
  }
  function tutRects() {
    if (!L || !items) return null;
    const cards = kind => L.card.filter((c, i) => items[i] && items[i].kind === kind);
    return { qn: [{ x: L.own[0].x - 4, y: L.own[0].y - 4, w: L.own[4].x + L.own[4].w - L.own[0].x + 8, h: L.own[0].h + 8 }].concat(cards('qn')), sao: cards('sao'), lixi: [{ x: L.bar.x, y: L.bar.y, w: Math.min(170, L.bar.w), h: L.bar.h }] };
  }
  function pointer(e) {
    if (e.type === 'move') {
      menuHov = inR(L.menu, e.x, e.y); btns.pointer(e);
      SP.hover(pk ? pk.cards : [].concat(ownS, queS, shopS).filter(Boolean), e.x, e.y);
      if (!pk) { let h = -1; items.forEach((it, i) => { if (!it.sold && it.kind === 'qn' && isBau(it.id) && inR(L.card[i], e.x, e.y)) h = i; }); run.qn.forEach((q, i) => { if (q && isBau(q.id) && inR(L.own[i], e.x, e.y)) h = 100 + i; }); if (h >= 0 && h !== humAt) snd('hum'); humAt = h; }
      return;
    }
    if (e.type === 'down') {
      if (inR(L.menu, e.x, e.y)) { menuDown = true; snd('button'); return; }
      if (pk && pk.phase !== 'pick' && TL.FX.skipTap()) return;   // pack opening: tap fast-forwards
      if (btns.pointer(e)) return;
      if (pk) { if (pk.phase === 'pick') { const s = SP.pick(pk.cards, e.x, e.y); if (s) { const k = pk.cards.indexOf(s); if (pk.sel === k) chooseCard(); else selectCard(k); } } return; }
      const p = pick(e.x, e.y);
      if (p) { const same = sel && sel.z === p.z && sel.i === p.i; if (same) unselect(); else choose(p); return; }
      if (inR(L.info, e.x, e.y)) return;
      unselect(); return;
    }
    if (e.type === 'up') {
      if (menuDown) { menuDown = false; if (inR(L.menu, e.x, e.y)) G().setScreen('settings'); return; }
      btns.pointer(e, act);
    }
  }
  function key_(e) {
    if (e.key === 'esc') return G().setScreen('settings');
    if (pk) {
      if (pk.phase !== 'pick') { if (e.key === 'enter' || e.key === 'space') TL.FX.skipTap(); return; }
      if (e.key === 'left' || e.key === 'right') { const n = pk.cards.length, k = pk.sel == null ? (e.key === 'right' ? 0 : n - 1) : (pk.sel + (e.key === 'right' ? 1 : n - 1)) % n; selectCard(k); }
      else if (e.key === 'enter') chooseCard(); else if (e.key === 'space') skipPack();
      return;
    }
    if (e.key === 'enter') return act('buy');
    if (e.key === 'space') return act('next');
    const l = order(); if (!l.length) return;
    const cur = sel ? l.findIndex(p => p.z === sel.z && p.i === sel.i) : -1;
    if (e.key === 'right' || e.key === 'down') choose(l[(cur + 1) % l.length]);
    else if (e.key === 'left' || e.key === 'up') choose(l[(cur < 0 ? 0 : cur + l.length - 1) % l.length]);
  }

  TL.Screens.shop = { enter: enter, exit() {}, resize() { key = ''; }, update: update, draw: draw, pointer: pointer, key: key_, tutRects: tutRects, _rects: () => L };
})(globalThis.TL = globalThis.TL || {});
