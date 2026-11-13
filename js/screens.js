/* js/screens.js  (owner SCREENS) title, shop (Chợ Tết), end, settings overlay. Needs everything before it in the script order.
 * API  TL.Screens.{title, shop, end, settings}  each = Screen {enter(args), exit(), resize(), update(dt), draw(ctx), pointer(e), key(e)}
 *   title    BG mood title; big "CHIẾU TRÊN" over swaying fanned cards; Chơi mới, Chơi tiếp (only with a valid save), Cài đặt. ?auto skips to the table.
 *   shop     enter({run}) after the payout (scene.js): Run.shop items as card sprites with price tags; select -> desc; Mua / Bán / Đổi hàng / Đi tiếp.
 *            Saves with Run.save on entry and after every change. ?auto buys what it can and continues.
 *   end      enter({result:'won'|'lost', run}); stats; Chơi lại. Clears the save.
 *   settings overlay (Game.setScreen('settings')); Âm thanh, Tốc độ 1×/2×/3×, Scanlines, Giảm chuyển động, Về màn chính; Esc or tap outside closes.
 * Every screen has a menu button (top right) that opens settings. Text goes through TL.Art.text; buttons through TL.Art.button.
 * Motion: sprites spring/hover/tilt (sprite.js), counters + popups + stamps + dissolve + confetti (fx.js); reduced motion removes the title bob.
 */
