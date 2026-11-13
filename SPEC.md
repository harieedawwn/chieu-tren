**Chiếu Trên** — Tiến Lên Miền Nam 1v1 vs AI inside a Balatro-style roguelike run, Tết theme. SPEC wins over code. Units: px = CSS px, time = s, angles = deg. Terms (one name each): **ván** one deal · **vòng** plays until a pass (player-facing: **Hũ**) · **bàn** one target table · **chặng** group of 3 bàn · **Điểm bàn** (player-facing: **Tổng điểm**) score banked on the bàn · **chặt** a cross-type or heo-killing beat · **lì xì** money.

## 1 Scope
In: full run of 3 chặng × 3 bàn; 1v1 Tiến Lên; ăn vòng scoring; 8 Quý nhân; 6 Sao chiếu mệnh; 3 luật nhà bosses; Chợ Tết shop; save/continue; settings.
Added after v1 (see §12): 20 Quý nhân, 6 Quẻ, Bao lì xì, 6 luật nhà, endless mode, Sổ tay (collection). Out (do not build): bùa, chữ ông đồ, card editions, 3-player tables, skipping tables, events between tables, music.

## 2 Files
Path (purpose) · owner job. Only the owner edits a file; BALANCE may change number values in config.js only.
- index.html, style.css, js/main.js (loop, input, settings, screens), js/hud.js (HUD layout/draw/hit) · HUD
- SPEC.md, js/config.js (tunables), js/data.js (content) · SPEC
- js/cards.js (deck, combos, beats), js/rules.js (ván engine), js/ai.js (opponent), tests/rules.test.js · RULES
- js/scoring.js (Điểm × Thế, Quý nhân/Sao effects), js/run.js (run state, shop, save), tests/run.test.js, tests/sim.js (full-run bot sim) · BALANCE
- js/art.js (pixel art, font, UI draw helpers), demo/art.html · ART
- js/fx.js (queue, tweens, popups, shake, particles), js/sprite.js (springy card sprites), demo/fx.html · FX
- js/bg.js (swirl background, CRT), js/audio.js (synth sound), demo/atmos.html · ATMOS
- js/scene.js (Screens.table incl. Quẻ slots) · TABLE
- js/content.js (extra Quý nhân, Quẻ, Bao lì xì, luật nhà, TEXT), js/art2.js (art for them), js/shop.js (Chợ Tết screen), js/collection.js (Sổ tay, title/end wrappers) · see §12
- js/tutorial.js (Ông Táo guided ván, Chợ Tết tour, boss tip) · TUTORIAL
- js/screens.js (Screens.title, shop incl. payout, end, settings) · SCREENS
- js/luat.js ("Luật bài" guide overlay, 9 pages; opened from Cài đặt and offered once before the first ván) · SCREENS

