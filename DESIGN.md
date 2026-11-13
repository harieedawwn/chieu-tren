# DESIGN — vòng nâng cấp (D0–D10)
Mỗi bước trong PLAN.md ứng với một mục D cùng số (bước n ↔ D(n)). Giữ nguyên mọi quyết định và con số ở đây.

## D0 Nguyên tắc
- Giữ hướng nghệ thuật: bảng màu sơn mài từ CFG, màu phẳng, nền dither, pixel art ở tỉ lệ nguyên, KHÔNG gradient, glow hay neon. Ngoại lệ duy nhất: viền lửa pixel phẳng (aura) của Báu vật.
- Chữ Việt thuần theo SPEC Glossary (Nhân, Hũ, Tổng điểm, Lãi).
- Mọi con số nằm trong CFG. Logic thuần và có test. Hành vi 1v1 hiện có không đổi trừ khi nói rõ.
- Mỗi cơ chế mới có một bong bóng Ông Táo hiện một lần (kiểu bong bóng tutorial sẵn có, lưu localStorage).
- Thứ bậc kích thước ở mọi nơi: LỚN = bài trên tay, combo trên bàn, Hũ, Đánh/Bỏ; VỪA = Điểm × Nhân, Tổng điểm và mục tiêu; NHỎ = mọi thứ còn lại.

## D1 Sửa lỗi
(a) Báo cáo: đối thủ đánh heo, tứ quý K không chặt được; tứ quý 8 chặt được trước đó. Engine beats() trả 'chat' cho tứ quý vs heo đơn/đôi heo, nên nghi do boss Chú Ba (noChat) có luật hiện quá nhanh, hoặc có sám heo trên bàn.
- Thêm tests/chat.fuzz.js: 2000 ván seed với heo (đơn hoặc đôi) trên bàn và tứ quý trên tay người chơi, dưới mọi bộ mods; khẳng định Rules.legal có nước chặt trừ khi noChat; chạy cả đường chọn-bài hợp lệ của scene ở chế độ headless. Sửa bug thật nếu có.
(b) Thẻ luật boss: ở bàn trùm, phần giới thiệu thành một thẻ ở lại tới khi chạm/click/phím (bỏ qua chạm trong 1,2 s đầu): chân dung boss lớn, tên, câu thoại, rồi một dòng giải thích.
- Thêm `long` cho mọi luật nhà: Cấm chặt "Không ai được dùng tứ quý hay đôi thông để chặt heo."; Bà đi trước "Đối thủ luôn đánh trước mỗi ván."; Phải đè "Có bộ đè được thì không được bỏ lượt."; Sảnh đồng chất "Sảnh chỉ tính khi mọi lá cùng chất."; Cấm về bằng heo "Lượt đánh hết bài không được có heo."; Hai ván "Bàn này chỉ có 2 ván thay vì 3.".
- Trong bàn, luật ở lại trên bảng đối thủ như một chip; chạm để mở lại thẻ. Nước đi bị luật chặn thì nói rõ luật nào và chip rung (juice).
(c) Cài đặt: "Toàn màn hình" (Fullscreen API, có fallback webkit; nơi không hỗ trợ như iPhone Safari hiện "Thêm vào Màn hình chính để chơi toàn màn hình") và "Cài ứng dụng" (beforeinstallprompt; iOS hiện một dòng hướng dẫn).
- PWA: manifest.webmanifest (name Chiếu Trên, display fullscreen, orientation any, theme và background đen son, start_url và scope đúng cho subpath /chieu-tren/), icon 192, 512 và maskable PNG vẽ từ chính art của game (có script), service worker precache toàn bộ file game với cache có version và tự cập nhật khi deploy mới, chỉ đăng ký trên https.

