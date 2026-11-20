// Hitungan untuk foto produk: foto diletakkan di bingkai persegi berlatar putih polos.
export const MIN_SCALE = 0.2;
export const MAX_SCALE = 2.5;
export const DEFAULT_SCALE = 0.85; // sisakan jarak aman di tepi bingkai

export function clampScale(s) { return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s)); }

// Skala agar foto pas di dalam bingkai (seluruh foto terlihat, tidak terpotong)
export function fitScale(iw, ih, frame) { return frame / Math.max(iw, ih); }

// Foto tidak boleh digeser sampai hilang dari bingkai
export function clampPan(dx, dy, frame) {
  const lim = frame / 2;
  return { dx: Math.min(lim, Math.max(-lim, dx)), dy: Math.min(lim, Math.max(-lim, dy)) };
}

// Posisi dan ukuran foto di dalam bingkai (satuan piksel bingkai)
export function placement(iw, ih, frame, scale, dx, dy) {
  const s = fitScale(iw, ih, frame) * scale;
  const w = iw * s;
  const h = ih * s;
  return { x: frame / 2 + dx - w / 2, y: frame / 2 + dy - h / 2, w, h };
}

// Menggambar hasil akhir: latar putih #FFFFFF lalu foto (PNG transparan tidak jadi hitam)
export function renderProductPhoto(createCanvas, source, iw, ih, frame, scale, dx, dy, outSize = 900) {
  const c = createCanvas(outSize, outSize);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outSize, outSize);
  const k = outSize / frame;
  const p = placement(iw, ih, frame, scale, dx, dy);
  ctx.drawImage(source, p.x * k, p.y * k, p.w * k, p.h * k);
  return c;
}
