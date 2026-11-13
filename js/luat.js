/* js/luat.js  (owner SCREENS) "Luật bài": the card-rules guide. Loads after collection.js. Needs config, data, cards, art, screens (Screens._u).
 * API  TL.Screens.luat = overlay Screen {enter({from?:'settings', then?:fn}), exit(), resize(), update(dt), draw(ctx), pointer(e), key(e)}
 *        opened with Game.setScreen('luat', args) over the paused screen (Settings → "Luật bài"), closes back to settings (from) or the screen below.
 *        9 pages, one idea each, real card sprites; Ông Táo bubble with one line; swipe, Trước / Tiếp, ←/→; each page has a small "thử" (tap a card / bộ).
 *   TL.Luat.{seen() -> bool, invite() -> bool, open(then?), _pages()}   invite(): true once for a new player (not seen, tutorial not done, not ?auto);
 *        open(then) shows the guide from the title and calls then() when it closes (seen is stored under CFG.STORAGE.tut + '.luat').
 * Page = {k, title, say, mode: 'cmp'|'tap'|'de'|'chat'|'hu', groups:[{cards[ids]|back:n, label, say?, step?, br?, mark?:'auto'|'show', ok?, chat?, target?}]}.
 * Marks are computed from TL.Cards.detect / beats, never typed by hand, so the guide cannot disagree with the rules.
 */
