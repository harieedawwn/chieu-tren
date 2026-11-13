# PLAN — Round 3 (đọc đầu mỗi phiên; làm từ ô chưa tick đầu tiên; thiết kế ở DESIGN.md mục "Round 3", bước n ↔ mục R ghi trong ngoặc)
- [x] 1 Quick fixes, controls, easy Sòng bốn unlock, deal timing (R1)
- [x] 2 Ultra-wide landscape phone layout (R2)
- [ ] 3 Performance: profiling, fixes, adaptive quality, perf guard + CLAUDE.md (R3)
- [ ] 4 Smaller popups on phones, skippable animations, Cây mai overlap (R4)
- [ ] 5 Art A: all opponent and boss portraits redone (R5)
- [ ] 6 Art B: all Quý nhân and Báu vật portraits redone (R5)
- [ ] 7 Logo and PWA icons (R6)
- [ ] 8 "Luật bài" guide in the menu (R7)
- [ ] 9 Motion overhaul: transitions and signature animations (R8)
- [ ] 10 Device matrix, perf budget, tests, README, live check (R9)

Next: Bước 3. Ghi chú bước 2: stage() compact (bàn thấp) cho tablePlay dùng hết chiều cao (ribbon nằm góc, y0 = table.y+6+rh/2), tableCardH ≈ cỡ lá tay (hệ số 0.98); ribbon đối thủ hiện tên người đang tới lượt (seatInfo/oppName) thay cho 'Đối thủ đang nghĩ'; index.html ?v=18. Chưa chạy Playwright WebKit. Ghi chú bước 1: nút Xếp bỏ khỏi bàn → Cài đặt có hàng 'Xếp bài' (Game.settings.sort rank|suit, phím S đảo, scene.applySort đồng bộ); nút: Đánh+Gợi ý ngang, Bỏ lượt giữa (đỏ son, cách ≥16 = HUD BGAP), Đổi dưới; ngang = một cột nút full-height bên phải (btn rộng ≥124 ở điện thoại), dọc = 2 hàng; Art.button(…, {face}); Quẻ: r.queSlot/queRow cạnh hàng Quý nhân (dọc: 7 cột + kho bài thành deckCol bên phải bàn); sao Sức bài có nhãn + r._suc chạm hiện bong bóng (TX.hud.sucTip); txt() co chữ tới 7 (fit:true tới 5) trước khi cắt '…', Ván dùng fit; Profile.noteBan + con dấu 'Mở khoá: Sòng bốn' (scene.soloUnlock, không ở ?auto), Sòng bốn mở khi thắng 1 bàn (save cũ: thắng run hoặc cấp 3); chia bài: CFG.MOTION.deal {fly .22, riffle .55, flicks 30, pow 1.4} lá k hạ đúng nhịp tiếng shuffle, âm không đổi. index.html ?v=17. Chưa kiểm tay con dấu mở khoá trong trình duyệt (chỉ test Profile).

## Session protocol
- Start: read PLAN.md, the DESIGN.md sections for the first unticked step, SPEC.md Glossary, and only the API headers (top comments) of files you need; grep instead of reading whole files.
- Any change to game files: run `node tools/build-pwa.js` before commit (tests/pwa.check.js fails if sw.js is stale); bump ?v= in index.html when scripts change.
- Do exactly one step. Pick choices yourself; no questions to the user.
- Checks before commit: all tests in tests/ pass; headless index.html?auto&seed=1 reaches the end with zero console errors; Playwright screenshots of what you changed at 844×390, 390×844 and 1280×720, looked at and fixed (max 3 rounds).
- If the step grows past about 500 changed lines, commit and push the passing part, note it under the step in PLAN.md, and continue in a second commit.
- Finish: tick the box, update "Next:", commit with a clear message, git push origin main (never force-push), then reply with a 5-line Vietnamese report ending in "Xong bước n. Gõ /clear rồi dán prompt tiếp tục."
- Branch note: work on claude/epic-ride-nzubqn and also push it to main with `git push origin HEAD:main`.
- Round 3 checks also run node tests/perf.js once it exists, and Playwright at 915×412 (20:9 Android landscape) and 932×430 (iPhone Pro Max landscape).