## 3 Modules and API
Classic scripts, no ES modules, no bundler; opens by double-click on file:// and on GitHub Pages. Every file: `(function (TL) { ... })(globalThis.TL = globalThis.TL || {});`. Logic files (config data cards rules ai scoring run) touch no DOM and load in Node via require(). Every file starts with an API header comment ≤ 20 lines, one line per public function; integrators read only that. Script order in index.html: config, data, cards, rules, ai, scoring, run, art, fx, sprite, bg, audio, hud, scene, tutorial, screens, main. Two canvases: `#bg` (BG) under `#game` (transparent, everything else).
- config: `TL.CFG` (keys below), `TL.makeRng(seed) → () → [0,1)` (mulberry32), `TL.fmt(n) → "1.660"`.
- data: `TL.DATA = {QUY_NHAN, SAO, CHANG, HOUSE_RULES, COMBO_NAME, TEXT}` (shapes in js/data.js header).
- cards: `TL.Cards.{makeDeck() → Card[52], label(id) → "10♦", sortHand(ids, 'rank'|'suit') → ids, detect(ids) → Combo|null, beats(combo, onTable, mods) → false|'beat'|'chat', legalPlays(hand, onTable, mods) → Combo[], isHeo(id) → bool}`. onTable null = leading (any combo, 'beat').
- rules: `TL.Rules.{newVan(opts) → VanState, play(state, seat, cardIds) → Event[], pass(state, seat) → Event[], legal(state, seat) → {plays: Combo[], canPass}, view(state, seat) → View, winner(state) → 0|1|null}`. opts = `{rng, handSize, leader?: 0|1, mods, scoreFn, hands?: [id[], id[]] (fixed deal, tutorial)}`; `scoreFn(seat, combo, ctx) → Score`, ctx = `{chat, target: Combo|null, pot, lead}`, injected so rules never imports scoring. Illegal play/pass → `[]`, no change. Events also append to `state.log`; newVan's initial events are already in `state.log`.
- ai: `TL.AI.choose(view, level 1-3) → {type:'play', cardIds} | {type:'pass'}`. Uses only the View (own hand, `played`, `oppCount`, `table`, `pot`, `legal`, `canPass`); cardIds always from `view.legal`; params in `CFG.AI[level]`.
- scoring: `TL.Scoring.{scorePlay(run, seat, combo, ctx) → Score (pure), onEvent(run, event) → ScoreStep[] (sole owner of Quý nhân state: stack, Heo đất counter/break), vanBonus(run, vanEndEvent) → Score (pure; player win = bonus, opponent win = −THOI_PENALTY × player heo), preview(run, combo) → {diem, the, level}}`. preview = base + cards + Sao + Quý nhân, no chặt.
- run: `TL.Run.{create(seed) → run, ban(run) → BanInfo, startVan(run, opts?{hands}) → VanState (wires Rules.newVan with scoreFn → Scoring.scorePlay, sets reveal), record(run, events) (stats, Điểm bàn += pot on vong won by seat 0, lastWinner), endVan(run, vanEndEvent) → 'next'|'cleared'|'lost' (vanUsed++, applies vanBonus, floors Điểm bàn at 0), payout(run) → {lines:[{label, amount}], total} (applies once), shop(run) → ShopItem[], buy(run, i) → {ok, why?:'money'|'slots'|'sold'}, sell(run, slot) → {ok}, reroll(run) → {ok, why?}, nextBan(run) → 'ok'|'won', save(run) → string, load(str) → run|null}`. Screen order per event batch: `Scoring.onEvent` for each event, then `Run.record`.
- art: `TL.Art.{init() → Promise, W:48, H:64, PAL, card(cardId), back(), quyNhan(id), sao(id), portrait(oppId), icon(name), text(ctx, str, x, y, opts{size,color,align,outline,shadow}) (y = top of line box), textC(ctx, str, x, cy, opts) (cy = centre of the text body, from `measure` ink box), badge(ctx, str, cx, cy, opts) (rounded plate sized from its text), slot(ctx, rect) (recessed lacquer slot), panel(ctx, rect, opts{fill,border,shadow}), button(ctx, rect, label, state 'idle'|'hover'|'down'|'disabled')}`. card/back/quyNhan/sao = canvas 48×64; portrait 48×48 for all 9 `CHANG[].ban[].id`; icon 16×16, names: lixi van chang ban menu check cross star heo. `init` also loads font 'GameFont' (OFL, embedded base64 subset in art.js, no network).
- fx: `TL.FX.{speed, reducedMotion, offset:{x,y}, update(dt), draw(ctx), queue.add(fn, delay), queue.wait(cond) (blocks the queue until cond() is true), queue.busy() → bool, queue.clear(), tween(obj, props, dur, ease 'out'|'back'|'inout'|'spring'), counter(obj, key, to, dur), popup(text, x, y, kind 'diem'|'the'|'xthe'|'gold'|'bad', opts{center?}) (small badge starting just above (x, y) = top edge of its source), stamp(text, kind 'good'|'bad'|'gold'), shake(px), confetti(x, y, n), flame(rect, on)}`. `offset` = current shake offset, main applies it to the whole draw.
- sprite: `TL.Sprite.create({tex, x, y, scale}) → sprite {T, V, selected, hover, update(dt), draw(ctx), hit(x, y) → bool, juice(a), flip(tex), dissolve(dur, onDone)}`, `TL.Sprite.fan(sprites, rect, opts{overlap, curve})` sets targets. T and V = `{x, y, rot, sx, sy}` (target, visual); scale = integer art-pixel → device-pixel factor.
- bg: `TL.BG.{init(canvas), setMood('ban'|'boss'|'shop'|'title'), pulse(a), crt(on), render(t)}`; reads canvas size each render.
- audio: `TL.Audio.{unlock(), play(name, {pitch, vol}), setMuted(b)}`; names in §11. unlock() on first pointer/key.
- hud: `TL.HUD.{layout(w, h) → rects, draw(ctx, vm, rects), hit(rects, x, y) → buttonId|null}`. Rect = `{x,y,w,h}`. rects: `mode:'landscape'|'portrait'`, `panel` (landscape) | `topBar` (portrait), `qnRow`, `qnSlot[5]`, `oppSeat`, `oppHand`, `deck`, `table`, `pot`, `comboBox`, `diemBox`, `theBox`, `hand`, `btn{danh,bo,goiy,xep,menu}`. vm: `{chang:{idx,name}, ban:{idx,kind,name}, target, diemBan, pot, combo:{name,level}|null, diem, the, vanLeft, vanMax, lixi, oppId, oppName, house:{name,quote}|null, oppCount, oppHeo:int|null, oppReveal:id[], qn:(QnSlot|null)[5], turn:0|1, canPlay, canPass, busy, sortMode:'rank'|'suit', msg:string|null, flames:bool}`. HUD draws chrome only (not cards or opponent fan; those are sprites in TABLE). `?hud` draws the HUD with a fake vm, no game.
- main: `TL.Game.{ctx, w, h, dpr, scale, run, settings{sound, speed, scanlines, reducedMotion}, setScreen(name, args), autoResult}`. w, h in px; ctx pre-scaled by dpr, smoothing off; scale = integer art scale (CFG.LAYOUT). `setScreen('settings')` opens an overlay over the paused current screen; `setScreen('back')` closes it. Screen = `{enter(args), exit(), update(dt), draw(ctx), pointer({type:'down'|'move'|'up', x, y, id}), key({key:'enter'|'space'|'h'|'s'|'esc'})}`; `TL.Screens.{table, title, shop, end, settings}`. Flags: `?hud`, `?auto` (AI plays seat 0 at CFG.AUTO_SPEED, sets `Game.autoResult = {result:'won'|'lost', stats}` and logs it), `?seed=N`.

