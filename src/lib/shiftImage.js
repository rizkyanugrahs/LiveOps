const FONT = "Helvetica, Arial, sans-serif";
const DOT = { off: "#71717a", morning: "#fcd34d", afternoon: "#7dd3fc", night: "#a5b4fc" };

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + "…").width > maxWidth) s = s.slice(0, -1);
  return s + "…";
}

// rows: [{ day, dateText, type, typeLabel, note, highlight }]
// Mengembalikan canvas yang sudah digambar (lebar 1080 px, tinggi menyesuaikan jumlah baris)
export function drawShiftImage(createCanvas, { title, subtitle, name, rows, footer }) {
  const W = 1080;
  const pad = 56;
  const headerH = name ? 296 : 250;
  const rowH = 96;
  const gap = 14;
  const footerH = 110;
  const H = headerH + rows.length * (rowH + gap) + footerH;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 0, 20, W / 2, 0, 700);
  glow.addColorStop(0, "rgba(255,255,255,0.10)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, 700);

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#a3a3a3";
  ctx.font = "600 28px " + FONT;
  ctx.fillText("LIVEOPS", pad, 86);

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 60px " + FONT;
  ctx.fillText(fitText(ctx, title, W - pad * 2), pad, 160);

  ctx.fillStyle = "#a3a3a3";
  ctx.font = "400 32px " + FONT;
  ctx.fillText(fitText(ctx, subtitle, W - pad * 2), pad, 210);
  if (name) {
    ctx.fillStyle = "#d4d4d4";
    ctx.font = "500 30px " + FONT;
    ctx.fillText(fitText(ctx, name, W - pad * 2), pad, 252);
  }

  let y = headerH;
  rows.forEach((r) => {
    roundRect(ctx, pad, y, W - pad * 2, rowH, 26);
    ctx.fillStyle = r.highlight ? "rgba(255,255,255,0.12)" : "rgba(23,23,23,0.95)";
    ctx.fill();
    ctx.lineWidth = r.highlight ? 2.5 : 1.5;
    ctx.strokeStyle = r.highlight ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.12)";
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 32px " + FONT;
    ctx.fillText(r.day, pad + 32, y + 42);
    ctx.fillStyle = "#a3a3a3";
    ctx.font = "400 26px " + FONT;
    ctx.fillText(r.dateText, pad + 32, y + 76);

    const x2 = pad + 290;
    if (r.type) {
      ctx.fillStyle = DOT[r.type] || "#71717a";
      ctx.beginPath();
      ctx.arc(x2, y + rowH / 2, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "600 34px " + FONT;
      ctx.fillText(r.typeLabel, x2 + 30, y + (r.note ? 46 : 58));
      if (r.note) {
        ctx.fillStyle = "#a3a3a3";
        ctx.font = "400 24px " + FONT;
        ctx.fillText(fitText(ctx, r.note, W - pad - 32 - (x2 + 30)), x2 + 30, y + 78);
      }
    } else {
      ctx.fillStyle = "#52525b";
      ctx.font = "400 34px " + FONT;
      ctx.fillText("-", x2, y + 58);
    }
    y += rowH + gap;
  });

  ctx.fillStyle = "#52525b";
  ctx.font = "400 24px " + FONT;
  ctx.textAlign = "center";
  ctx.fillText(footer, W / 2, H - 50);
  ctx.textAlign = "left";
  return canvas;
}