## D2 Điện thoại ngang
844×390, 740×360, 932×430 đang lệch. Khi ngang và cao < 500:
- Cột trái ≤ 22% bề ngang, chỉ số gọn: mục tiêu và Tổng điểm, tên combo với Điểm × Nhân, ván, lượt đổi, lì xì, icon menu.
- Hàng Quý nhân: thẻ nhỏ dọc mép trên vùng chơi. Bảng đối thủ gọn ở trên bên phải. Bàn và Hũ ở giữa. Bài trên tay dọc mép dưới ở tỉ lệ nguyên lớn nhất vừa khung.
- Đánh, Bỏ, Gợi ý, Xếp thành một cột dọc ở mép phải, Đánh to nhất. Tôn trọng safe-area. Dọc và desktop phải ít nhất tốt như hiện tại.

## D3 Bài xấu thành lựa chọn
- Lượt đổi: mỗi bàn được CFG.DOI_PER_BAN = 2; đến lượt, khi đang dẫn vòng mới, chọn 1-3 lá và bấm Đổi (Rules.swap; lá bay ra, lá mới bay vào). Bộ đếm cạnh bộ đếm ván. Lượt đổi chưa dùng trả +1 lì xì mỗi cái lúc chia thưởng (dòng "Không đổi bài").
- Sức bài: lúc chia và sau mỗi lần Đổi, chấm điểm bài bằng planner của AI (số nước cần để hết bài, lá kiểm soát: heo, tứ quý, đôi thông) thành 1-3 sao nhỏ cạnh bài. 1 sao = "Bài xấu": ván đó, mỗi hũ người chơi ăn được nhân ×CFG.XAU_X (1.5) Nhân như một ScoreStep riêng tên "Bài xấu". Có test cho cả hai.

## D4 Nội dung
8 Quý nhân mới (thuong hoặc hiem; số trong CFG):
- ong_thay_tuong: Bài xấu thưởng ×2 thay vì ×1.5.
- co_ba_sai_gon: sảnh từ 5 lá trở lên ×2 Nhân.
- chu_ban_pho: mỗi hũ ăn liên tiếp +2 Nhân, cộng dồn; mất hũ thì về 0.
- anh_bo_doi: khi heo của bạn bị chặt: +3 lì xì và +5 Nhân ở nước đánh kế tiếp.
- ba_ngoai: mỗi lượt đổi chưa dùng lúc hết bàn +2 lì xì.
- cau_ut: kết thúc ván bằng một lá rác thì ×3 Nhân nước đó.
- chi_hang_ca: đè bằng lá đầu cao hơn đúng 1 bậc thì +20 Điểm.
- ong_giao: thưởng cóng ×2.
5 Báu vật, rarity 'bau', giá 12-15, xuất hiện từ chặng 2, tối đa một món mỗi shop, CFG.BAU_CHANCE 5% mỗi ô Quý nhân, sở hữu tối đa 2; mạnh nhưng có cái giá:
- than_tai: Lãi không giới hạn và trả 1 mỗi 4 lì xì; Đổi hàng tốn gấp đôi.
- ong_dia: mỗi heo còn trên tay khi bạn về nhất: +4 Nhân vĩnh viễn.
- tao_quan: mỗi bàn trùm vượt qua, mọi kiểu bài +1 cấp.
- vua_bai: ×2 Nhân mọi nước đánh; tối đa 2 lần Bỏ lượt mỗi ván.
- ca_chep: mỗi hũ ăn bằng sảnh +0,2× Nhân vĩnh viễn, nhân dồn.
Aura: viền lửa pixel phẳng chuyển động màu tím #6B2F7A và #A066B0 quanh thẻ, vài hạt bụi pixel trôi, tiếng ù thấp khi hover; khi xuất hiện trong shop, ô rung và con dấu "Báu vật!" đóng xuống. Tím chỉ dùng cho Báu vật.
Tranh: js/art3.js mới, bọc TL.Art như art2.js, phong cách Đông Hồ; Báu vật có khung đôi vàng kim chạm trổ. Hook điểm và run kèm test; số đếm Sổ tay gồm cả chúng.