CFG top-level keys: HAND_SIZE CHAT_X LEFT_PTS THOI_X CONG_X THOI_PENALTY TOI_TRANG_X · BASE CARD_PTS SAO_GAIN QN · VAN_PER_BAN START_MONEY PAYOUT UNUSED_VAN_PTS INTEREST_PER INTEREST_MAX TARGETS AI_BY_CHANG SHOP PRICE · AI · MOTION · PAL MOOD BG LAYOUT DEVICES · STORAGE SAVE_VERSION AUTO_SPEED.

## 4 Data shapes
- Card: `id 0-51`, `rank = id>>2` (0-12 = 3..A,2), `suit = id&3` (0-3 = ♠♣♦♥). Higher id = higher card. Hands and cards everywhere are ids; `makeDeck()` → `{id,rank,suit}[]`.
- Combo `{type:'rac'|'doi'|'sam'|'tuquy'|'sanh'|'doithong', cards: id[] ascending, top: id of highest card, len: cards.length}` (đôi thông len = 2 × pairs).
- ScoreStep `{kind:'base'|'card'|'sao'|'qn'|'chat'|'bonus', ref, diem?, the?, xThe?, xPot?, slot?, dissolve?, label}`. ref = combo type | card id | sao id | qn id | 'chat' | 'veNhat'|'thoi'|'cong'|'toiTrang'. xThe multiplies the running Thế (running bonus for 'bonus'). xPot only on 'chat'. slot = Quý nhân slot (popup source). dissolve:true = screen dissolves that slot. label = Vietnamese popup text.
- Score `{diem, the, total: floor(diem × the), steps: ScoreStep[], xPot?}`. xPot set on chặt plays (CHAT_X, or QN.CHO_LON_CHAT_X for seat 0 with Dân chơi Chợ Lớn); total excludes it.
- VanState `{hands:[id[],id[]] ascending, table: null|{combo, seat}, vongPlays:[{seat, combo}], pot, turn:0|1, leader:0|1, mods, plays:[n0,n1], played: id[] (all cards played this ván), log: Event[], over, winner: null|0|1, toiTrang: null|0|1, reveal: id[] (opponent cards shown by Thầy bói; set by Run.startVan, else [])}`. `state.hands` and `log` are private; the player never sees opponent hand except `reveal` (screen derives vm.oppHeo from hands[1] only if Cô hàng xóm owned).
- View `{seat, hand, oppCount, table, pot, turn, lead: bool (table is null), played, plays, mods, legal: Combo[], canPass}`.
- Event: see §8. Mods `{noChat?, mustBeat?, oppLeads?}`.
- RunState (plain JSON) `{v: CFG.SAVE_VERSION, seed, vanNo, phase:'ban'|'payout'|'shop'|'won'|'lost', chang:0-2, ban:0-2, money, qn: ({id, n}|null)[5] (n = Heo đất counter, else 0), sao: {rac,doi,sam,sanh,doithong,tuquy: level ≥ 1}, diemBan, vanUsed, lastWinner: null|0|1, van: {stack}, shop: {items: ShopItem[], rerolls}, paid, stats: {vans, wins, chat, bestPlay, bestPot, toiTrang}}`.
- BanInfo `{chang, ban, kind, name, opp (id), tag, house: id|null, rule: {name, quote}|null, mods, target, aiLevel, vanMax, vanUsed, vanLeft, diem, last: bool (chặng 3 bàn trùm)}`.
- ShopItem `{kind:'qn'|'sao', id, price, sold: bool}`. Shop = 2 distinct unowned Quý nhân + 2 distinct Sao.

