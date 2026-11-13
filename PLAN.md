# PLAN — vòng nâng cấp (đọc đầu mỗi phiên; làm từ ô chưa tick đầu tiên; thiết kế ở DESIGN.md)
- [x] 1 Fixes: heo-chặt fuzz test, boss rule card, fullscreen + PWA (D1)
- [x] 2 Landscape-phone layout and size hierarchy (D2)
- [x] 3 Bad hands: Lượt đổi and Sức bài (D3)
- [x] 4 Content: 8 Quý nhân, 5 Báu vật with aura, js/art3.js (D4)
- [x] 5 Feel: Khí thế, winning finale, louder layered sounds, special palettes (D5)
- [ ] 6 Meta logic: profile, Tiếng tăm, Cây mai, Khởi đầu, Chiếu, daily seed; tests (D6)
- [ ] 7 Screens: mode select, pickers, Cây mai screen, XP on end screen, transitions (D7)
- [ ] 8 4-player engine, AI and run integration; tests (D8)
- [ ] 9 4-player table UI, Sòng Giao thừa, Sòng bốn mode (D9)
- [ ] 10 Balance sim, full checks, README, live check (D10)

Next: Bước 6 (D6 meta: profile.js, Tiếng tăm, Cây mai, Khởi đầu, Chiếu, daily seed; tests). Ghi chú bước 5: js/khi.js (TL.Khi thuần: make/gain/lose/onVong/onChat/fast/winProb; tests/khi.test.js), CFG.KHI/FINALE/MOODS trong content.js; scene.js giữ `khi` theo bàn (reset ở startBan), khiDo/setKhi, FX.khi (popup ×, rung ×, trần 10), BG.setKhi (tốc độ nền) và BG.setMood nhận tên CFG.MOODS (bàn trùm dùng info.opp; giao_thua/daily/vo_tan chờ bước 9/6); hud.js drawKhi (3 chấm) + viền theo mức + lửa ở mức 3; màn thắng startFinale/finale (FX.hitStop/timeScale/zoom/ring/flash, FX.stamp {big,hold}, chạm để bỏ qua; không chạy ở ?auto); audio cue mới bass/pao/paoday/khi/finale; TL.Screens.table._khi(lv) cho test/ảnh. index.html ?v=11.
Ghi chú bước 4: CFG.QN4 / CFG.BAU (content.js), 13 thẻ mới trong D.QUY_NHAN (Báu vật rarity 'bau', D.BAU_IDS; không vào QN_IDS/pack, roll dùng rng riêng); hook ở scoring.js (ctx.last cho Cậu Út), rules.js (mods.passMax, state.passes), run.js (payout: Bà ngoại/Thần Tài/Táo Quân); art3.js (A.aura vẽ viền lửa tím, dùng ở shop.js và hud.js); cue 'hum'; tests/bau.test.js, art3.check.js. index.html ?v=10. Ghi chú bước 3: Run.doiBai + run.doi, AI.strength (CFG.SUC_BAI), bước Bài xấu trong scorePlay (run.van.xau), nút Đổi (phím D) và sao ở hud.js; bộ đếm lượt đổi nằm trên nhãn nút Đổi. Kèm sửa chọn nhầm lá: Sprite.hit không còn phóng to theo hover. Ghi chú bước 2: HUD.layout nhánh `short` (h < CFG.LAYOUT.shortBelow=500): cột trái 22%, cột nút dọc bên phải (Đánh to nhất), bài tay scale x2. headless.js seed 1 cần CAP=580000 trên máy chậm (baseline cũng vậy).

## Session protocol
- Start: read PLAN.md, the DESIGN.md sections for the first unticked step, SPEC.md Glossary, and only the API headers (top comments) of files you need; grep instead of reading whole files.
- Any change to game files: run `node tools/build-pwa.js` before commit (tests/pwa.check.js fails if sw.js is stale); bump ?v= in index.html when scripts change.
- Do exactly one step. Pick choices yourself; no questions to the user.
- Checks before commit: all tests in tests/ pass; headless index.html?auto&seed=1 reaches the end with zero console errors; Playwright screenshots of what you changed at 844×390, 390×844 and 1280×720, looked at and fixed (max 3 rounds).
- If the step grows past about 500 changed lines, commit and push the passing part, note it under the step in PLAN.md, and continue in a second commit.
- Finish: tick the box, update "Next:", commit with a clear message, git push origin main (never force-push), then reply with a 5-line Vietnamese report ending in "Xong bước n. Gõ /clear rồi dán prompt tiếp tục."
- Branch note: work on claude/epic-ride-nzubqn and also push it to main with `git push origin HEAD:main`.
