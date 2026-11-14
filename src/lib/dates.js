export function pad(n) { return String(n).padStart(2, "0"); }

export function todayStr() {
  const d = new Date();
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

export function monthStr(d = new Date()) {
  return d.getFullYear() + "-" + pad(d.getMonth() + 1);
}

export function monthRange(month) {
  const [y, m] = month.split("-").map(Number);
  const start = y + "-" + pad(m) + "-01";
  const next = new Date(y, m, 1);
  const end = next.getFullYear() + "-" + pad(next.getMonth() + 1) + "-01";
  return { start, end };
}

export function formatRupiah(n) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(n) || 0);
}

export function tenureParts(joinDate) {
  if (!joinDate) return null;
  const start = new Date(joinDate + "T00:00:00");
  const now = new Date();
  if (isNaN(start.getTime()) || start > now) return null;
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  let days = now.getDate() - start.getDate();
  if (days < 0) {
    months -= 1;
    days += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  }
  if (months < 0) { years -= 1; months += 12; }
  return { years, months, days };
}

export function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

// Senin sebagai awal minggu
export function weekStart(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const day = (d.getDay() + 6) % 7;
  return addDays(dateStr, -day);
}

export function formatDay(dateStr, lang, opts) {
  const d = new Date(dateStr + "T00:00:00");
  return new Intl.DateTimeFormat(lang === "id" ? "id-ID" : "en-GB", opts || { weekday: "short", day: "numeric", month: "short" }).format(d);
}

export function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
}

export function deadlineStatus(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  if (d < now) return "overdue";
  if (d.toDateString() === now.toDateString()) return "today";
  return "later";
}

export function formatDeadline(iso, lang) {
  if (!iso) return "";
  return new Intl.DateTimeFormat(lang === "id" ? "id-ID" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