(function (TL) {
  'use strict';
  const CFG = TL.CFG, D = TL.DATA, PAL = CFG.PAL, C = TL.Cards;
  const G = () => TL.Game;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const SEEN_KEY = CFG.STORAGE.tut + '.luat';

  // ---------------------------------------------------------------- text
  D.TEXT.luat = {
    title: 'Luật bài', close: 'Đóng', prev: 'Trước', next: 'Tiếp', done: 'Xong', pass: 'Bỏ lượt', tapHint: 'Chạm để thử.',
    cmp: '%a lớn hơn %b.', suitName: ['bích', 'chuồn', 'rô', 'cơ'],
    pages: [
      { title: 'Thứ tự lá bài', say: 'Từ nhỏ đến lớn: 3, 4, … K, A, rồi 2 (heo) lớn nhất. Chạm hai lá để so.', lo: 'Nhỏ nhất', hi: 'Lớn nhất' },
      { title: 'Bằng số thì xét chất', say: 'Cùng số thì xét chất: bích nhỏ nhất, rồi chuồn, rô, cơ lớn nhất. Chạm hai lá để so.' },
      { title: 'Các bộ cùng số', say: 'Rác là một lá. Đôi, sám, tứ quý là 2, 3, 4 lá cùng số. Chạm một bộ.',
        g: ['Rác', 'Đôi', 'Sám', 'Tứ quý'], s: ['Rác: một lá lẻ.', 'Đôi: hai lá cùng số.', 'Sám: ba lá cùng số.', 'Tứ quý: bốn lá cùng số.'] },
      { title: 'Sảnh', say: 'Sảnh là từ 3 lá liên tiếp trở lên. Heo không vào sảnh. Chạm một bộ.',
        g: ['Sảnh 3 lá', 'Sảnh 5 lá', 'Có heo', 'Hụt số'], s: ['Sảnh 3 lá: 4, 5, 6.', 'Sảnh càng dài càng nhiều điểm.', 'Heo không vào sảnh.', 'Phải liên tiếp, không được hụt số.'] },
      { title: 'Đôi thông', say: 'Đôi thông là từ 3 đôi liên tiếp trở lên. Chạm một bộ.',
        g: ['3 đôi thông', '4 đôi thông', 'Hụt số', 'Mới 2 đôi'], s: ['3 đôi liên tiếp: 5, 6, 7.', '4 đôi liên tiếp, mạnh hơn 3 đôi.', 'Đôi 7 bị hụt nên không thành đôi thông.', 'Cần ít nhất 3 đôi.'] },
      { title: 'Cách đè', say: 'Muốn đè: cùng loại, cùng số lá, lá đầu cao hơn. Chạm một bộ để thử đè.',
        g: ['Trên bàn', 'Đè được', 'Thấp hơn', 'Khác loại'], s: ['Sảnh 5, 6, 7 đang nằm trên bàn.', 'Đè được: cũng sảnh 3 lá, lá đầu cao hơn.', 'Không đè được: lá đầu thấp hơn.', 'Không đè được: đôi không đè được sảnh.'] },
      { title: 'Chặt heo', say: 'Heo mạnh nhất nhưng bị chặt. Chạm một bộ chặt để xem nó chặt gì.',
        g: ['Một heo', 'Đôi heo', 'Tứ quý', 'Tứ quý', '3 đôi thông', '4 đôi thông'],
        s: ['', '', '', 'Tứ quý chặt heo, đôi heo và tứ quý thấp hơn.', '3 đôi thông chặt một heo.', '4 đôi thông chặt heo, đôi heo và tứ quý.'] },
      { title: 'Ăn hũ', say: 'Mỗi lá đánh ra cộng vào hũ. Chạm bàn để đối thủ bỏ lượt.', gs: ['Đối thủ đánh', 'Bạn đè'], hu: 'Hũ', tong: 'Tổng điểm',
        after: 'Đối thủ bỏ lượt. Bạn ăn hũ vào Tổng điểm và được đi trước.' },
      { title: 'Thối heo, cóng, tới trắng', say: 'Ba luật cuối ván. Chạm một cái để đọc.', g: ['Thối heo', 'Cóng', 'Tới trắng'],
        s: [D.TEXT.first.thoi, D.TEXT.first.cong, D.TEXT.first.toiTrang] },
    ],
  };
  const TX = D.TEXT.luat;

  // ---------------------------------------------------------------- pages (data from the real rules)
  const RK = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'], SU = 'sc dh'.replace(' ', '');   // s c d h = bích chuồn rô cơ
  const ids = str => str.split(' ').map(t => RK.indexOf(t.slice(0, -1)) * 4 + SU.indexOf(t.slice(-1)));
  const kind = (cards, type) => { const c = C.detect(cards); return !!c && c.type === type; };
  const rankName = id => RK[id >> 2];
  function buildPages() {
    const P = TX.pages, out = [];
    const grp = (i, j, cards, extra) => Object.assign({ cards: cards, label: P[i].g ? P[i].g[j] : '', say: P[i].s ? P[i].s[j] : '' }, extra || {});
    out.push({ k: 'thuTu', mode: 'cmp', groups: [{ cards: ids('3s 4c 5d 6h 7s 8c 9d 10h Js Qc Kd Ah 2s'), step: 0.5, lo: P[0].lo, hi: P[0].hi }] });
    out.push({ k: 'chat', mode: 'cmp', groups: [{ cards: ids('7s 7c 7d 7h'), step: 1.12 }] });
    out.push({ k: 'bo', mode: 'tap', groups: [grp(2, 0, ids('9d')), grp(2, 1, ids('8s 8c')), grp(2, 2, ids('Qs Qc Qd')), grp(2, 3, ids('Js Jc Jd Jh'))] });
    out.push({ k: 'sanh', mode: 'tap', groups: [grp(3, 0, ids('4s 5c 6d'), { mark: 'auto', want: 'sanh' }), grp(3, 1, ids('9s 10c Jd Qh Ks'), { mark: 'auto', want: 'sanh' }),
      grp(3, 2, ids('Qs Kc Ad 2h'), { mark: 'auto', want: 'sanh' }), grp(3, 3, ids('5s 6c 8d'), { mark: 'auto', want: 'sanh' })] });
    out.push({ k: 'doiThong', mode: 'tap', groups: [grp(4, 0, ids('5s 5c 6s 6c 7s 7c'), { mark: 'auto', want: 'doithong' }), grp(4, 1, ids('8s 8c 9s 9c 10s 10c Js Jc'), { mark: 'auto', want: 'doithong' }),
      grp(4, 2, ids('5s 5c 6s 6c 8s 8c'), { mark: 'auto', want: 'doithong' }), grp(4, 3, ids('5s 5c 6s 6c'), { mark: 'auto', want: 'doithong' })] });
    const table = ids('5s 6s 7s'), tt = C.detect(table);
    out.push({ k: 'de', mode: 'de', groups: [grp(5, 0, table), grp(5, 1, ids('6c 7c 8c'), { cand: true }), grp(5, 2, ids('3d 4d 5d'), { cand: true }), grp(5, 3, ids('8s 8c'), { cand: true })]
      .map((g, i) => { if (g.cand) g.ok = !!C.beats(C.detect(g.cards), tt); if (i === 1) g.br = true; return g; }) });
    out.push({ k: 'chatHeo', mode: 'chat', groups: [grp(6, 0, ids('2s'), { target: true }), grp(6, 1, ids('2s 2c'), { target: true }), grp(6, 2, ids('5s 5c 5d 5h'), { target: true }),
      grp(6, 3, ids('9s 9c 9d 9h'), { chat: true, br: true }), grp(6, 4, ids('6s 6c 7s 7c 8s 8c'), { chat: true }), grp(6, 5, ids('8s 8c 9s 9c 10s 10c Js Jc'), { chat: true })] });
    out.push({ k: 'hu', mode: 'hu', pot: 18, total: 100, groups: [{ cards: ids('7s 7c'), label: P[7].gs[0] }, { cards: ids('Js Jc'), label: P[7].gs[1] }] });
    out.push({ k: 'phat', mode: 'tap', groups: [grp(8, 0, ids('2h 2d 4c')), grp(8, 1, null, { back: 4 }), grp(8, 2, ids('2s 2c 2d 2h'))] });
    out.forEach((p, i) => { p.title = P[i].title; p.say = P[i].say; });
    return out;
  }
  let PAGES = null;
  const pages = () => PAGES || (PAGES = buildPages());
  const markOf = (page, g, st, gi) => {
    if (g.mark === 'auto') return kind(g.cards, g.want) ? 'check' : 'cross';
    if (page.mode === 'de' && g.cand && st.act === gi && st.t > 0.35) return g.ok ? 'check' : 'cross';
    if (page.mode === 'chat' && g.target && st.act >= 0) return C.beats(C.detect(page.groups[st.act].cards), C.detect(g.cards)) === 'chat' ? 'check' : 'cross';
    return null;
  };
  const cmpText = (a, b) => {
    const hi = a > b ? a : b, lo = a > b ? b : a, N = TX.suitName, same = (a >> 2) === (b >> 2);
    const nm = id => same ? rankName(id) + ' ' + N[id & 3] : rankName(id);
    return TX.cmp.replace('%a', nm(hi)).replace('%b', nm(lo));
  };

  // ---------------------------------------------------------------- seen / invite
  function seen() { try { return localStorage.getItem(SEEN_KEY) === '1'; } catch (e) { return true; } }
  function markSeen() { try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) {} }
  const invite = () => !seen() && !(G() && G().flags && G().flags.auto) && !(TL.Tutorial && TL.Tutorial.done());
  function open(then) { G().setScreen('luat', { then: then }); }
  TL.Luat = { seen: seen, invite: invite, open: open, _pages: pages, _cmp: cmpText };

  // ---------------------------------------------------------------- screen
  const Luat = (() => {
    const U = () => TL.Screens._u, A = () => TL.Art;
    let btns = null, st = null, L = null, lk = '', args = null, dn = null, wrapKey = '', wrapped = [], FX = null;
    const txt = (ctx, s, x, y, size, color, align) => A().text(ctx, s, x, y, { size: size, color: color || PAL.giayDo, align: align || 'left' });
    const inR = (b, x, y) => U().inR(b, x, y);
    const red = () => !!(G().settings && G().settings.reducedMotion);
    const page = () => pages()[st.page];

    function fresh(p) { st.page = p; st.sel = []; st.act = -1; st.t = 0; st.msg = ''; st.fade = red() ? 1 : 0; st.hu = -1; lk = ''; }

    function lay() {
      const g = G(), w = g.w, h = g.h, sf = g.safe, dpr = g.dpr, key = [w, h, dpr, st.page].join();
      if (key === lk) return; lk = key;
      const X0 = sf.l + 8, X1 = w - sf.r - 8, Y0 = sf.t + 8, Y1 = h - sf.b - 8, pw = Math.min(X1 - X0, 940), px = Math.round((X0 + X1) / 2 - pw / 2);
      const small = h < 480, pad = small ? 8 : 12, hdrH = small ? 40 : 46, navH = small ? 40 : 46, ts = Math.round(clamp(Math.min(w, h) / 28, 13, 19)), lh = Math.round(ts * 1.2);
      const pp = small ? 48 : 64, pk = pp / 48, panel = { x: px, y: Y0, w: pw, h: Y1 - Y0 };
      // bubble height: the page's longest line set, up to 3 lines
      const tw = pw - 2 * pad - pp - pad * 3, p = page(), all = [p.say, TX.tapHint].concat(p.groups.map(q => q.say || '')).concat(p.mode === 'hu' ? [TX.pages[7].after] : []);
      let lines = 1; all.forEach(s => { if (s) lines = Math.max(lines, U().wrap(s, ts, tw).length); }); lines = Math.min(3, lines);
      const bh = Math.max(pp, lines * lh) + pad * 2 + 4, by = panel.y + panel.h - pad - navH - 6 - bh;
      L = { panel: panel, pad: pad, ts: ts, lh: lh, tw: tw, pp: pp, pk: pk, small: small,
        hdr: { x: px + pad, y: panel.y + 4, w: pw - 2 * pad, h: hdrH },
        stage: { x: px + pad, y: panel.y + hdrH + 4, w: pw - 2 * pad, h: by - 6 - (panel.y + hdrH + 4) },
        bubble: { x: px + pad, y: by, w: pw - 2 * pad, h: bh },
        nav: { x: px + pad, y: panel.y + panel.h - pad - navH, w: pw - 2 * pad, h: navH } };
      const dotsW = pages().length * 10 + (pages().length - 1) * 6, bw = Math.round(clamp((L.nav.w - dotsW - 16) / 2, 64, small ? 96 : 116));
      L.close = { x: L.hdr.x + L.hdr.w - 92, y: L.hdr.y + (hdrH - 40) / 2, w: 92, h: 40 };
      L.prev = { x: L.nav.x, y: L.nav.y, w: bw, h: navH }; L.next = { x: L.nav.x + L.nav.w - bw, y: L.nav.y, w: bw, h: navH };
      layStage();
      btnsList();
    }
    function btnsList() {
      const last = st.page === pages().length - 1;
      btns.list = [{ id: 'close', label: TX.close, r: L.close, on: true }, { id: 'prev', label: TX.prev, r: L.prev, on: st.page > 0 }, { id: 'next', label: last ? TX.done : TX.next, r: L.next, on: true, sel: last }];
    }
    // flow layout of the groups inside the stage at the largest crisp scale that fits
    function layStage() {
      const g = G(), dpr = g.dpr, S = L.stage, p = page(), extra = p.mode === 'hu' ? Math.round(L.ts * 4.2) : 0, availH = S.h - extra - 4, availW = S.w - 8;
      const labH = k => (Math.round(clamp(64 * k * 0.2, 12, 18)) * 1.2 + 6);
      const put = k => {
        const cw = 48 * k, ch = 64 * k, gap = Math.max(14, cw * 0.4), lines = []; let line = null;
        p.groups.forEach((q, gi) => {
          const n = q.back || q.cards.length, step = q.step || 0.5, gw = cw + (n - 1) * cw * step;
          if (!line || q.br || line.w + gap + gw > availW) { line = { items: [], w: 0 }; lines.push(line); }
          line.items.push({ gi: gi, gw: gw, n: n, step: step }); line.w += (line.items.length > 1 ? gap : 0) + gw;
        });
        const lh = ch + labH(k) + 8, head = p.mode === 'cmp' ? Math.round(ch * 0.2) : 0, total = lines.length * lh - 8 + head;
        return { head: head, k: k, cw: cw, ch: ch, gap: gap, lines: lines, lh: lh, total: total, wide: Math.max.apply(null, lines.map(l => l.w)) };
      };
      let pick = null;
      for (let s = Math.max(1, Math.floor(150 * dpr / 64)); s >= 1; s--) { const r = put(s / dpr); pick = r; if (r.wide <= availW && r.total <= availH) break; }
      const r = pick; let y = S.y + Math.max(0, Math.round((availH - r.total) / 2)) + 2 + r.head;
      st.rects = []; st.lab = Math.round(clamp(r.ch * 0.2, 12, 18)); st.k = r.k;
      r.lines.forEach(line => {
        let x = S.x + Math.round((S.w - line.w) / 2);
        line.items.forEach(it => {
          const q = p.groups[it.gi], cs = [];
          for (let i = 0; i < it.n; i++) cs.push({ x: Math.round(x + i * r.cw * it.step), y: Math.round(y), w: Math.round(r.cw), h: Math.round(r.ch) });
          st.rects[it.gi] = { cards: cs, box: { x: Math.round(x), y: Math.round(y), w: Math.round(it.gw), h: Math.round(r.ch) }, lift: 0, ox: 0, oy: 0 };
          x += it.gw + r.gap;
        });
        y += r.lh;
      });
      st.extra = p.mode === 'hu' ? { x: S.x, y: S.y + S.h - extra, w: S.w, h: extra } : null;
    }

    function enter(a) {
      args = a || {}; FX = TL.FX; st = { page: 0 }; btns = U().Btns(); dn = null; lk = ''; fresh(0); lay();
      try { TL.Audio && TL.Audio.play('select'); } catch (e) {}
    }
    function close() {
      markSeen(); const then = args && args.then, from = args && args.from;
      U().snd('button');
      if (from === 'settings') G().setScreen('settings'); else G().setScreen('back');
      if (typeof then === 'function') then();
    }
    function go(d) {
      const n = clamp(st.page + d, 0, pages().length - 1);
      if (d > 0 && st.page === pages().length - 1) return close();
      if (n === st.page) return;
      fresh(n); lay(); U().snd('select');
    }
    function update(dt) {
      if (!st) return; lay();
      if (st.fade < 1) st.fade = Math.min(1, st.fade + dt / 0.18);
      st.t += dt;
      const p = page();
      st.rects.forEach((r, gi) => {
        const on = st.act === gi;
        r.lift += ((on && p.mode !== 'de' ? 1 : 0) - r.lift) * Math.min(1, dt * 14);
        if (p.mode === 'de' && p.groups[gi].cand) {
          let q = 0;
          if (st.act === gi) { const t = clamp(st.t / 0.5, 0, 1); q = p.groups[gi].ok ? t : Math.sin(t * Math.PI) * 0.6; }
          if (red()) q = st.act === gi && p.groups[gi].ok ? 1 : 0;
          const T = st.rects[0].box, B = r.box;
          r.ox = (T.x + Math.round(T.w * 0.3) - B.x) * q; r.oy = (T.y + 2 - B.y) * q;
        }
      });
      if (p.mode === 'hu' && st.hu >= 0) st.hu = Math.min(1.6, st.hu + dt);
      btnsList();
    }

    // ---------------------------------------------------------------- draw
    function bubbleText() {
      const p = page();
      if (p.mode === 'hu') return st.hu >= 1.0 ? TX.pages[7].after : p.say;
      return st.msg || p.say;
    }
    function drawCard(ctx, id, r, dx, dy, back) {
      const tex = back ? A().back() : A().card(id);
      ctx.drawImage(tex, Math.round(r.x + dx), Math.round(r.y + dy), r.w, r.h);
    }
    function draw(ctx) {
      if (!st) return; lay();
      const g = G(), p = page(), P = L.panel, a = U();
      ctx.save(); ctx.globalAlpha = 0.78; ctx.fillStyle = PAL.denSon; ctx.fillRect(0, 0, g.w, g.h); ctx.restore();
      A().panel(ctx, P, { fill: PAL.nauCanhGian, border: PAL.vangKim, radius: 6 });
      // header
      const hs = a.fit((st.page + 1) + '. ' + p.title, L.small ? 20 : 24, L.hdr.w - 110, 12);
      txt(ctx, (st.page + 1) + '. ' + p.title, L.hdr.x + 4, L.hdr.y + (L.hdr.h - hs * 1.1) / 2, hs, PAL.vangKim);
      ctx.save(); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = st.fade;
      // stage
      A().slot(ctx, L.stage, { radius: 4 });
      const R = st.rects, lab = st.lab;
      p.groups.forEach((q, gi) => {
        const r = R[gi]; if (!r) return;
        const lift = -Math.round(r.lift * L.stage.h * 0.04), mk = markOf(p, q, st, gi), dim = p.mode === 'chat' && q.target && st.act >= 0 && mk === 'cross';
        ctx.globalAlpha = st.fade * (dim ? 0.45 : 1);
        const cand = p.mode === 'de' && q.cand;
        r.cards.forEach((cr, ci) => {
          const selC = p.mode === 'cmp' && st.sel.indexOf(q.cards[ci]) >= 0, up = selC ? -Math.round(cr.h * 0.18) : 0;
          drawCard(ctx, q.cards && q.cards[ci], cr, r.ox, r.oy + lift + up, !!q.back);
          if (selC) { ctx.strokeStyle = PAL.vangKim; ctx.lineWidth = 2; ctx.strokeRect(cr.x + 1 + r.ox, cr.y + 1 + r.oy + lift + up, cr.w - 2, cr.h - 2); }
        });
        if (st.act === gi && p.mode !== 'cmp') { ctx.strokeStyle = PAL.vangKim; ctx.lineWidth = 2; ctx.strokeRect(r.box.x - 3 + r.ox, r.box.y - 3 + r.oy + lift, r.box.w + 6, r.box.h + 6); }
        ctx.globalAlpha = st.fade;
        if (q.label && !cand) txt(ctx, q.label, r.box.x + r.box.w / 2, r.box.y + r.box.h + 4, lab, st.act === gi ? PAL.vangKim : PAL.giayDo, 'center');
        else if (q.label && cand) txt(ctx, q.label, R[gi].box.x + R[gi].box.w / 2, R[gi].box.y + R[gi].box.h + 4, lab, st.act === gi ? PAL.vangKim : PAL.giayDo, 'center');
        if (mk) { const ic = A().icon(mk), m = L.small ? 1.5 : 2, iw = 16 * m; ctx.drawImage(ic, Math.round(r.box.x + r.box.w - iw * 0.6 + r.ox), Math.round(r.box.y - iw * 0.55 + r.oy + lift), iw, iw); }
        if (q.lo) {
          txt(ctx, q.lo, r.box.x, r.box.y + r.box.h + 4, lab, PAL.vangKim, 'left'); txt(ctx, q.hi, r.box.x + r.box.w, r.box.y + r.box.h + 4, lab, PAL.vangKim, 'right');
        }
      });
      if (st.extra) drawHu(ctx, p);
      ctx.restore();
      // bubble: Ông Táo + one line
      const B = L.bubble;
      A().panel(ctx, B, { fill: PAL.giayDo, border: PAL.vangKim, shadow: PAL.denSon, radius: 8, shadowY: 4, bw: 3 });
      const pc = A().portrait('ong_tao'), pw = Math.round(L.pp), px = B.x + L.pad, py = B.y + Math.round((B.h - pw) / 2);
      ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(pc, px, py, pw, pw); ctx.restore();
      const t = bubbleText(), key = t + '|' + L.tw + '|' + L.ts;
      if (key !== wrapKey) { wrapKey = key; wrapped = a.wrap(t, L.ts, L.tw); }
      const th = wrapped.length * L.lh, ty = B.y + Math.round((B.h - th) / 2);
      wrapped.forEach((ln, i) => A().text(ctx, ln, px + pw + L.pad * 1.5, ty + i * L.lh, { size: L.ts, color: PAL.denSon, outline: false, shadow: false }));
      // nav dots
      const n = pages().length, dw = 10, dg = 6, tot = n * dw + (n - 1) * dg, dx0 = Math.round(L.nav.x + L.nav.w / 2 - tot / 2), dy = Math.round(L.nav.y + L.nav.h / 2 - dw / 2);
      for (let i = 0; i < n; i++) { ctx.fillStyle = i === st.page ? PAL.vangKim : PAL.denSon; ctx.fillRect(dx0 + i * (dw + dg), dy, dw, dw); if (i !== st.page) { ctx.fillStyle = PAL.nauCanhGian; ctx.fillRect(dx0 + i * (dw + dg) + 2, dy + 2, dw - 4, dw - 4); } }
      btns.draw(ctx);
    }
    function drawHu(ctx, p) {
      const E = st.extra, sz = Math.round(clamp(L.ts + 2, 14, 22)), cy = Math.round(E.y + E.h / 2), tl = Math.round(E.x + E.w * 0.72), hl = Math.round(E.x + E.w * 0.3);
      const tt = st.hu < 0 ? 0 : clamp((st.hu - 0.2) / 0.7, 0, 1), e = 1 - Math.pow(1 - tt, 3), landed = st.hu >= 0.9;
      const total = p.total + (landed ? p.pot : 0);
      A().badge(ctx, TX.pages[7].tong + ': ' + total, tl, cy, { size: sz, fill: PAL.denSon, ink: PAL.vangKim, edge: PAL.vangKim });
      if (!landed) { const x = Math.round(hl + (tl - hl) * e), y = Math.round(cy - Math.sin(e * Math.PI) * E.h * 0.35); A().badge(ctx, TX.pages[7].hu + ': ' + p.pot, x, y, { size: sz, fill: PAL.vangKim, ink: PAL.denSon, edge: PAL.denSon }); }
      else if (st.hu < 1.5) A().badge(ctx, '+' + p.pot, tl, Math.round(cy - E.h * 0.38 - (st.hu - 0.9) * 14), { size: sz, fill: PAL.doSon, ink: PAL.giayDo, edge: PAL.vangKim });
      if (st.hu >= 0.1) { const r = st.rects[0]; if (r) txt(ctx, TX.pass, r.box.x + r.box.w / 2, r.box.y + r.box.h + 4 + st.lab * 1.3, st.lab, PAL.vangKim, 'center'); }
    }

    // ---------------------------------------------------------------- input
    function tapStage(x, y) {
      const p = page(); let gi = -1, ci = -1;
      for (let i = p.groups.length - 1; i >= 0 && gi < 0; i--) {
        const r = st.rects[i]; if (!r) continue;
        for (let j = r.cards.length - 1; j >= 0; j--) { const c = r.cards[j]; if (x >= c.x + r.ox && x <= c.x + c.w + r.ox && y >= c.y + r.oy - 12 && y <= c.y + c.h + r.oy + 6) { gi = i; ci = j; break; } }
      }
      if (p.mode === 'hu') { if (gi >= 0 || inR(L.stage, x, y)) { st.hu = st.hu >= 0 ? -1 : 0; if (st.hu === 0) U().snd('coin'); st.msg = ''; } return; }
      if (gi < 0) return;
      const q = p.groups[gi];
      if (p.mode === 'cmp') {
        const id = q.cards[ci], at = st.sel.indexOf(id);
        if (at >= 0) st.sel.splice(at, 1); else { st.sel.push(id); if (st.sel.length > 2) st.sel.shift(); }
        st.msg = st.sel.length === 2 ? cmpText(st.sel[0], st.sel[1]) : '';
        U().snd('select'); return;
      }
      if (p.mode === 'de' && !q.cand) return;
      if (p.mode === 'chat' && !q.chat) return;
      if (p.mode === 'tap' || p.mode === 'de' || p.mode === 'chat') { st.act = st.act === gi ? -1 : gi; st.t = 0; st.msg = st.act >= 0 ? q.say : ''; U().snd(st.act >= 0 ? 'select' : 'button'); }
    }
    function pointer(e) {
      if (!st) return;
      if (e.type === 'move') { btns.pointer(e); return; }
      if (e.type === 'down') {
        if (!inR(L.panel, e.x, e.y)) { close(); return; }
        dn = { x: e.x, y: e.y, btn: btns.pointer(e, act) }; return;
      }
      if (e.type === 'up') {
        const d = dn; dn = null; if (!d) return;
        if (d.btn) { btns.pointer(e, act); return; }
        const dx = e.x - d.x, dy = e.y - d.y;
        if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) { go(dx < 0 ? 1 : -1); return; }
        if (Math.abs(dx) < 14 && Math.abs(dy) < 14) tapStage(e.x, e.y);
      }
    }
    function act(id) { if (id === 'close') close(); else if (id === 'prev') go(-1); else if (id === 'next') go(1); }
    function key(e) { if (!st) return; if (e.key === 'esc') close(); else if (e.key === 'left') go(-1); else if (e.key === 'right' || e.key === 'enter' || e.key === 'space') go(1); }
    return { enter: enter, exit() { dn = null; }, resize() { lk = ''; wrapKey = ''; }, update: update, draw: draw, pointer: pointer, key: key };
  })();

  TL.Screens = TL.Screens || {};
  TL.Screens.luat = Luat;
})(globalThis.TL = globalThis.TL || {});