## 5 Rules
- 52 cards; rank 3<4<…<10<J<Q<K<A<2 (2 = heo); suit ♠<♣<♦<♥. Seat 0 = player, 1 = opponent; each dealt CFG.HAND_SIZE (10); the rest unused. Shuffle: Fisher-Yates on `opts.rng`.
- Leader: first ván of a bàn → seat holding the lowest id; later ván → previous winner (`opts.leader`); `mods.oppLeads` forces seat 1.
- Combos: rác (1), đôi (2 same rank), sám (3), tứ quý (4), sảnh (3+ consecutive ranks, no heo), đôi thông (3+ consecutive pairs, no heo). Anything else → detect null.
- Beat: same type and len, higher top id (rank, then suit) → 'beat'. Chặt → 'chat': 3 đôi thông beats one heo; tứ quý beats one heo, đôi heo, 3 đôi thông, a lower tứ quý; đôi thông with ≥ 4 pairs beats one heo, đôi heo, 3 đôi thông, any tứ quý. Chặt chồng allowed (a chặt may itself be chặt). Leading: any combo. `mods.noChat` → 'chat' never allowed.
- `mods.mustBeat`: pass is illegal while any beat exists (both seats). Leader cannot pass. A seat with no legal play must pass.
- 1v1: a pass ends the vòng. The last seat that played wins the vòng, takes the pot, and leads the next vòng.
- Ăn vòng: each play adds `score.total` to the pot; a chặt sets `pot = (pot + score.total) × (score.xPot ?? CFG.CHAT_X)`. The vòng winner takes the pot (seat 0's pot → Điểm bàn; seat 1's is lost). Emptying a hand ends the ván: that seat wins the current vòng (and pot), then vanEnd.
- Tới trắng: a seat dealt tứ quý of 2s wins at once; events deal, toiTrang, vanEnd (no turns, no pot).
- Ván bonus (Scoring.vanBonus, player wins): `left × LEFT_PTS` × `THOI_X` per heo the loser holds × `CONG_X` if the loser never played × `TOI_TRANG_X` on tới trắng; `left` = loser's cards (their full hand on tới trắng). Opponent wins: −`THOI_PENALTY` per heo the player holds (Điểm bàn floors at 0).