(function (TL) {
  'use strict';
  const CFG = TL.CFG, D = TL.DATA, T = D.TEXT, PAL = CFG.PAL, FX = TL.FX, SP = TL.Sprite, A = TL.Art, fmt = TL.fmt;
  const G = () => TL.Game;
  const snd = (n, o) => { try { TL.Audio && TL.Audio.play(n, o); } catch (e) {} };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const inR = (b, x, y) => !!b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  const ctr = b => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
  const txt = (ctx, s, x, y, size, color, align, o) => A.text(ctx, s, x, y, Object.assign({ size: size, color: color || PAL.giayDo, align: align || 'left' }, o || {}));
  const fit = (s, size, maxW, min) => { while (size > (min || 9) && A.textWidth(s, size) > maxW) size--; return size; };
  const base = () => Math.round(clamp(Math.min(G().w, G().h) / 36, 12, 22));
  function wrap(s, size, maxW) {
    const out = []; let line = '';
    String(s).split(' ').forEach(w => { const t = line ? line + ' ' + w : w; if (line && A.textWidth(t, size) > maxW) { out.push(line); line = w; } else line = t; });
    if (line) out.push(line);
    return out;
  }
  const hasLocal = () => { try { return !!localStorage; } catch (e) { return false; } };
  const newSeed = () => (G().flags.seed != null ? G().flags.seed : undefined);
  const saveRun = run => { if (G().flags.auto || !run || run.phase === 'won' || run.phase === 'lost') return; try { localStorage.setItem(CFG.STORAGE.save, TL.Run.save(run)); } catch (e) {} };
  const clearSave = () => { try { localStorage.removeItem(CFG.STORAGE.save); } catch (e) {} };
  function readSave() {
    if (!hasLocal()) return null;
    try { const s = localStorage.getItem(CFG.STORAGE.save); if (!s) return null; const r = TL.Run.load(s); if (!r) clearSave(); return r; } catch (e) { return null; }
  }
  function drawIcon(ctx, name, x, y, k) { const c = A.icon(name); if (!c) return; ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(c, Math.round(x), Math.round(y), 16 * k, 16 * k); ctx.restore(); }

  // ---------------------------------------------------------------- button group (rect + label + state)
  function Btns() {
    const o = { list: [], hover: null, down: null };
    const hit = (x, y) => o.list.find(b => b.on !== false && inR(b.r, x, y)) || null;
    o.draw = ctx => o.list.forEach(b => {
      const st = b.on === false ? 'disabled' : o.down === b.id ? 'down' : (b.sel || (o.hover === b.id && !b.still)) ? 'hover' : 'idle';
      A.button(ctx, b.r, b.label, st);
    });
    o.pointer = (e, fn) => {
      if (e.type === 'move') { const b = hit(e.x, e.y); o.hover = b ? b.id : null; return false; }
      if (e.type === 'down') { const b = hit(e.x, e.y); o.down = b ? b.id : null; o.hover = o.down; if (b) snd('button'); return !!b; }
      if (e.type === 'up') { const b = hit(e.x, e.y), d = o.down; o.down = null; o.hover = null; if (b && d === b.id) { fn(b.id); return true; } }
      return false;
    };
    return o;
  }
  function menuBtn(ctx, rect, down, hover) {
    A.button(ctx, rect, '', down ? 'down' : hover ? 'hover' : 'idle');
    drawIcon(ctx, 'menu', rect.x + rect.w / 2 - 16, rect.y + (rect.h - 4) / 2 - 16 + (down ? 2 : 1), 2);
  }
  const menuRect = () => { const g = G(); return { x: g.w - g.safe.r - 8 - 44, y: g.safe.t + 6, w: 44, h: 44 }; };

  function fanCards(list, rect, dur) { SP.fan(list, rect, { overlap: 0.55, curve: 1.6, dur: dur }); }
  function cardScale(ch) { return Math.max(1, Math.floor(ch * G().dpr / 64 + 1e-6)); }

  // ================================================================ TITLE
  const Title = (() => {
    const TITLE = 'CHIẾU TRÊN';
    let cards = [], btns = Btns(), save = null, key = '', tt = 0, L = null, instant = false, menuDown = false, menuHov = false, maiDown = false, maiHov = false;
    const maiRect = () => { const m = menuRect(); return { x: m.x - 8 - 112, y: m.y, w: 112, h: 44 }; };
    function lay() {
      const g = G(), w = g.w, h = g.h, sf = g.safe, k = [w, h, g.dpr, !!save].join();
      if (k === key) return; key = k;
      const X0 = sf.l + 12, X1 = w - sf.r - 12, Y0 = sf.t + 12, Y1 = h - sf.b - 12, wide = (X1 - X0) / (Y1 - Y0) > 1.3;
      const n = save ? 3 : 2, zone = wide ? { x: X0, y: Y0, w: (X1 - X0) * 0.44, h: Y1 - Y0 } : { x: X0, y: Y0 + 44, w: X1 - X0, h: (Y1 - Y0) * 0.34 };
      const right = wide ? { x: X0 + (X1 - X0) * 0.46, y: Y0, w: (X1 - X0) * 0.54, h: Y1 - Y0 } : { x: X0, y: zone.y + zone.h, w: X1 - X0, h: Y1 - zone.y - zone.h };
      const bw = Math.min(300, right.w - 8), bh = clamp(Math.round(right.h * 0.13), 50, 60), gap = 10, bTot = n * bh + (n - 1) * gap;
      let ts = fit(TITLE, Math.min(wide ? 104 : 84, Math.round(right.h * 0.2)), right.w * 0.96, 24);
      const subS = clamp(Math.round(ts * 0.3), 14, 24), blockH = Math.round(ts * 1.25) + subS + 14 + 22 + bTot;
      const y0 = right.y + Math.max(0, (right.h - blockH) / 2), cx = right.x + right.w / 2;
      L = { ts: ts, subS: subS, cx: cx, titleY: y0, subY: y0 + Math.round(ts * 1.25) + 4 };
      const by = L.subY + subS + 14 + 22;
      const ids = save ? ['new', 'cont', 'set'] : ['new', 'set'], labels = { new: T.title.play, cont: T.title.cont, set: T.title.settings };
      btns.list = ids.map((id, i) => ({ id: id, label: labels[id], r: { x: Math.round(cx - bw / 2), y: Math.round(by + i * (bh + gap)), w: Math.round(bw), h: bh } }));
      const cw = Math.min(zone.h * 0.62, (zone.w * 0.95 / 2.8) * 64 / 48), sc = cardScale(cw);
      const ch = 64 * sc / g.dpr; L.zone = { x: zone.x, y: zone.y + zone.h / 2 - ch * 0.62, w: zone.w, h: ch * 1.05 };
      cards.forEach(s => { s.scale = sc; });
      if (cards.length) fanCards(cards, L.zone, instant ? 0 : 0.3);
    }
    function enter() {
      const g = G();
      if (g.flags.auto) { g.setScreen('table'); return; }
      FX.reset(); if (TL.BG) TL.BG.setMood('title');
      save = readSave(); key = ''; tt = 0; menuDown = false; btns = Btns();
      cards = [47, 48, 49, 50, 51].map(id => SP.create({ tex: A.back(), x: g.w / 2, y: g.h + 90, scale: 2 }));
      instant = true; lay(); instant = false;
      cards.forEach((s, i) => { s.deal({ x: L.zone.x + L.zone.w / 2, y: g.h + 90 }, 0.15 + i * 0.09, A.card(47 + i)); });
      FX.after(0.25, () => snd('shuffle'));
    }
    const newGame = () => { if (TL.Trans && TL.Screens.modes) TL.Trans.go('modes'); else { const g = G(); g.run = TL.Run.create(newSeed()); g.setScreen('table'); } };
    function cont() {
      const g = G(), r = readSave();
      if (!r) { save = null; key = ''; return; }
      g.run = r; g.setScreen('table');
    }
    function act(id) { if (id === 'new') newGame(); else if (id === 'cont') cont(); else if (id === 'set') G().setScreen('settings'); }
    function update(dt) { tt += dt; lay(); cards.forEach(s => s.update(dt)); }
    function draw(ctx) {
      lay();
      SP.drawAll(ctx, cards);
      const chars = Array.from(TITLE), full = A.textWidth(TITLE, L.ts), x0 = L.cx - full / 2, red = FX.reducedMotion;
      chars.forEach((c, i) => {
        if (c === ' ') return;
        const px = x0 + A.textWidth(chars.slice(0, i).join(''), L.ts), off = red ? 0 : Math.round(Math.sin(tt * 2.2 + i * 0.6) * Math.max(1, L.ts * 0.035));
        txt(ctx, c, px, L.titleY + off, L.ts, PAL.vangKim, 'left', { outline: PAL.denSon, shadow: PAL.doSon });
      });
      txt(ctx, T.game.sub, L.cx, L.subY, L.subS, PAL.giayDo, 'center');
      btns.draw(ctx);
      menuBtn(ctx, menuRect(), menuDown, menuHov);
      if (TL.Profile && TL.Screens.mai) {
        A.button(ctx, maiRect(), T.title.mai, maiDown ? 'down' : maiHov ? 'hover' : 'idle');
        const pr = TL.Profile.get(), b = pr.best;
        if (b > 0) { const lbl = D.TEXT.meta.chieu[b], r = maiRect(); A.badge(ctx, lbl, r.x + r.w / 2, r.y + r.h + 18, { size: 14, fill: PAL.doSon, edge: PAL.vangKim }); }
      }
    }
    function pointer(e) {
      if (e.type === 'move') { menuHov = inR(menuRect(), e.x, e.y); maiHov = inR(maiRect(), e.x, e.y); }
      if (e.type === 'down' && inR(menuRect(), e.x, e.y)) { menuDown = true; snd('button'); return; }
      if (e.type === 'down' && inR(maiRect(), e.x, e.y)) { maiDown = true; snd('button'); return; }
      if (e.type === 'up' && maiDown) { maiDown = false; if (inR(maiRect(), e.x, e.y)) TL.Trans.go('mai'); return; }
      if (e.type === 'up' && menuDown) { menuDown = false; if (inR(menuRect(), e.x, e.y)) G().setScreen('settings'); return; }
      btns.pointer(e, act);
    }
    function key_(e) { if (e.key === 'enter' || e.key === 'space') act(save ? 'cont' : 'new'); else if (e.key === 'esc') G().setScreen('settings'); }
    return { enter: enter, exit() {}, resize() { key = ''; }, update: update, draw: draw, pointer: pointer, key: key_ };
  })();

  // ================================================================ SHOP
  const Shop = (() => {
    let run, items, shopS, ownS, fly, sel, btns, cv, L, key, lvl, note, noteTok = 0, menuDown = false, menuHov = false, busy = 0;
    const statsOf = (type, lv) => { const b = CFG.BASE[type], g = CFG.SAO_GAIN[type]; return { diem: b.diem + (lv - 1) * g.diem, the: b.the + (lv - 1) * g.the }; };
    const freeSlot = () => { for (let i = 0; i < (run.qnMax || CFG.SHOP.QN_SLOTS); i++) if (!run.qn[i]) return i; return -1; };
    const why = i => { const it = items[i]; if (!it || it.sold) return 'sold'; if (it.kind === 'qn' && freeSlot() < 0) return 'slots'; if (run.money < it.price) return 'money'; return null; };
    const rerollCost = () => CFG.SHOP.REROLL_BASE + CFG.SHOP.REROLL_STEP * run.shop.rerolls;
    const texOf = it => (it.kind === 'qn' ? A.quyNhan(it.id) : A.sao(it.id));
    const say = (m, s) => { note = m; const t = ++noteTok; FX.after(s || 2.2, () => { if (noteTok === t) note = null; }); };

    function lay() {
      const g = G(), w = g.w, h = g.h, sf = g.safe, dpr = g.dpr, k = [w, h, dpr, sf.t, sf.r, sf.b, sf.l].join();
      if (k === key) return false; key = k;
      const m = 8, X0 = sf.l + m, X1 = w - sf.r - m, Y0 = sf.t + 6, Y1 = h - sf.b - m, u = base(), gap = Math.max(6, Math.round(u * 0.5)), o = { u: u, gap: gap };
      o.menu = menuRect(); o.bar = { x: X0, y: Y0, w: X1 - X0, h: 44 };
      const wide = (X1 - X0) / (Y1 - Y0) > 1.25, btnH = 52, labelH = Math.round(u * 1.4), tagH = Math.round(u * 1.3) + 30, top = Y0 + 44 + gap;
      const colX = X0, colW = wide ? Math.round((X1 - X0) * 0.62) : X1 - X0, infoMin = Math.round(u * 5.8);
      const availH = wide ? Y1 - top - labelH - gap * 2 - tagH : Y1 - top - labelH - gap * 4 - tagH - btnH - infoMin;
      const us = (cw) => Math.max(1, Math.floor((cw / 48) * dpr + 1e-6)), ssMax = us((colW - gap * 3) / 4), soMax = us((colW - gap * 4) / 5);
      let ss = ssMax, so = 1;
      for (; ss >= 1; ss--) { so = clamp(Math.floor(ss * 0.66), 1, soMax); if ((64 * (so + ss)) / dpr <= availH) break; }
      if (ss < 1) { ss = 1; so = 1; }
      o.shopScale = ss; o.ownScale = so;
      const sw = (48 * ss) / dpr, sh = (64 * ss) / dpr, ow = (48 * so) / dpr, oh = (64 * so) / dpr;
      const leftH = labelH + oh + gap + sh + tagH;
      let y = wide ? top + Math.max(0, (Y1 - top - leftH) / 2) : top;
      let extra = 0;
      if (!wide) { const used = leftH + gap * 3 + infoMin + btnH; extra = Math.max(0, Y1 - top - used); }
      const infoGrow = Math.min(extra, u * 6), sp = Math.min(20, (extra - infoGrow) / 4), off = Math.max(0, (extra - infoGrow - 4 * sp) / 2);
      if (!wide) y += off;
      o.labelY = Math.round(y); y += labelH;
      const ox = colX + (colW - (5 * ow + 4 * gap)) / 2;
      o.own = [0, 1, 2, 3, 4].map(i => ({ x: Math.round(ox + i * (ow + gap)), y: Math.round(y), w: Math.round(ow), h: Math.round(oh) }));
      y += oh + gap + sp;
      const sx = colX + (colW - (4 * sw + 3 * gap)) / 2;
      o.card = [0, 1, 2, 3].map(i => ({ x: Math.round(sx + i * (sw + gap)), y: Math.round(y), w: Math.round(sw), h: Math.round(sh) }));
      o.tag = o.card.map(c => ({ x: c.x, y: c.y + c.h + 4, w: c.w, h: tagH - 4 }));
      y += sh + tagH + sp;
      if (wide) {
        const rx = colX + colW + gap * 2, rw = X1 - rx, bw = Math.min(rw, 380), bx = rx + (rw - bw) / 2, bTot = 3 * btnH + 2 * 8;
        o.info = { x: rx, y: top, w: rw, h: Y1 - top - bTot - gap };
        o.b = { buy: { x: bx, y: Y1 - bTot, w: bw, h: btnH }, reroll: { x: bx, y: Y1 - bTot + btnH + 8, w: bw, h: btnH }, next: { x: bx, y: Y1 - btnH, w: bw, h: btnH } };
      } else {
        const bw = Math.floor((X1 - X0 - 2 * gap) / 3), ih = infoMin + infoGrow, by = Math.round(y + sp + ih + gap + sp);
        o.info = { x: X0, y: Math.round(y + sp), w: X1 - X0, h: ih };
        o.b = { buy: { x: X0, y: by, w: bw, h: btnH }, reroll: { x: X0 + bw + gap, y: by, w: bw, h: btnH }, next: { x: X0 + 2 * (bw + gap), y: by, w: bw, h: btnH } };
      }
      o.lixi = { x: X0 + 4, y: Y0 + 6 }; o.dealFrom = { x: o.b.reroll.x + o.b.reroll.w / 2, y: o.b.reroll.y };
      L = o; return true;
    }
    function place(s, rect, scale) { const c = ctr(rect); s.scale = scale; s.T.x = s.V.x = c.x; s.T.y = s.V.y = c.y; s._sp.x.x = c.x; s._sp.y.x = c.y; }
    function mkOwn(i) { const q = run.qn[i]; if (!q) return null; const s = SP.create({ tex: A.quyNhan(q.id), scale: L.ownScale }); s.sway = false; s.id = q.id; place(s, L.own[i], L.ownScale); return s; }
    function mkShop(i) { const it = items[i]; if (it.sold) return null; const s = SP.create({ tex: texOf(it), scale: L.shopScale }); place(s, L.card[i], L.shopScale); return s; }
    function build() { ownS = run.qn.map((q, i) => mkOwn(i)); shopS = items.map((it, i) => mkShop(i)); }
    function relayout() {
      ownS.forEach((s, i) => { if (s) place(s, L.own[i], L.ownScale); });
      shopS.forEach((s, i) => { if (s) place(s, L.card[i], L.shopScale); });
    }
    function buildBtns() {
      const sellV = sel && sel.z === 'own' && run.qn[sel.i] ? Math.floor(CFG.PRICE.QN[run.qn[sel.i].id] * CFG.SHOP.SELL_RATIO) : 0;
      const canBuy = sel && sel.z === 'shop' && !why(sel.i), canSell = sel && sel.z === 'own' && run.qn[sel.i];
      const sell = sel && sel.z === 'own';
      btns.list = [
        { id: 'buy', label: sell ? T.shop.sell : T.shop.buy, r: L.b.buy, on: !!(canBuy || canSell), still: false },
        { id: 'reroll', label: T.shop.reroll + ' · ' + rerollCost(), r: L.b.reroll, on: run.money >= rerollCost() },
        { id: 'next', label: T.shop.next, r: L.b.next, on: true },
      ];
      btns.sellV = sellV;
    }
    function enter(args) {
      const g = G(); run = (args && args.run) || g.run; g.run = run;
      FX.reset(); if (TL.BG) TL.BG.setMood('shop');
      items = TL.Run.shop(run).filter(it => it.kind === 'qn' || it.kind === 'sao'); cv = { lixi: run.money }; sel = null; lvl = null; fly = []; btns = Btns(); key = ''; note = null; busy = 0; menuDown = false;
      lay(); build(); buildBtns(); saveRun(run);
      if (TL.Tutorial && !g.flags.auto) TL.Tutorial.onShop();
      shopS.forEach((s, i) => { if (s) s.deal({ x: L.dealFrom.x, y: L.dealFrom.y }, 0.1 + i * 0.1, texOf(items[i])); });
      snd('shuffle');
      if (g.flags.auto) auto();
    }
    function auto() {
      const q = FX.queue;
      items.forEach((it, i) => q.add(() => { if (!why(i)) { doBuy(i); return 0.6; } return 0; }, 0.35));
      q.add(() => { go(); return 0; }, 0.5);
    }
    function setMoney(delta, at) {
      FX.counter(cv, 'lixi', run.money, 0.5);
      if (delta) { const p = at || { x: L.lixi.x + 60, y: L.lixi.y + 40 }; FX.popup((delta > 0 ? '+' : '') + delta, p.x, p.y, delta > 0 ? 'gold' : 'bad'); }
    }
    function unselect() { [].concat(ownS, shopS).forEach(s => { if (s) s.selected = false; }); sel = null; }
    function doBuy(i) {
      const it = items[i], s = shopS[i], w = why(i);
      if (w) { say(w === 'money' ? T.shop.poor : w === 'slots' ? T.shop.full : T.shop.sold); return false; }
      const before = it.kind === 'sao' ? run.sao[D.SAO[it.id].combo] : 0;
      const res = TL.Run.buy(run, i); if (!res.ok) return false;
      snd('buy'); snd('coin', { pitch: 0.8, vol: 0.6 }); setMoney(-it.price); unselect(); shopS[i] = null; lvl = null;
      if (s) { s.selected = false; fly.push(s); }
      if (it.kind === 'qn') {
        const slot = run.qn.findIndex(q => q && q.id === it.id), c = ctr(L.own[slot]);
        if (s) { s.sway = false; s.T.sx = s.T.sy = L.ownScale / L.shopScale; s.moveTo(c.x, c.y, 0.45); s.juice(0.8); }
        FX.after(0.55, () => { fly = fly.filter(f => f !== s); const n = mkOwn(slot); if (n) { ownS[slot] = n; n.juice(1); snd('place'); } });
      } else {
        const type = D.SAO[it.id].combo, lv = run.sao[type], a = statsOf(type, before), b = statsOf(type, lv);
        lvl = { name: D.SAO[it.id].name, combo: D.COMBO_NAME[type], from: before, to: lv, dv: a.diem, tv: a.the };
        FX.after(0.3, () => { FX.counter(lvl, 'dv', b.diem, 0.7); FX.counter(lvl, 'tv', b.the, 0.7); });
        FX.stamp(T.shop.level.replace('%d', lv), 'gold'); snd('mult');
        if (s) { const c = ctr(L.info); s.T.sx = s.T.sy = 0.8; s.moveTo(c.x, c.y - L.info.h * 0.2, 0.4); FX.after(0.4, () => s.dissolve(0.7, () => { fly = fly.filter(f => f !== s); })); }
      }
      saveRun(run); return true;
    }
    function doSell(slot) {
      const q = run.qn[slot]; if (!q) return false;
      const v = Math.floor(CFG.PRICE.QN[q.id] * CFG.SHOP.SELL_RATIO), s = ownS[slot];
      if (!TL.Run.sell(run, slot).ok) return false;
      snd('sell'); snd('dissolve', { vol: 0.7 }); setMoney(v); unselect(); lvl = null; ownS[slot] = null;
      if (s) { fly.push(s); s.dissolve(0.7, () => { fly = fly.filter(f => f !== s); }); }
      saveRun(run); return true;
    }
    function doReroll() {
      const r = TL.Run.reroll(run); if (!r.ok) { say(T.shop.poor); return; }
      snd('shuffle'); setMoney(0); unselect(); lvl = null; items = TL.Run.shop(run).filter(it => it.kind === 'qn' || it.kind === 'sao'); shopS = items.map((it, i) => mkShop(i));
      shopS.forEach((s, i) => { if (s) s.deal({ x: L.dealFrom.x, y: L.dealFrom.y }, 0.05 + i * 0.09, texOf(items[i])); });
      saveRun(run);
    }
    function go() {
      const g = G(), r = TL.Run.nextBan(run);
      if (r === 'won') { clearSave(); g.setScreen('end', { result: 'won', run: run }); return; }
      saveRun(run); g.setScreen('table');
    }
    function act(id) {
      if (id === 'buy') { if (!sel) return; if (sel.z === 'shop') doBuy(sel.i); else doSell(sel.i); }
      else if (id === 'reroll') doReroll();
      else if (id === 'next') go();
    }
    function pick(x, y) {
      let s = SP.pick(shopS.filter(Boolean), x, y);
      if (s) return { z: 'shop', i: shopS.indexOf(s), s: s };
      s = SP.pick(ownS.filter(Boolean), x, y);
      if (s) return { z: 'own', i: ownS.indexOf(s), s: s };
      return null;
    }
    function update(dt) {
      if (lay()) relayout();
      [].concat(ownS, shopS, fly).forEach(s => { if (s) s.update(dt); });
      buildBtns();
    }
    // ---- drawing
    function tag(ctx, i) {
      const it = items[i], r = L.tag[i];
      if (it.sold) return;
      const nm = it.kind === 'qn' ? D.QUY_NHAN[it.id].name : D.SAO[it.id].name, ns = fit(nm, L.u, r.w + 6, 9);
      txt(ctx, nm, r.x + r.w / 2, r.y, ns, PAL.giayDo, 'center');
      const ok = !why(i) || run.money >= it.price, pw = Math.min(r.w, 92), ph = 28, px = r.x + (r.w - pw) / 2, py = r.y + Math.round(ns * 1.3) + 2;
      A.panel(ctx, { x: px, y: py, w: pw, h: ph }, { fill: ok ? PAL.nauCanhGian : PAL.denSon, border: ok ? PAL.vangKim : PAL.nauCanhGian, radius: 3 });
      ctx.save(); if (!ok) ctx.globalAlpha = 0.55;
      drawIcon(ctx, 'lixi', px + 6, py + 6, 1);
      txt(ctx, String(it.price), px + pw - 8, py + 5, 17, ok ? PAL.vangKim : PAL.giayDo, 'right');
      ctx.restore();
    }
    function infoLines(ctx) {
      const I = L.info, u = L.u, pad = 10, ww = I.w - pad * 2; let y = I.y + pad;
      const head = (s, c) => { const sz = fit(s, u + 3, ww, 11); txt(ctx, s, I.x + pad, y, sz, c || PAL.vangKim, 'left'); y += Math.round(sz * 1.4); };
      const body = (s, c) => { const sz = u; wrap(s, sz, ww).forEach(l => { if (y + sz < I.y + I.h - 4) txt(ctx, l, I.x + pad, y, sz, c || PAL.giayDo, 'left'); y += Math.round(sz * 1.3); }); };
      if (lvl) {
        head(lvl.name + ' · ' + lvl.combo); body(T.shop.level.replace('%d', lvl.from) + ' → ' + T.shop.level.replace('%d', lvl.to), PAL.giayDo);
        const a = statsOf(CFG_TYPE(lvl.combo), lvl.from); body(T.hud.diem + ' ' + fmt(Math.round(lvl.dv)) + '  ×  ' + T.hud.the + ' ' + fmt(Math.round(lvl.tv)), PAL.vangKim);
        return;
      }
      if (!sel) { head(T.shop.title); body(T.shop.slots.replace('%d', run.qn.filter(Boolean).length).replace('%d', CFG.SHOP.QN_SLOTS) + ' · ' + T.hud.lixi + ' ' + fmt(run.money)); body(T.shop.hint); return; }
      if (sel.z === 'shop') {
        const it = items[sel.i];
        if (it.kind === 'qn') { const d = D.QUY_NHAN[it.id]; head(d.name); body(d.desc); }
        else {
          const d = D.SAO[it.id], lv = run.sao[d.combo], a = statsOf(d.combo, lv), b = statsOf(d.combo, lv + 1);
          head(d.name + ' · ' + T.shop.sao); body(d.desc);
          body(T.shop.level.replace('%d', lv) + ' → ' + T.shop.level.replace('%d', lv + 1) + ' · ' + a.diem + '×' + a.the + ' → ' + b.diem + '×' + b.the, PAL.vangKim);
        }
        const w = why(sel.i); if (w === 'money') body(T.shop.poor, PAL.giayDo); else if (w === 'slots') body(T.shop.full, PAL.giayDo);
      } else {
        const q = run.qn[sel.i]; if (!q) return; const d = D.QUY_NHAN[q.id];
        head(d.name); body(d.desc); body(T.shop.sellFor.replace('%d', btns.sellV), PAL.vangKim);
      }
    }
    function CFG_TYPE(name) { return Object.keys(D.COMBO_NAME).find(k => D.COMBO_NAME[k] === name) || 'doi'; }
    function draw(ctx) {
      lay();
      const u = L.u, B = L.bar;
      // top bar
      A.panel(ctx, { x: B.x, y: B.y, w: B.w - 52, h: 44 }, { fill: PAL.nauCanhGian, border: PAL.vangKim, radius: 4 });
      drawIcon(ctx, 'lixi', L.lixi.x + 2, L.lixi.y + 2, 2);
      txt(ctx, fmt(Math.round(cv.lixi)), L.lixi.x + 40, B.y + 8, 24, PAL.vangKim, 'left');
      txt(ctx, T.shop.title, B.x + (B.w - 52) / 2, B.y + 5, fit(T.shop.title, 30, B.w - 52 - 150, 16), PAL.vangKim, 'center');
      menuBtn(ctx, L.menu, menuDown, menuHov);
      // owned row
      txt(ctx, T.shop.slots.replace('%d', run.qn.filter(Boolean).length).replace('%d', CFG.SHOP.QN_SLOTS), L.own[0].x, L.labelY, u, PAL.giayDo, 'left');
      L.own.forEach(r => A.panel(ctx, r, { fill: PAL.denSon, border: PAL.nauCanhGian, shadow: null, radius: 3 }));
      L.card.forEach((r, i) => { if (items[i].sold || !shopS[i]) { A.panel(ctx, r, { fill: PAL.denSon, border: PAL.nauCanhGian, shadow: null, radius: 3 }); if (items[i].sold) txt(ctx, T.shop.sold, r.x + r.w / 2, r.y + r.h / 2 - 8, fit(T.shop.sold, u, r.w - 6, 9), PAL.nauCanhGian === PAL.denSon ? PAL.giayDo : PAL.giayDo, 'center'); } });
      // selection frame under the sprite
      if (sel) { const r = sel.z === 'shop' ? L.card[sel.i] : L.own[sel.i]; if (r) A.panel(ctx, { x: r.x - 4, y: r.y - 4 - 16, w: r.w + 8, h: r.h + 8 + 16 }, { fill: PAL.denSon, border: PAL.vangKim, shadow: null, radius: 4 }); }
      SP.drawAll(ctx, ownS.filter(Boolean)); SP.drawAll(ctx, shopS.filter(Boolean));
      // unaffordable: dim the card
      shopS.forEach((s, i) => { if (!s || items[i].sold) return; if (why(i)) { const sz = s.size(); ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = PAL.denSon; ctx.fillRect(Math.round(s.V.x - sz.w / 2), Math.round(s.V.y - sz.h / 2), Math.round(sz.w), Math.round(sz.h)); ctx.restore(); } });
      items.forEach((it, i) => tag(ctx, i));
      // info + buttons
      A.panel(ctx, L.info, { fill: PAL.nauCanhGian, border: PAL.vangKim, radius: 5 });
      infoLines(ctx);
      if (note) { txt(ctx, note, L.info.x + L.info.w - 10, L.info.y + L.info.h - u * 1.5 - 4, u, PAL.vangKim, 'right'); }
      btns.draw(ctx);
      SP.drawAll(ctx, fly);
    }
    function tutRects() {   // spotlight targets for the Chợ Tết tour
      if (!L || !items) return null;
      const cards = kind => L.card.filter((c, i) => items[i] && items[i].kind === kind);
      return { qn: [{ x: L.own[0].x - 4, y: L.own[0].y - 4, w: L.own[4].x + L.own[4].w - L.own[0].x + 8, h: L.own[0].h + 8 }].concat(cards('qn')), sao: cards('sao'), lixi: [{ x: L.bar.x, y: L.bar.y, w: Math.min(170, L.bar.w), h: L.bar.h }] };
    }
    function pointer(e) {
      if (e.type === 'move') { menuHov = inR(L.menu, e.x, e.y); btns.pointer(e); SP.hover([].concat(ownS, shopS).filter(Boolean), e.x, e.y); return; }
      if (e.type === 'down') {
        if (inR(L.menu, e.x, e.y)) { menuDown = true; snd('button'); return; }
        if (btns.pointer(e)) return;
        const p = pick(e.x, e.y);
        if (p) { const same = sel && sel.z === p.z && sel.i === p.i; unselect(); lvl = null; if (!same) { sel = { z: p.z, i: p.i }; p.s.selected = true; snd('select'); } return; }
        if (inR(L.info, e.x, e.y)) return;
        unselect(); return;
      }
      if (e.type === 'up') {
        if (menuDown) { menuDown = false; if (inR(L.menu, e.x, e.y)) G().setScreen('settings'); return; }
        btns.pointer(e, act);
      }
    }
    function key_(e) {
      if (e.key === 'esc') G().setScreen('settings');
      else if (e.key === 'enter') act('buy');
      else if (e.key === 'space') act('next');
    }
    return { enter: enter, exit() {}, resize() { key = ''; }, update: update, draw: draw, pointer: pointer, key: key_, tutRects: tutRects };
  })();

  // ================================================================ END
  const End = (() => {
    let run, won, btns = Btns(), cards = [], key = '', L, head = { a: 0 }, tt = 0, menuDown = false, menuHov = false, fin = null, xpv = { v: 0 }, xp0 = 0, lvShown = 1, copied = false;
    const XPH = () => (fin ? Math.round(base() * 5.6) : 0);
    const reached = () => (won ? 9 : run.chang * 3 + run.ban + 1);
    function rows() {
      const s = run.stats || {};
      return [[T.end.reached, reached() + ' / 9'], [T.end.bestPot, fmt(s.bestPot || 0)], [T.end.chat, fmt(s.chat || 0)], [T.end.earned, fmt(s.earned || 0)]];
    }
    function lay() {
      const g = G(), w = g.w, h = g.h, sf = g.safe, k = [w, h, g.dpr].join();
      if (k === key) return; key = k;
      const X0 = sf.l + 12, X1 = w - sf.r - 12, Y0 = sf.t + 56, Y1 = h - sf.b - 12, wide = (X1 - X0) / (Y1 - Y0) > 1.55, u = base();
      const left = wide ? { x: X0, y: Y0 - 44, w: (X1 - X0) * 0.5, h: Y1 - Y0 + 44 } : { x: X0, y: Y0, w: X1 - X0, h: 0 };
      const bw = Math.min(300, (wide ? left.w : X1 - X0) - 8), bh = 52, gap = 10;
      const hs = fit(won ? T.end.win : T.end.lose, Math.min(wide ? 80 : 68, Math.round(h * 0.13)), (wide ? left.w : X1 - X0) * 0.96, 24);
      const rowH = Math.round(u * 1.9), pw = Math.min(wide ? (X1 - X0) * 0.44 : X1 - X0, 420), ph = rows().length * rowH + 20 + Math.round(u * 1.6) + XPH();
      L = { u: u, hs: hs, rowH: rowH };
      let cardH;
      if (wide) {
        const cx = left.x + left.w / 2, blockH = Math.round(hs * 1.3) + Math.round(u * 1.5) + 18 + 2 * bh + gap, y0 = left.y + (left.h - blockH) / 2;
        L.cx = cx; L.headY = y0; L.subY = y0 + Math.round(hs * 1.3); L.panel = { x: X1 - pw, y: Y0 - 44 + (Y1 - Y0 + 44 - ph) / 2, w: pw, h: ph };
        const by = L.subY + Math.round(u * 1.5) + 18; L.b = [{ x: cx - bw / 2, y: by, w: bw, h: bh }, { x: cx - bw / 2, y: by + bh + gap, w: bw, h: bh }];
        cardH = 0;
      } else {
        const cx = (X0 + X1) / 2; L.cx = cx;
        const avail = Y1 - Y0, need = Math.round(hs * 1.3) + Math.round(u * 1.5) + 14 + ph + 14 + 2 * bh + gap;
        const y0 = Y0 + Math.max(0, (avail - need) / 2);
        L.headY = y0; L.subY = y0 + Math.round(hs * 1.3); L.panel = { x: cx - pw / 2, y: L.subY + Math.round(u * 1.5) + 14, w: pw, h: ph };
        const by = L.panel.y + ph + 14; L.b = [{ x: cx - bw / 2, y: by, w: bw, h: bh }, { x: cx - bw / 2, y: by + bh + gap, w: bw, h: bh }];
      }
      btns.list = [{ id: run && run.daily ? 'share' : 'again', label: run && run.daily ? (copied ? D.TEXT.modes.end.copied : D.TEXT.modes.end.share) : T.end.again, r: roundR(L.b[0]) }, { id: 'title', label: T.end.toTitle, r: roundR(L.b[1]) }];
    }
    const roundR = r => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) });
    function enter(args) {
      const g = G(); run = (args && args.run) || g.run; won = !!(args && args.result === 'won') || (run && run.phase === 'won');
      FX.reset(); clearSave(); btns = Btns(); key = ''; head = { a: 0 }; tt = 0; menuDown = false; fin = null; copied = false; xpv = { v: 0 };
      if (run && TL.Profile && !g.flags.auto && !run.finished) {
        try { const pr = TL.Profile.get(); run.finished = true; fin = TL.Profile.finish(pr, run, won); TL.Profile.save(pr); xp0 = pr.xp - fin.xp; lvShown = fin.level0; } catch (e) { fin = null; }
      }
      if (TL.BG) TL.BG.setMood(won ? 'title' : 'boss');
      lay();
      FX.stamp(won ? T.end.win : T.end.lose, won ? 'gold' : 'bad'); snd(won ? 'venhat' : 'thua');
      FX.after(0.9, () => FX.tween(head, { a: 1 }, 0.4, 'out'));
      if (fin) FX.after(1.5, () => FX.tween(xpv, { v: 1 }, FX.reducedMotion ? 0.01 : 1.4, 'inout'));
      if (won) {
        snd('gong');
        [0.2, 0.6, 1.1, 1.8].forEach((t, i) => FX.after(t, () => { const g2 = G(); FX.confetti(g2.w * (0.2 + 0.2 * (i % 4)), g2.h * 0.3, 60); snd('coin', { pitch: 1 + i * 0.1, vol: 0.6 }); }));
      }
    }
    function again() { if (TL.Modes) TL.Modes.again(); else { const g = G(); g.run = TL.Run.create(newSeed()); g.setScreen('table'); } }
    function share() {
      if (!run || !run.daily) return; const pr = TL.Profile.get();
      try { navigator.clipboard.writeText(TL.Profile.dailyShare(pr.daily)); } catch (e) {}
      copied = true; key = ''; snd('coin');
    }
    function act(id) { if (id === 'again') again(); else if (id === 'share') share(); else if (TL.Trans) TL.Trans.go('title'); else G().setScreen('title'); }
    function draw(ctx) {
      lay();
      ctx.save(); ctx.globalAlpha = head.a;
      txt(ctx, won ? T.end.win : T.end.lose, L.cx, L.headY, L.hs, won ? PAL.vangKim : PAL.giayDo, 'center', { outline: PAL.denSon, shadow: won ? PAL.doSon : PAL.nauCanhGian });
      txt(ctx, won ? T.end.winSub : T.end.loseSub, L.cx, L.subY, fit(won ? T.end.winSub : T.end.loseSub, Math.round(L.u * 1.15), G().w - 40, 11), PAL.giayDo, 'center');
      ctx.restore();
      const P = L.panel; A.panel(ctx, P, { fill: PAL.nauCanhGian, border: PAL.vangKim, radius: 5 });
      txt(ctx, T.end.stats, P.x + 14, P.y + 8, Math.round(L.u * 1.1), PAL.vangKim, 'left');
      rows().forEach((r, i) => {
        const y = P.y + 10 + Math.round(L.u * 1.6) + i * L.rowH;
        if (i) { ctx.fillStyle = PAL.denSon; ctx.fillRect(P.x + 12, y - 3, P.w - 24, 2); }
        txt(ctx, r[0], P.x + 14, y + 2, fit(r[0], L.u + 1, P.w - 120, 10), PAL.giayDo, 'left');
        txt(ctx, r[1], P.x + P.w - 14, y + 2, L.u + 3, PAL.vangKim, 'right');
      });
      if (fin) drawXp(ctx, P);
      btns.draw(ctx);
      menuBtn(ctx, menuRect(), menuDown, menuHov);
    }
    function drawXp(ctx, P) {
      const M = D.TEXT.modes.end, u = L.u, cur = Math.round(xp0 + fin.xp * xpv.v), lv = TL.Profile.level(cur), y = P.y + P.h - XPH() + 4;
      if (lv.level > lvShown) { lvShown = lv.level; FX.stamp(M.lvUp.replace('%d', lv.level), 'gold'); snd('gong', { vol: 0.6 }); }
      ctx.fillStyle = PAL.denSon; ctx.fillRect(P.x + 12, y - 4, P.w - 24, 2);
      txt(ctx, M.xp + ' +' + fmt(Math.round(fin.xp * xpv.v)), P.x + 14, y + 2, L.u + 1, PAL.vangKim, 'left');
      txt(ctx, D.TEXT.modes.mai.lvl.replace('%d', lv.level), P.x + P.w - 14, y + 2, L.u + 1, PAL.giayDo, 'right');
      const bar = { x: P.x + 14, y: y + Math.round(u * 1.7), w: P.w - 28, h: Math.max(10, Math.round(u * 0.9)) };
      ctx.fillStyle = PAL.denSon; ctx.fillRect(bar.x, bar.y, bar.w, bar.h);
      ctx.fillStyle = PAL.vangKim; ctx.fillRect(bar.x + 2, bar.y + 2, Math.round((bar.w - 4) * clamp(lv.into / lv.need, 0, 1)), bar.h - 4);
      if (xpv.v >= 1) {
        const bits = []; if (fin.mai > 0) bits.push(M.mai.replace('%d', fin.mai)); if (fin.newBest) bits.push(M.newBest);
        if (bits.length) txt(ctx, bits.join(' · '), P.x + P.w / 2, bar.y + bar.h + 4, fit(bits.join(' · '), L.u + 1, P.w - 20, 10), PAL.laXanh, 'center');
      }
    }
    function pointer(e) {
      if (e.type === 'move') menuHov = inR(menuRect(), e.x, e.y);
      if (e.type === 'down' && inR(menuRect(), e.x, e.y)) { menuDown = true; snd('button'); return; }
      if (e.type === 'up' && menuDown) { menuDown = false; if (inR(menuRect(), e.x, e.y)) G().setScreen('settings'); return; }
      btns.pointer(e, act);
    }
    function key_(e) { if (e.key === 'enter' || e.key === 'space') act(run && run.daily ? 'title' : 'again'); else if (e.key === 'esc') G().setScreen('settings'); }
    return { enter: enter, exit() {}, resize() { key = ''; }, update(dt) { tt += dt; lay(); }, draw: draw, pointer: pointer, key: key_ };
  })();

  // ================================================================ SETTINGS (overlay)
  const Settings = (() => {
    let btns = Btns(), L, key = '';
    const S = () => G().settings;
    function apply() { const g = G(); g.saveSettings(); g.applySettings(); }
    function lay() {
      const g = G(), w = g.w, h = g.h, sf = g.safe, ps = TL.PWA ? TL.PWA.status() : { full: 'no', inst: 'menu' }, k = [w, h, g.name, ps.full, ps.inst].join();
      if (k === key) return; key = k;
      const X0 = sf.l + 8, X1 = w - sf.r - 8, Y0 = sf.t + 8, Y1 = h - sf.b - 8, two = h < 480 && w > 560, u = clamp(Math.round(Math.min(w, h) / 30), 14, 20);
      const pw = Math.min(X1 - X0, two ? 740 : 420), rowH = two ? 50 : 56, bh = two ? 44 : 50, titleH = two ? 46 : 52, pad = 16, cols = two ? 2 : 1;
      const rowsN = two ? 6 : 10, ph = titleH + rowsN * rowH + pad;
      const px = Math.round((X0 + X1) / 2 - pw / 2), py = Math.round(Math.max(Y0, (Y0 + Y1) / 2 - ph / 2)), cw = (pw - pad * 2 - (two ? 16 : 0)) / cols;
      const cell = (i) => ({ x: px + pad + (i % cols) * (cw + 16), y: py + titleH + Math.floor(i / cols) * rowH, w: cw });
      L = { panel: { x: px, y: py, w: pw, h: ph }, u: u, cells: [], bh: bh };
      const home = g.name !== 'title';
      const defs = ['sound', 'speed', 'scan', 'red', 'full', 'inst', 'tut', 'sort', 'perf'];

      defs.forEach((id, i) => {
        const c = cell(i); L.cells.push({ id: id, c: c });
      });
      const f1 = cell(9), f2 = two ? cell(10) : null, tutC = cell(6);
      L.foot = two ? [{ id: 'home', r: { x: f1.x, y: f1.y, w: cw, h: bh } }, { id: 'close', r: { x: f2.x, y: f2.y, w: cw, h: bh } }]
        : (() => { const half = (cw - 10) / 2; return [{ id: 'home', r: { x: f1.x, y: f1.y, w: half, h: bh } }, { id: 'close', r: { x: f1.x + half + 10, y: f1.y, w: half, h: bh } }]; })();
      L.home = home;
      const list = [];
      L.cells.forEach(o => {
        const c = o.c, st = S();
        if (o.id === 'speed') {
          const sw = Math.min(64, (cw - 80) / 3);
          CFG.MOTION.speeds.forEach((v, j) => list.push({ id: 'speed' + v, label: v + '×', r: { x: Math.round(c.x + cw - 3 * sw + j * sw), y: Math.round(c.y), w: Math.round(sw - 4), h: bh }, sel: st.speed === v, still: true }));
        } else if (o.id === 'full' || o.id === 'inst') {
          const f = o.id === 'full', v = f ? ps.full : ps.inst, canDo = f ? (v === 'on' || v === 'off') : v === 'can';
          o.note = f ? (v === 'no' ? T.settings.fullNo : v === 'app' ? T.settings.fullIn : null) : (v === 'ios' ? T.settings.instIos : v === 'done' ? T.settings.instDone : v === 'menu' ? T.settings.instMenu : null);
          if (f && canDo) list.push({ id: 'full', label: v === 'on' ? T.settings.on : T.settings.off, r: { x: Math.round(c.x + cw - 96), y: Math.round(c.y), w: 96, h: bh }, sel: v === 'on', still: true });
          if (!f && canDo) list.push({ id: 'inst', label: T.settings.instGo, r: { x: Math.round(c.x + cw - 96), y: Math.round(c.y), w: 96, h: bh }, still: false });
        } else if (o.id === 'sort') {   // Xếp bài: theo số / theo chất (also the default for the next deal)
          const sw = Math.min(112, (cw - 96) / 2);
          [['rank', T.settings.sortRank], ['suit', T.settings.sortSuit]].forEach((q, j) => list.push({ id: 'sort' + q[0], label: q[1], r: { x: Math.round(c.x + cw - 2 * sw + j * sw), y: Math.round(c.y), w: Math.round(sw - 4), h: bh }, sel: (st.sort || 'rank') === q[0], still: true }));
        } else if (o.id === 'perf') {   // Hiệu năng: Tự động / Cao / Tiết kiệm
          const sw = Math.min(88, (cw - 96) / 3);
          [['auto', T.settings.perfAuto], ['high', T.settings.perfHigh], ['low', T.settings.perfLow]].forEach((q, j) => list.push({ id: 'perf' + q[0], label: q[1], r: { x: Math.round(c.x + cw - 3 * sw + j * sw), y: Math.round(c.y), w: Math.round(sw - 4), h: bh }, sel: st.perf === q[0], still: true }));
        } else if (o.id === 'tut') {
          list.push({ id: 'tut', label: T.settings.tutGo, r: { x: Math.round(tutC.x + cw - 110), y: Math.round(tutC.y), w: 110, h: bh }, still: false });
        } else {
          const on = o.id === 'sound' ? st.sound : o.id === 'scan' ? st.scanlines : st.reducedMotion;
          list.push({ id: o.id, label: on ? T.settings.on : T.settings.off, r: { x: Math.round(c.x + cw - 96), y: Math.round(c.y), w: 96, h: bh }, sel: on, still: true });
        }
      });
      L.foot.forEach(f => list.push({ id: f.id, label: f.id === 'home' ? T.settings.home : T.settings.close, r: roundR(f.r), on: f.id === 'close' || home }));
      btns.list = list;
    }
    const roundR = r => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) });
    function act(id) {
      const st = S();
      if (id === 'sound') st.sound = !st.sound;
      else if (id === 'scan') st.scanlines = !st.scanlines;
      else if (id === 'red') st.reducedMotion = !st.reducedMotion;
      else if (id === 'full') { if (TL.PWA) TL.PWA.toggleFullscreen(); snd('select'); return; }
      else if (id === 'inst') { if (TL.PWA) TL.PWA.install().then(() => { key = ''; }); return; }
      else if (id.indexOf('speed') === 0) st.speed = +id.slice(5);
      else if (id.indexOf('sort') === 0) st.sort = id.slice(4);
      else if (id.indexOf('perf') === 0) st.perf = id.slice(4);
      else if (id === 'tut') { const g = G(); g.run = TL.Run.create(newSeed()); if (TL.Tutorial) TL.Tutorial.restart(g.run); g.setScreen('table'); return; }
      else if (id === 'home') { G().setScreen('title'); return; }
      else if (id === 'close') { G().setScreen('back'); return; }
      apply(); key = ''; snd('select');
    }
    function enter() { key = ''; btns = Btns(); lay(); }
    function draw(ctx) {
      lay(); const g = G();
      ctx.save(); ctx.globalAlpha = 0.72; ctx.fillStyle = PAL.denSon; ctx.fillRect(0, 0, g.w, g.h); ctx.restore();
      A.panel(ctx, L.panel, { fill: PAL.nauCanhGian, border: PAL.vangKim, radius: 6 });
      txt(ctx, T.settings.title, L.panel.x + L.panel.w / 2, L.panel.y + 10, 28, PAL.vangKim, 'center');
      const lab = { sound: T.settings.sound, speed: T.settings.speed, scan: T.settings.scanlines, red: T.settings.reduced, full: T.settings.full, inst: T.settings.inst, tut: T.settings.tut, sort: T.settings.sort, perf: T.settings.perf };
      L.cells.forEach(o => {
        const s = fit(lab[o.id], L.u + 2, o.c.w - (o.id === 'speed' ? 3 * 60 : o.id === 'sort' ? 232 : o.id === 'perf' ? 250 : o.id === 'tut' ? 110 : o.note ? 0 : 96) - 12, 10);
        if (o.note) {   // no button here: label with a short note under it
          txt(ctx, lab[o.id], o.c.x, o.c.y + 2, s, PAL.giayDo, 'left');
          const ns = fit(o.note, 12, o.c.w - 4, 9); txt(ctx, o.note, o.c.x, o.c.y + 2 + s * 1.2 + 2, ns, PAL.vangKim, 'left');
        } else txt(ctx, lab[o.id], o.c.x, o.c.y + (L.bh - s * 1.15 - 4) / 2, s, PAL.giayDo, 'left');
      });
      btns.draw(ctx);
    }
    function pointer(e) {
      if (e.type === 'down' && !inR(L.panel, e.x, e.y)) { G().setScreen('back'); return; }
      btns.pointer(e, act);
    }
    function key_(e) { if (e.key === 'esc') G().setScreen('back'); }
    return { enter: enter, exit() {}, resize() { key = ''; }, update() {}, draw: draw, pointer: pointer, key: key_ };
  })();

  TL.Screens = TL.Screens || {};
  Object.assign(TL.Screens, { title: Title, shop: Shop, end: End, settings: Settings });
  TL.Screens._u = { Btns: Btns, txt: txt, fit: fit, base: base, inR: inR, clamp: clamp, snd: snd, wrap: wrap };
})(globalThis.TL = globalThis.TL || {});