## D5 Cảm giác
- Khí thế, mức 0-3, 3 chấm nhỏ cạnh bài. Tăng khi: ăn hũ, chặt, hoặc đánh nhanh tự tin (từ lúc đến lượt tới Đánh trong khoảng CFG 0,5 s – 2,2 s) khi xác suất thắng ước tính ≥ 0,6 (planner: số nước của bạn so với số lá và lá kiểm soát của đối thủ). Mất một mức khi đối thủ ăn hũ; đánh chậm chỉ ngừng tăng.
- Mỗi mức: popup ×1 → ×1,6, rung ×1 → ×2 (trần cứng 10 px), tick vút cao hơn, trống bass lớp dưới tick, đuôi pháo từ mức 2, nền đập nhanh hơn, viền HUD vàng kim → đỏ son, lửa trên ô điểm ở mức 3.
- Màn kết thắng ở lá cuối: hit-stop 120 ms, thời gian ×0,35 trong 0,7 s khi lá bay, zoom 1,08 vào bàn, vòng sóng pixel phẳng, một khung flash vàng kim, con dấu cực lớn "Về nhất.", pháo dây + trống + chiêng; cường độ theo Khí thế và số lá đối thủ còn lại; chạm để bỏ qua.
- Âm mới tạo bằng thủ tục như audio.js, to và nhiều lớp khi Khí thế cao, dưới limiter tổng. reducedMotion bỏ rung, zoom, flash.
- Bảng màu nền (CFG.MOODS): ba_noi men lam và giấy dó, chu_ba đỏ thẫm và đen, ong_sau xanh rêu, co_hai hồng hoa đào, bac_chin vàng đất, di_ut tím than; Sòng Giao thừa (đen và vàng kim, pháo hoa pixel phẳng xa); daily (lục); vô tận (tím than đậm dần theo chặng).

## D6 Meta (js/profile.js mới, thuần, localStorage có try/catch, có test)
- Tiếng tăm (XP) sau mỗi run thắng hay thua: mỗi bàn vượt, mỗi chặt, mỗi hũ ≥ mục tiêu, thưởng thắng, × hệ số Chiếu; cấp theo đường cong trong CFG; mỗi cấp 1 hoa mai.
- Cây mai: ~15 nút, 3 nhánh, mỗi nút tốn hoa mai. Nội dung (người mới có 14 Quý nhân trong pool; nút thêm nhóm Quý nhân, Quẻ, Báu vật). Khởi đầu (mở cách bắt đầu). Tiện ích (đổi nhỏ ngang hàng): +1 lượt đổi ở bàn đầu, ô giữ đồ trong shop mang một món sang shop sau, trần Lãi +1, lần reroll đầu mỗi shop rẻ hơn 1. Tổng sức mạnh của cây đầy phải nhỏ (kiểm ở bước 10).
- Khởi đầu: Mặc định; Con nhà nghèo (0 lì xì, trần Lãi +5); Con cưng (một Quý nhân hiếm ngẫu nhiên, mục tiêu +15%); Dân chơi (có dan_cho_lon, không có lượt đổi); Học trò (mọi kiểu bài cấp 2, 4 ô Quý nhân); Có lộc (2 Quẻ ngẫu nhiên).
- Chiếu 1-6, mở bằng cách thắng Chiếu trước, mỗi mức gồm các mức dưới: 2 mục tiêu +15%; 3 AI luôn max cấp; 4 trần Lãi −2; 5 boss chặng 3 có hai luật nhà; 6 "Chiếu trên": bớt một lượt đổi và bàn lớn cũng có luật nhà.
- Daily seed = yyyymmdd, Khởi đầu Mặc định, Chiếu 2, mỗi ngày một lượt, lưu kết quả.

