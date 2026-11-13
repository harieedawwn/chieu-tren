/* js/logo.js  (owner ART) R6 logo: lacquer-red square, woven chieu (mat) border in vang kim + nau, At co and heo co fanned in the middle.
 * API  TL.Art.logo()          -> canvas 96x96 (pixel art, transparent rounded corners)
 *      TL.Art.logoAt(px)      -> cached canvas px x px (integer scale when it divides, else smooth downscale)
 *      TL.Art.logoIcon(n, safe) -> opaque n x n canvas for PWA icons: logo at the largest integer scale inside n*safe, on den son
 */
(function (TL) {
  'use strict';
  const A = TL.Art, P = TL.CFG.PAL, N = 96, B = 8, CACHE = {};
  function build() {
    const c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    x.fillStyle = P.doSon; x.fillRect(0, 0, N, N);
    // woven border: diagonal over/under lozenges, gold and brown, ink line either side
    for (let y = 0; y < N; y++) for (let px = 0; px < N; px++) {
      const d = Math.min(px, y, N - 1 - px, N - 1 - y); if (d >= B) continue;
      let col;
      if (d === 0 || d === B - 1) col = P.denSon;
      else { const a = ((px + y) >> 1) & 3, b = ((px - y + 256) >> 1) & 3; col = (a + b) % 4 < 2 ? P.vangKim : P.nauCanhGian; if (((px + y) & 7) === 0 && ((px - y + 256) & 7) === 0) col = P.giayDo; }
      x.fillStyle = col; x.fillRect(px, y, 1, 1);
    }
    // inner lacquer field with a faint darker inset line
    x.fillStyle = P.denSon; x.fillRect(B, B, N - 2 * B, 1); x.fillRect(B, N - B - 1, N - 2 * B, 1); x.fillRect(B, B, 1, N - 2 * B); x.fillRect(N - B - 1, B, 1, N - 2 * B);
    // two cards: back = A co (47) slightly high-left, front = heo co (51) low-right; drop shadow = 1px den son rim
    const back = A.card(47), front = A.card(51);
    x.fillStyle = P.denSon; x.fillRect(10, 10, 50, 66); x.drawImage(back, 11, 11);
    x.fillStyle = P.denSon; x.fillRect(36, 18, 50, 66); x.drawImage(front, 37, 19);
    // round the four corners (3px stair)
    x.clearRect(0, 0, 3, 1); x.clearRect(0, 0, 1, 3); x.clearRect(1, 1, 1, 1);
    x.clearRect(N - 3, 0, 3, 1); x.clearRect(N - 1, 0, 1, 3); x.clearRect(N - 2, 1, 1, 1);
    x.clearRect(0, N - 1, 3, 1); x.clearRect(0, N - 3, 1, 3); x.clearRect(1, N - 2, 1, 1);
    x.clearRect(N - 3, N - 1, 3, 1); x.clearRect(N - 1, N - 3, 1, 3); x.clearRect(N - 2, N - 2, 1, 1);
    return c;
  }
  function logo() { return CACHE.base || (CACHE.base = build()); }
  function logoAt(px) {
    px = Math.max(8, Math.round(px)); const k = 'a' + px; if (CACHE[k]) return CACHE[k];
    const c = document.createElement('canvas'); c.width = c.height = px; const x = c.getContext('2d');
    x.imageSmoothingEnabled = px % N !== 0 && px < N; x.imageSmoothingQuality = 'high'; if (px % N === 0 || px > N) x.imageSmoothingEnabled = false;
    x.drawImage(logo(), 0, 0, px, px); return (CACHE[k] = c);
  }
  function logoIcon(n, safe) {
    const c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    x.fillStyle = P.denSon; x.fillRect(0, 0, n, n);
    const u = Math.max(1, Math.floor(n * safe / N)), s = N * u, o = Math.round((n - s) / 2);
    x.drawImage(logo(), o, o, s, s); return c;
  }
  A.logo = logo; A.logoAt = logoAt; A.logoIcon = logoIcon;
})(globalThis.TL = globalThis.TL || {});
