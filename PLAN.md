# PLAN — Round 3 (đọc đầu mỗi phiên; làm từ ô chưa tick đầu tiên; thiết kế ở DESIGN.md mục "Round 3", bước n ↔ mục R ghi trong ngoặc)
- [ ] 1 Quick fixes, controls, easy Sòng bốn unlock, deal timing (R1)
- [ ] 2 Ultra-wide landscape phone layout (R2)
- [ ] 3 Performance: profiling, fixes, adaptive quality, perf guard + CLAUDE.md (R3)
- [ ] 4 Smaller popups on phones, skippable animations, Cây mai overlap (R4)
- [ ] 5 Art A: all opponent and boss portraits redone (R5)
- [ ] 6 Art B: all Quý nhân and Báu vật portraits redone (R5)
- [ ] 7 Logo and PWA icons (R6)
- [ ] 8 "Luật bài" guide in the menu (R7)
- [ ] 9 Motion overhaul: transitions and signature animations (R8)
- [ ] 10 Device matrix, perf budget, tests, README, live check (R9)

Next: Bước 1.

## Session protocol
- Start: read PLAN.md, the DESIGN.md sections for the first unticked step, SPEC.md Glossary, and only the API headers (top comments) of files you need; grep instead of reading whole files.
- Any change to game files: run `node tools/build-pwa.js` before commit (tests/pwa.check.js fails if sw.js is stale); bump ?v= in index.html when scripts change.
- Do exactly one step. Pick choices yourself; no questions to the user.
- Checks before commit: all tests in tests/ pass; headless index.html?auto&seed=1 reaches the end with zero console errors; Playwright screenshots of what you changed at 844×390, 390×844 and 1280×720, looked at and fixed (max 3 rounds).
- If the step grows past about 500 changed lines, commit and push the passing part, note it under the step in PLAN.md, and continue in a second commit.
- Finish: tick the box, update "Next:", commit with a clear message, git push origin main (never force-push), then reply with a 5-line Vietnamese report ending in "Xong bước n. Gõ /clear rồi dán prompt tiếp tục."
- Branch note: work on claude/epic-ride-nzubqn and also push it to main with `git push origin HEAD:main`.
- Round 3 checks also run node tests/perf.js once it exists, and Playwright at 915×412 (20:9 Android landscape) and 932×430 (iPhone Pro Max landscape).