## 6 Scoring
Điểm × Thế = Balatro chips × mult. Order of steps, each a ScoreStep:
1. `base`: CFG.BASE[type]; Thế = the + extra × (units beyond 3) (units = cards for sảnh, pairs for đôi thông).
2. `card` per card, in id order: Điểm = CFG.CARD_PTS[rank].
3. `sao` (Sao → combo: Thổ Tú→rác, Thủy Diệu→đôi, Vân Hớn→sám, Thái Dương→sảnh, Mộc Đức→đôi thông, Thái Bạch→tứ quý): if level L > 1: + (L−1) × CFG.SAO_GAIN[type] Điểm and Thế.
4. `qn` in slot order: Chú xe ôm sảnh + XE_OM_DIEM × len Điểm; Thằng bạn thân + run.van.stack Thế (stack = BAN_THAN_THE per pass of seat 0 since last play); Heo đất + slot.n Thế on every play; Bà bán xôi rác + BAN_XOI_THE Thế; Ông đồ đôi + ONG_DO_THE Thế. Thầy bói and Cô hàng xóm have no score effect.
5. `chat` last, on chặt only: label "Chặt!", xPot = CHAT_X (QN.CHO_LON_CHAT_X for seat 0 with Dân chơi Chợ Lớn).
total = floor(Điểm × Thế). Opponent plays: steps 1-2 only, plus step 5 if chặt. Quý nhân state changes live only in `onEvent`: play by seat 0 → stack = 0; pass by seat 0 with Thằng bạn thân → stack += BAN_THAN_THE (step on that slot); vong won by seat 0 with a play containing heo → Heo đất n += 1; chat with victim 0 and target containing heo → Heo đất slot removed (step dissolve:true, label TEXT.stamp.heoVo); deal with Thầy bói → one 'qn' step, no payload.

## 7 Run
- Chặng (`DATA.CHANG`): Ông Táo, Tất niên, Giao thừa; each = Bàn nhỏ, Bàn lớn, Bàn trùm (boss with luật nhà: Bà Nội oppLeads, Chú Ba noChat, Ông Sáu mustBeat). Nine named opponents, AI level `CFG.AI_BY_CHANG[chang]`.
- Targets `CFG.TARGETS[chang][ban]` (placeholder 300/450/600, 1000/1500/2000, 3000/4500/6000). Each bàn up to `VAN_PER_BAN` (3) ván. After each ván: Điểm bàn ≥ target → 'cleared'; else vanUsed = max → 'lost'; else 'next'. Clearing chặng 3's bàn trùm → `nextBan` = 'won' ("Mùng Một"). Mid-ván pot ≥ target changes only visuals (flames).
- Ván seed = `(run.seed + 7919 × run.vanNo) >>> 0`. Quý nhân effects persist for the run; Điểm bàn, vanUsed, lastWinner reset each bàn.
- Money = lì xì: start `START_MONEY` 4. Payout on 'cleared': `PAYOUT[kind]` (3/4/5) + `UNUSED_VAN_PTS` × unused ván + bỏ ống `min(INTEREST_MAX, floor(held / INTEREST_PER))` (held before this payout). Lines: base (TEXT.kind name), unused, interest.
- Shop after each cleared bàn except the last: 2 Quý nhân + 2 Sao; Sao price `PRICE.SAO` 3, Quý nhân `PRICE.QN[id]`; buying a Sao raises its level by 1; reroll cost `REROLL_BASE + REROLL_STEP × rerolls` (2, 3, 4…, resets per shop); sell Quý nhân for `floor(price × SELL_RATIO)`; `SHOP.QN_SLOTS` 5 slots.
- Save: `Run.save` after each ván end, payout and shop change, to `localStorage[CFG.STORAGE.save]`; continue resumes at `phase` and replays the same ván seed (no mid-ván save). Cleared on won/lost.