## D7 Màn hình (js/modes.js và js/trans.js mới)
- "Chơi" ở title mở màn chọn chế độ: 4 thẻ lớn: Chơi thường; Thử thách ngày; Vô tận (khóa tới lần thắng đầu; vào thẳng vô tận); Sòng bốn (khóa tới Tiếng tăm cấp 3). Thẻ khóa hiện bóng đen và điều kiện mở.
- Rồi chọn Khởi đầu (thẻ xòe quạt, vuốt/mũi tên/phím) và Chiếu (thang chiếu, cao nhất là "Chiếu trên"), rồi Bắt đầu. Title hiện huy hiệu Chiếu cao nhất đã thắng và nút Cây mai: cây vẽ như cành mai pixel, nút nở hoa khi mua.
- Màn kết: thanh XP đếm lên kèm con dấu lên cấp, rồi hoa mai nhận được; daily có "Sao chép kết quả" (vd "Chiếu Trên 13/11 · Bàn 7 · Hũ lớn nhất 12.400").
- js/trans.js: chuyển cảnh dùng chung, easing outBack/outExpo, 350-700 ms: quét sơn mài (dải dither), quét chia bài (bài bay phủ màn rồi bay đi lộ cảnh sau), con dấu mở màn cho boss; phần tử màn mới vào lần lượt; reducedMotion dùng fade nhanh.

## D8 Engine 4 người (rules.js, ai.js, run.js; tests/rules4.test.js)
- newVan(opts) nhận opts.seats = 2 | 4 (mặc định 2, đường cũ không đụng). Ghế 0 người chơi, 1-3 AI theo thứ tự lượt. CFG.HAND_SIZE_4 = 10.
- Bỏ lượt là ra khỏi vòng hiện tại; vòng kết thúc khi mọi người khác đã bỏ, người đánh cuối ăn Hũ và dẫn. Luật chặt như 1v1.
- Ván kết thúc khi có người hết bài: người đó về nhất và nhận thưởng từ mọi ghế còn lại (lá còn, thối heo, cóng theo từng ghế). Chỉ hũ người chơi ăn được tính vào Tổng điểm. Mods áp cho mọi ghế.
- AI view thêm số lá mọi đối thủ và ai đã bỏ; tránh phí bom khi ghế kế tiếp còn ít lá.
- Test: 1000 ván 4 ghế seed kết thúc hợp lệ; bỏ-ra-vòng, chặt, thưởng cuối; test cũ vẫn qua.

## D9 Bàn 4 người
- Đối thủ là 3 chip gọn (ngang: trái, trên, phải của bàn; dọc: một hàng ba dưới thanh trên): chân dung, tên, số lá, số heo khi biết, vòng lượt, nhãn "Bỏ" khi đã bỏ trong vòng. Nước của họ bay vào giữa kèm thẻ tên nhỏ; nước cuối to, các nước trước trong vòng xếp nhỏ bên dưới. Theo thứ bậc kích thước của D2.
- Bàn trùm chặng 3 ở Chơi thường thành "Sòng Giao thừa": bạn vs boss và 2 người họ hàng, luật nhà của boss áp dụng, bảng màu riêng (D5), mục tiêu từ CFG; Ông Táo giải thích một lần. Chế độ Sòng bốn: mọi bàn trùm là 4 người.

## D10 Phát hành
- Mở rộng tests/sim.js cho Lượt đổi, Sức bài, Báu vật, Khởi đầu, Chiếu và chung kết 4 người. Chỉ chỉnh số, 300 run mỗi lượt, tối đa 4 lượt.
- Mục tiêu: Chiếu 1, Mặc định, cây rỗng: chặng 1 ≥ 85%, thắng run 25-40%; cây đầy thêm tối đa 6 điểm % thắng; Chiếu 6 thắng 3-10%; run có Báu vật thắng tối đa 1,6× trung bình; không Quý nhân nào quá 2× trung bình; tỉ lệ vượt Sòng Giao thừa khi tới được là 45-65%.
- Cập nhật README.md (tiếng Việt: chế độ, meta, thuật ngữ). Chạy đủ bộ test và ?auto với seed 1, 2, 3 và một seed Sòng bốn; push; mở https://harieedawwn.github.io/chieu-tren/ xác nhận bản mới và PWA cài được.
