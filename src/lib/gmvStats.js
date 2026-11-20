import { monthRange, weekStart, addDays } from "@/lib/dates";

const has = (v) => v !== null && v !== undefined;

// Hari yang sudah punya hasil GMV (hari yang baru mengisi GMV awal tidak dihitung)
export function isRecorded(r) {
  return has(r.shopee_amount) || has(r.tiktok_amount) || Number(r.amount) > 0;
}

export function summarize(rows) {
  const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const days = rows.length;
  const best = rows.reduce((b, r) => (!b || Number(r.amount) > Number(b.amount) ? r : b), null);
  const shopeeRows = rows.filter((r) => has(r.shopee_amount));
  const tiktokRows = rows.filter((r) => has(r.tiktok_amount));
  const shopeeTotal = shopeeRows.reduce((s, r) => s + Number(r.shopee_amount || 0), 0);
  const tiktokTotal = tiktokRows.reduce((s, r) => s + Number(r.tiktok_amount || 0), 0);
  const counts = {};
  rows.forEach((r) => { if (r.partner) counts[r.partner] = (counts[r.partner] || 0) + 1; });
  return {
    total, days, best,
    avg: days ? total / days : 0,
    shopeeTotal, tiktokTotal,
    shopeeAvg: shopeeRows.length ? shopeeTotal / shopeeRows.length : null,
    tiktokAvg: tiktokRows.length ? tiktokTotal / tiktokRows.length : null,
    hasSplit: shopeeRows.length > 0 || tiktokRows.length > 0,
    partners: Object.entries(counts).sort((a, b) => b[1] - a[1]),
  };
}

// Perubahan persen terhadap periode sebelumnya; null jika tidak ada pembanding
export function compare(current, previous) {
  if (!previous || previous <= 0) return null;
  const change = ((current - previous) / previous) * 100;
  return { change, up: change > 0 ? true : change < 0 ? false : null };
}

// Nama partner yang muncul di data (untuk pilihan filter)
export function partnerNames(rows) {
  const set = new Set();
  rows.forEach((r) => { if (r.partner && r.partner.trim()) set.add(r.partner.trim()); });
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function filterByPartner(rows, partner) {
  if (!partner) return rows;
  const key = partner.trim().toLowerCase();
  return rows.filter((r) => r.partner && r.partner.trim().toLowerCase() === key);
}

// Minggu kalender (Senin-Minggu) di dalam satu bulan, lengkap dengan rincian tiap minggu
export function weekGroups(rows, month) {
  const { start, end } = monthRange(month);
  const byDate = {};
  rows.forEach((r) => { byDate[r.entry_date] = r; });
  const weeks = [];
  let cursor = start;
  while (cursor < end) {
    const monday = weekStart(cursor);
    const nextMonday = addDays(monday, 7);
    const wkStart = monday < start ? start : monday;
    const wkEnd = addDays(nextMonday, -1) >= end ? addDays(end, -1) : addDays(nextMonday, -1);
    const items = [];
    for (let d = wkStart; d <= wkEnd; d = addDays(d, 1)) if (byDate[d]) items.push(byDate[d]);
    const s = summarize(items);
    weeks.push({ index: weeks.length + 1, start: wkStart, end: wkEnd, rows: items, total: s.total, shopee: s.shopeeTotal, tiktok: s.tiktokTotal, hasSplit: s.hasSplit });
    cursor = nextMonday;
  }
  return weeks;
}