## 8 Events
All carry `type`. Seats are 0|1. `log` is private (contains hands).
- `deal {hands:[id[],id[]], leader}` · `turn {seat, lead}` · `play {seat, combo, score, pot}` (pot after adding score.total, before ×) · `chat {seat, victim, target: Combo, combo, xPot, pot}` (pot after ×) · `pass {seat}` · `vong {winner, pot, combo}` (combo = winner's last play; pot taken) · `vanEnd {winner, left:[n0,n1], heo:[n0,n1], cong: bool, toiTrang: bool, pot}` · `toiTrang {seat, cards}`.
- Order. newVan: `deal`, then `turn {leader, lead:true}`; or, if a seat holds tứ quý heo, `deal, toiTrang, vanEnd`.
- play: `play`, then `chat` if chặt; if hand empty → `vong`, `vanEnd`; else `turn {other, lead:false}`.
- pass: `pass`, `vong {winner: other}`, `turn {winner, lead:true}`.
- vanEnd.cong = loser's `plays` is 0; heo = heo cards each seat still holds.

## 9 Look
- Balatro's screen anatomy, Vietnamese lacquer identity. Landscape: left info panel (bàn name + target, Điểm bàn, combo name + level, blue Điểm box × red Thế box, ván left, lì xì, chặng/bàn, menu); right: Quý nhân row on top (5 slots), opponent seat top-right (plate, name, luật nhà, face-down fan), table centre with pot counter, player hand bottom, action buttons bottom-right (Đánh, Bỏ lượt, Gợi ý, Xếp). Portrait phones (w/h < `LAYOUT.portraitBelow`): compact top bar replaces the panel; combo box above the hand.
- Six core colours, flat fills only (`CFG.PAL`): đen son #1B1412, nâu cánh gián #4A2418, đỏ son #A3271F, vàng kim #D9A441, men lam #2E5E8C, giấy dó #EADCC0; plus one muted leaf green. No gradients, glow, neon or bloom. Flat dark offset shadows under panels, cards, buttons.
- Pixel art 48×64 per card, drawn at integer device-pixel `Game.scale`, smoothing off. J/Q/K in Đông Hồ woodblock style; trống đồng card back; a tiny Đông Hồ pig on every heo. Quý nhân and Sao are 48×64 cards too.
- Font 'GameFont': chunky, full Vietnamese diacritics, 2 px dark outline + flat drop shadow; line height leaves room for stacked marks.
- Background: slow swirling lacquer, 3 flat bands with ordered dithering at `BG.lowW` resolution, colours from `MOOD[mood]`; optional faint scanlines (`BG.scanAlpha`). Mood: title, ban, boss (bàn trùm), shop.

## 10 Motion
All numbers in `CFG.MOTION` (keys: speeds spring lean hover sway lift deal juice play shake popup counter dissolve stamp button bg flame confetti aiThink bigScore).
- Every object has target T and visual V; V follows T by critically damped spring (`spring`), never teleports. Moving cards lean into velocity (`lean`).
- Hover: scale up with overshoot, pseudo-3D tilt toward the pointer, larger shadow (`hover`). Idle hand sway with per-card phase (`sway`). Selected cards lift (`lift`).
- Deal: cards fly from the deck with stagger and flip by squashing width (`deal`). `juice(a)`: short damped scale + rotation wobble on every trigger.
- Play: cards fly to the table (`play.fly`); then each ScoreStep fires in order with a popup at its source (blue "+N" Điểm, red "+N Thế" / "×N Thế"); Điểm/Thế boxes count (`counter`) and juice; tick pitch rises per step (`tickPitch`, `tickStep`); the total slams into the pot with shake scaled by log(score) (`shake`). Popups back-ease in, drift up, fade.
- Trauma shake capped at `shake.max` (8 px). Dissolve = per-pixel noise burn with vàng kim then đỏ son edge (chặt victims, sold Quý nhân, broken Heo đất). Stamps slam in big and settle. Buttons press into their shadow. Background speeds up briefly on a total ≥ `bigScore` (`BG.pulse`).
- When a pot ≥ target: small flat pixel flames on the Điểm/Thế boxes (`flame`, vm.flames).
- Speed 1×/2×/3× divides every delay and duration (not springs). Reduced motion removes shake, sway, tilt.
- Logic is computed first; results play back through `FX.queue`; input locked while `queue.busy()`. Opponent moves after `aiThink`.

## 11 Sound
Realistic, no music, no chiptune; synthesised with WebAudio (noise, filters, resonant bodies), no audio files. Cues: deal, flip, select, place, tick (wood clapper, pitch param), mult, chat (firecrackers + gong), vong, venhat (drums), thua, stamp, button, hover, coin, buy, sell, dissolve, gong, shuffle. Triggers: deal/shuffle at ván start; select on card toggle; place on play; tick per ScoreStep; mult on Thế step; chat on chặt; vong on vòng won; venhat on ván won; thua on ván lost; coin on lì xì gain; gong on boss intro and bàn clear.

## 12 Screens and input
- title: Chơi mới, Chơi tiếp (only if a save exists), Cài đặt. table: the play screen. payout then shop (both in `Screens.shop`): payout lines, then Chợ Tết (2 Quý nhân + 2 Sao, reroll, sell, Đi tiếp). end: win/lose + stats. settings overlay: Âm thanh, Tốc độ, Scanlines, Giảm chuyển động (saved to `CFG.STORAGE.settings`, every localStorage call in try/catch; defaults sound on, speed 1, scanlines off, reducedMotion from prefers-reduced-motion).
- Tap/click cards to select/deselect. Buttons: Đánh (selected cards), Bỏ lượt, Gợi ý (cycles legal plays by selecting them), Xếp (toggle rank/suit). Keys: Enter = Đánh, Space = Bỏ lượt, H = Gợi ý, S = Xếp, Esc = menu/close overlay. Pointer events cover mouse and touch.
- A legal selection previews combo name, level and Điểm × Thế (`Scoring.preview`) in the combo box; an illegal one shows TEXT.msg.illegal / cantBeat / noChat.

## 12b Tutorial
- `TL.Tutorial` (js/tutorial.js). Starts on the first Chơi mới (flags `{main, shop, boss}` in `CFG.STORAGE.tut`, every localStorage call in try/catch); replayable from settings (Hướng dẫn → Chơi lại, new run); `Bỏ qua hướng dẫn` in every bubble sets all flags. `?auto` never runs it.
- Guide: Ông Táo (`Art.portrait('ong_tao')`), a speech bubble that types out 1-2 short lines, a dimmed screen with the target lit by a pulsing outline and a bouncing pointer. The bubble is placed by a grid search so it never overlaps the lit element or the cards just played. A step needs a tap (`Tiếp`, Enter, Space) or the real action (select these cards, then Đánh); other taps only pulse the highlight.
- Scripted first ván (bàn 1, Thím Út): fixed deal (`Rules.newVan opts.hands`) and scripted opponent (`Tutorial.oppMove`): lead đôi 3, opp đè đôi 5, you choose đè đôi 9, opp passes (ăn vòng), lead Q, opp heo, tứ quý 8 chặt (ăn vòng), last card, ván bonus (lá còn lại, thối heo), Mục tiêu reached, Qua bàn. Scoring steps run at half speed. The table queue pauses at gates (`afterScore`, `afterVong`, `afterVan`, `beforePay`, `boss`) through `FX.queue.wait`.
- Chợ Tết tour on the first visit (3 taps: Quý nhân, Sao, lì xì) and one bubble on the first bàn trùm (luật nhà). Screens expose `tutRects()`.

## 13 Acceptance
1. index.html opens by double-click on file:// and loads with zero console errors.
2. `node tests/rules.test.js` and `node tests/run.test.js` pass.
3. Every rule in §5 is enforced and covered by a test (combos, beats, chặt table, chặt chồng, pot formula, vanBonus, tới trắng, all 3 mods).
4. Scoring matches §6 for every Quý nhân and Sao (tested).
5. A full run is winnable and losable (`tests/sim.js` reaches both; win rate of a decent bot reported).
6. No softlock: every state has a legal action; AI always returns a legal action.
7. Save/continue restores the exact point; corrupt or old-version save is ignored without error.
8. Fits all `CFG.DEVICES` (360×640, 390×844, 844×390, 768×1024, 1024×768, 1366×768, 1920×1080): no overlap, buttons ≥ 44 px, hand readable.
9. Touch and mouse both play a full ván; keys work.
10. Settings persist; reduced motion removes shake, sway, tilt; speed 3× is not broken.
11. Visuals follow §9 (six colours, flat, no glow); all Vietnamese text renders with correct diacritics.
12. A full `?auto&seed=N` run ends with `Game.autoResult` set and zero console errors.

## 12 Glossary (player-facing text; code keys unchanged: the, diemBan, vong, pot, xThe, sao)
| Code / old name | Player sees | Notes |
|---|---|---|
| the, Thế | **Nhân** | "Điểm × Nhân"; popups "+3 Nhân", "×2 Nhân" |
| vòng, ống vòng (pot) | **Hũ** | "Ăn trọn vòng." → "Ăn hũ." |
| Điểm bàn | **Tổng điểm** | |
| Bỏ ống (interest) | **Lãi** | |
| Sao chiếu mệnh | **Sao** | "nâng cấp một kiểu bài" |
| Quẻ | **Quẻ** | one-use item, 2 slots, bought in Chợ Tết, used at the table |
| Bao lì xì | **Bao lì xì** | shop item: open, pick 1 of 3 random Quý nhân or Quẻ |
Kept as real terms: heo, chặt, đè, đôi, sám, sảnh, đôi thông, tứ quý, rác, thối heo, cóng, tới trắng, bỏ lượt, Lì xì, Quý nhân, Chợ Tết, Bàn nhỏ/lớn/trùm, Luật nhà.
Style: effect first, plain, with its number ("Đôi: +3 Nhân."). Flavour quote optional, at most 6 words, only when clearly funny. Tutorial lines: instructions of 14 words or fewer saying what to do and why. No invented folk phrasing.
Content lives in js/content.js (extends TL.DATA and TL.CFG: QN2, QUE, HOUSE2, RARITY_W). Rarity: thường (plain), hiếm (men lam), quý (vàng kim).

## 13 Added systems (v2)
- Run: `run.que` (2 slots), `run.seen`, `run.bosses` (house rule per chặng, drawn without repeats from 6), `run.flags.x2Next`, `run.vanExtra`, `run.pack`, `run.endless`; SAVE_VERSION 2 (v1 saves migrate). Shop = 2 Quý nhân (rarity 70/25/5, never owned) + 2 Sao + 1 Quẻ + 1 Bao lì xì. `Run.useQue`, `openPack`/`choosePack`, `continueEndless` (targets ×CFG.ENDLESS.TARGET_X per chặng after the 3rd).
- Rules: mods `sameSuitStraight`, `noHeoFinish`, `twoVans`; `Rules.swap`; `state.reveal[seat]` (Soi bài) and `state.peek` (Thầy bói); `view.oppHand` only while revealed.
- Screens: Chợ Tết in js/shop.js, Sổ tay in js/collection.js (seen set in localStorage `chieutren.seen`), "Chơi tiếp: vô tận" on the win screen. Flags: `?auto&endless`.
- Tests: rules2, qn, que (node), art2.check (node), headless.js (Chromium).
