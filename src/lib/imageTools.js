// Alat gambar untuk editor foto. createCanvas diberikan dari luar agar mudah diuji.

// Memutar kanvas 90 derajat (searah jarum jam atau sebaliknya)
export function rotateCanvas90(createCanvas, src, clockwise = true) {
  const c = createCanvas(src.height, src.width);
  const ctx = c.getContext("2d");
  if (clockwise) { ctx.translate(src.height, 0); ctx.rotate(Math.PI / 2); }
  else { ctx.translate(0, src.width); ctx.rotate(-Math.PI / 2); }
  ctx.drawImage(src, 0, 0);
  return c;
}

// Menyalin gambar ke kanvas dengan sisi terpanjang maksimal maxSide
export function toCanvas(createCanvas, source, w, h, maxSide) {
  const f = Math.min(1, maxSide / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * f));
  const ch = Math.max(1, Math.round(h * f));
  const c = createCanvas(cw, ch);
  c.getContext("2d").drawImage(source, 0, 0, cw, ch);
  return c;
}
