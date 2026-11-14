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
