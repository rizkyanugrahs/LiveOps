"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Loader2, TrendingUp, TrendingDown, Check } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useI18n } from "@/lib/i18n";
import { friendlyError } from "@/lib/supabase";
import { todayStr, monthStr, monthRange, addDays, formatDay, formatRupiah, pad } from "@/lib/dates";
import { PLATFORMS } from "@/lib/shifts";
import { summarize, compare, partnerNames, filterByPartner, weekGroups, isRecorded } from "@/lib/gmvStats";
import { drawGmvReport } from "@/lib/gmvImage";
import { jpegToPdf } from "@/lib/pdf";
import GlassCard from "@/components/GlassCard";
import Notice from "@/components/Notice";
import Sheet from "@/components/Sheet";

const MODES = [["month", "gmvr_tab_month"], ["range", "gmvr_tab_range"], ["all", "gmvr_tab_all"]];

async function fetchAll(supabase, range) {
  const all = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase.from("gmv_entries").select("*").order("entry_date", { ascending: true });
    if (range) q = q.gte("entry_date", range.start).lt("entry_date", range.end);
    const { data, error } = await q.range(from, from + 999);
    if (error) return { error };
    all.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return { data: all };
}

function shiftMonth(m, delta) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 1 + delta, 1);
  return d.getFullYear() + "-" + pad(d.getMonth() + 1);
}

// Deret angka untuk mini chart: harian untuk periode pendek, bulanan untuk periode panjang
function buildSeries(rows, mode, month, from, to) {
  const byDate = {};
  rows.forEach((r) => { byDate[r.entry_date] = Number(r.amount || 0); });
  if (mode === "month") {
    const { start, end } = monthRange(month);
    const out = [];
    for (let d = start; d < end; d = addDays(d, 1)) out.push(byDate[d] || 0);
    return { values: out, from: "1", to: String(out.length), monthly: false };
  }
  if (rows.length === 0) return { values: [], from: "", to: "", monthly: false };
  const first = mode === "range" ? from : rows[0].entry_date;
  const last = mode === "range" ? to : rows[rows.length - 1].entry_date;
  const span = Math.round((new Date(last + "T00:00:00") - new Date(first + "T00:00:00")) / 86400000) + 1;
  if (span <= 62) {
    const out = [];
    for (let d = first; d <= last; d = addDays(d, 1)) out.push(byDate[d] || 0);
    return { values: out, from: first.slice(5), to: last.slice(5), monthly: false };
  }
  const byMonth = {};
  rows.forEach((r) => { const k = r.entry_date.slice(0, 7); byMonth[k] = (byMonth[k] || 0) + Number(r.amount || 0); });
  const keys = Object.keys(byMonth).sort();
  const out = [];
  for (let m = keys[0]; m <= keys[keys.length - 1]; m = shiftMonth(m, 1)) out.push(byMonth[m] || 0);
  return { values: out, from: keys[0], to: keys[keys.length - 1], monthly: true };
}

export default function GmvReport({ refreshKey = 0, backHref }) {
  const { supabase, profile } = useAuth();
  const { t, lang } = useI18n();
  const [mode, setMode] = useState("month");
  const [month, setMonth] = useState(monthStr());
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [rows, setRows] = useState([]);
  const [prevRows, setPrevRows] = useState(null); // data bulan sebelumnya (tampilan Bulan)
  const [target, setTarget] = useState(0);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [scope, setScope] = useState(""); // "" = semua partner
  const [exporting, setExporting] = useState("");

  const range = useMemo(() => {
    if (mode === "month") return monthRange(month);
    if (mode === "range") return { start: from, end: addDays(to, 1) };
    return null;
  }, [mode, month, from, to]);

  const targetMonth = mode === "month" ? month : null;

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const res = await fetchAll(supabase, range);
    if (res.error) { setMsg(friendlyError(res.error)); setRows([]); }
    else { setMsg(""); setRows(res.data.filter(isRecorded)); }
    if (targetMonth) {
      const tg = await supabase.from("gmv_targets").select("target").eq("month", targetMonth).maybeSingle();
      setTarget(tg.data ? Number(tg.data.target) : 0);
      const pr = await fetchAll(supabase, monthRange(shiftMonth(targetMonth, -1)));
      setPrevRows(pr.data ? pr.data.filter(isRecorded) : null);
    } else { setTarget(0); setPrevRows(null); }
    setLoading(false);
  }, [supabase, range, targetMonth]);

  useEffect(() => { load(); }, [load, refreshKey]);

  function changeFrom(v) { if (!v) return; setFrom(v); if (to < v) setTo(v); }
  function changeTo(v) { if (!v) return; setTo(v); if (from > v) setFrom(v); }

  const stats = useMemo(() => summarize(rows), [rows]);
  const pct = target > 0 ? Math.min(100, Math.round((stats.total / target) * 100)) : 0;
  const chart = useMemo(() => buildSeries(rows, mode, month, from, to), [rows, mode, month, from, to]);
  const chartMax = chart.values.reduce((m, v) => Math.max(m, v), 0);
  const weeks = useMemo(() => (mode === "month" ? weekGroups(rows, month) : []), [rows, mode, month]);
  const names = useMemo(() => partnerNames(rows), [rows]);

  const pctFmt = new Intl.NumberFormat(lang === "id" ? "id-ID" : "en-GB", { maximumFractionDigits: 1 });
  const prevLabel = targetMonth ? formatDay(shiftMonth(targetMonth, -1) + "-01", lang, { month: "long", year: "numeric" }) : "";
  const prevTotal = prevRows ? summarize(prevRows).total : 0;
  const comparison = targetMonth ? compare(stats.total, prevTotal) : null;
  const partnerText = stats.partners.slice(0, 4).map(([n, c]) => n + " (" + c + " " + t("gmvr_days_unit") + ")").join(", ");
  const monthLabel = formatDay(month + "-01", lang, { month: "long", year: "numeric" });
  const periodLabel = mode === "month" ? monthLabel : mode === "range"
    ? formatDay(from, lang, { day: "numeric", month: "short", year: "numeric" }) + (from === to ? "" : " – " + formatDay(to, lang, { day: "numeric", month: "short", year: "numeric" }))
    : t("gmvr_period_all");

  function openExport() {
    if (!rows.length) { setMsg(t("gmvr_nothing")); return; }
    setScope("");
    setExportOpen(true);
  }

  // Laporan yang diunduh: semua GMV, atau hanya sesi bersama satu partner (semua angka ikut menyesuaikan)
  async function exportReport(kind) {
    const subset = scope ? filterByPartner(rows, scope) : rows;
    if (!subset.length) { setMsg(t("gmvx_filtered_empty").replace("{name}", scope)); setExportOpen(false); return; }
    setExporting(kind);
    setMsg("");
    try {
      const s = summarize(subset);
      const prevSubset = prevRows ? (scope ? filterByPartner(prevRows, scope) : prevRows) : null;
      const cmp = targetMonth ? compare(s.total, prevSubset ? summarize(prevSubset).total : 0) : null;
      const cmpText = cmp ? (cmp.up === true ? "▲ " : cmp.up === false ? "▼ " : "") + pctFmt.format(Math.abs(cmp.change)) + "%" : "";
      const series = buildSeries(subset, mode, month, from, to);
      const platforms = s.hasSplit ? [
        { label: PLATFORMS.shopee.label, valueText: formatRupiah(s.shopeeTotal), hex: PLATFORMS.shopee.hex },
        { label: PLATFORMS.tiktok.label, valueText: formatRupiah(s.tiktokTotal), hex: "#000000", border: true },
      ] : null;
      const pText = s.partners.slice(0, 4).map(([n, c]) => n + " (" + c + " " + t("gmvr_days_unit") + ")").join(", ");
      const canvas = drawGmvReport((w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }, {
        title: t("gmvr_report_title"),
        period: periodLabel + (scope ? " · " + scope : ""),
        name: profile && profile.full_name ? profile.full_name : "",
        totalLabel: t("gmvr_total").toUpperCase(),
        totalText: formatRupiah(s.total),
        comparison: targetMonth ? (cmp ? { text: cmpText, up: cmp.up, note: t("gmvr_vs_last").replace("{m}", prevLabel) } : { text: "–", up: null, note: t("gmvr_no_prev") }) : null,
        stats: [
          { label: t("gmvr_avg"), value: formatRupiah(s.avg) },
          { label: t("gmvr_days"), value: String(s.days) },
          { label: t("gmvr_best"), value: s.best ? formatRupiah(s.best.amount) : "-", sub: s.best ? formatDay(s.best.entry_date, lang, { day: "numeric", month: "short" }) : "" },
        ],
        platforms,
        partnerLabel: t("gmvr_partner").toUpperCase(),
        partnerText: pText || t("gmvr_no_partner"),
        series: series.values,
        chartTitle: series.monthly ? t("gmvr_chart_monthly") : t("gmvr_chart_daily"),
        chartFrom: series.from,
        chartTo: series.to,
        footer: t("shift_image_footer"),
      });
      const slug = scope ? "-" + scope.toLowerCase().replace(/[^a-z0-9]+/g, "-") : "";
      const baseName = "liveops-laporan-gmv-" + (mode === "month" ? month : mode === "range" ? from + "_" + to : "semua") + slug;
      const save = (blob, name) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      };
      if (kind === "png") {
        const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
        if (!blob) throw new Error("png");
        save(blob, baseName + ".png");
      } else {
        const jpg = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.92));
        if (!jpg) throw new Error("jpg");
        const bytes = new Uint8Array(await jpg.arrayBuffer());
        save(new Blob([jpegToPdf(bytes, canvas.width, canvas.height)], { type: "application/pdf" }), baseName + ".pdf");
      }
      setExportOpen(false);
    } catch (e) {
      setMsg(t("gmvr_export_failed") + " (" + (e.message || e) + ")");
    } finally {
      setExporting("");
    }
  }

  const inputCls = "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-white/40";
  const stat = (label, value) => (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <p className="text-[11px] uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
  const dayLabel = (d) => formatDay(d, lang, { weekday: "short", day: "numeric", month: "short" });
  const scopeBtn = (value, label) => (
    <button key={value || "all"} onClick={() => setScope(value)} className={"flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm " + (scope === value ? "border-white bg-white font-medium text-black" : "border-white/10 text-zinc-200")}>
      <span>{label}</span>{scope === value && <Check size={16} />}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {backHref && <Link href={backHref} aria-label={t("back")} className="glass flex h-9 w-9 items-center justify-center rounded-full"><ArrowLeft size={18} /></Link>}
          <h2 className={backHref ? "text-2xl font-semibold tracking-tight" : "text-lg font-semibold tracking-tight"}>{backHref ? t("gmvr_page_title") : t("gmvr_title")}</h2>
        </div>
        <button onClick={openExport} disabled={!rows.length} className="flex items-center gap-1.5 rounded-full border border-white/10 px-3.5 py-1.5 text-xs text-zinc-200 disabled:opacity-40"><Download size={14} />{t("gmvx_title")}</button>
      </div>

      <div className="glass grid grid-cols-3 rounded-full p-1">
        {MODES.map(([k, label]) => (
          <button key={k} onClick={() => setMode(k)} className={"rounded-full py-1.5 text-xs transition " + (mode === k ? "bg-white font-medium text-black" : "text-zinc-400")}>{t(label)}</button>
        ))}
      </div>

      {mode === "month" && (
        <div className="flex items-center justify-between">
          <button onClick={() => setMonth(shiftMonth(month, -1))} aria-label={t("shift_prev")} className="glass flex h-9 w-9 items-center justify-center rounded-full"><ChevronLeft size={18} /></button>
          <button onClick={() => setMonth(monthStr())} className="text-sm font-medium capitalize">{monthLabel}</button>
          <button onClick={() => setMonth(shiftMonth(month, 1))} aria-label={t("shift_next")} className="glass flex h-9 w-9 items-center justify-center rounded-full"><ChevronRight size={18} /></button>
        </div>
      )}
      {mode === "range" && (
        <div className="grid grid-cols-2 gap-2">
          <input type="date" aria-label={t("gmvr_from")} value={from} onChange={(e) => changeFrom(e.target.value)} className={inputCls} />
          <input type="date" aria-label={t("gmvr_to")} value={to} onChange={(e) => changeTo(e.target.value)} className={inputCls} />
        </div>
      )}

      <Notice>{msg}</Notice>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-zinc-400" /></div>
      ) : (
        <>
          <GlassCard>
            <p className="text-xs uppercase tracking-wide text-zinc-400">{t("gmvr_total")}</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight">{formatRupiah(stats.total)}</p>

            {targetMonth && (
              <p className="mt-2 flex items-center gap-2 text-xs">
                {comparison ? (
                  <>
                    <span className={"flex items-center gap-1 rounded-full px-2.5 py-1 font-medium " + (comparison.up === true ? "bg-emerald-400/15 text-emerald-300" : comparison.up === false ? "bg-rose-400/15 text-rose-300" : "bg-white/10 text-zinc-300")}>
                      {comparison.up === true ? <TrendingUp size={12} /> : comparison.up === false ? <TrendingDown size={12} /> : null}{pctFmt.format(Math.abs(comparison.change))}%
                    </span>
                    <span className="text-zinc-400">{t("gmvr_vs_last").replace("{m}", prevLabel)}</span>
                  </>
                ) : <span className="text-zinc-500">{t("gmvr_no_prev")}</span>}
              </p>
            )}

            {targetMonth && target > 0 && (
              <div className="mt-3">
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div className={"h-full rounded-full " + (pct >= 100 ? "bg-emerald-400" : "bg-white")} style={{ width: pct + "%" }} />
                </div>
                <p className="mt-2 flex justify-between text-xs text-zinc-400"><span>{t("gmvr_progress")}: <b className="text-white">{pct}%</b></span><span>{t("gmvr_target")}: <b className="text-white">{formatRupiah(target)}</b></span></p>
              </div>
            )}

            {rows.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-400">{t("gmvr_empty")}</p>
            ) : (
              <>
                {stats.hasSplit && (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {[["shopee", stats.shopeeTotal, stats.shopeeAvg], ["tiktok", stats.tiktokTotal, stats.tiktokAvg]].map(([k, v, a]) => (
                      <div key={k} className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <span className={"rounded-full px-2 py-0.5 text-[10px] font-medium " + PLATFORMS[k].cls}>{PLATFORMS[k].label}</span>
                        <p className="mt-2 text-sm font-semibold">{formatRupiah(v)}</p>
                        <p className="mt-0.5 text-[11px] text-zinc-400">{k === "shopee" ? t("gmvt_avg_shopee") : t("gmvt_avg_tiktok")}: {a === null ? "-" : formatRupiah(a)}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {stat(t("gmvr_days"), stats.days)}
                  {stat(t("gmvr_avg"), formatRupiah(stats.avg))}
                  {stats.best && stat(t("gmvr_best"), formatRupiah(stats.best.amount) + " · " + formatDay(stats.best.entry_date, lang, { day: "numeric", month: "short" }))}
                  {stat(t("gmvr_partner"), partnerText || t("gmvr_no_partner"))}
                </div>
                {chart.values.length > 1 && chartMax > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-[11px] uppercase tracking-wide text-zinc-500">{chart.monthly ? t("gmvr_chart_monthly") : t("gmvr_chart_daily")}</p>
                    <div className="flex h-16 items-end gap-[2px]">
                      {chart.values.map((v, i) => (
                        <div key={i} className="flex-1 rounded-t bg-white/70" style={{ height: v > 0 ? Math.max(6, (v / chartMax) * 100) + "%" : "2px", opacity: v > 0 ? 1 : 0.25 }} />
                      ))}
                    </div>
                    <p className="mt-1 flex justify-between text-[10px] text-zinc-500"><span>{chart.from}</span><span>{chart.to}</span></p>
                  </div>
                )}
              </>
            )}
          </GlassCard>

          {mode === "month" && (
            <div className="space-y-3 pt-1">
              <p className="px-1 text-xs font-medium uppercase tracking-wide text-zinc-400">{t("gmvw_title")}</p>
              {rows.length === 0 ? (
                <GlassCard className="py-6 text-center text-sm text-zinc-400">{t("gmvw_empty_month")}</GlassCard>
              ) : weeks.map((w) => (
                <GlassCard key={w.start} className="p-0">
                  <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
                    <div>
                      <p className="text-sm font-semibold">{t("gmvw_week").replace("{n}", w.index)}</p>
                      <p className="text-[11px] text-zinc-400">{formatDay(w.start, lang, { day: "numeric", month: "short" })}{w.start === w.end ? "" : " – " + formatDay(w.end, lang, { day: "numeric", month: "short" })}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wide text-zinc-500">{t("gmvw_subtotal")}</p>
                      <p className={"text-sm font-semibold " + (w.rows.length ? "" : "text-zinc-600")}>{w.rows.length ? formatRupiah(w.total) : "-"}</p>
                      {w.rows.length > 0 && w.hasSplit && (
                        <p className="mt-0.5 flex justify-end gap-2 text-[10px] text-zinc-400">
                          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: PLATFORMS.shopee.hex }} />{formatRupiah(w.shopee)}</span>
                          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full ring-1 ring-white/50" style={{ background: "#000" }} />{formatRupiah(w.tiktok)}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  {w.rows.length === 0 ? (
                    <p className="border-t border-white/5 px-4 py-3 text-xs text-zinc-500">{t("gmvw_empty_week")}</p>
                  ) : (
                    <ul className="divide-y divide-white/5 border-t border-white/5">
                      {w.rows.map((r) => {
                        const hasShopee = r.shopee_amount !== null && r.shopee_amount !== undefined;
                        const hasTiktok = r.tiktok_amount !== null && r.tiktok_amount !== undefined;
                        return (
                          <li key={r.id || r.entry_date} className="flex items-start justify-between gap-3 px-4 py-2.5">
                            <div className="min-w-0">
                              <p className="text-sm">{dayLabel(r.entry_date)}</p>
                              {(hasShopee || hasTiktok || r.partner) && (
                                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-zinc-400">
                                  {hasShopee && <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: PLATFORMS.shopee.hex }} />{formatRupiah(r.shopee_amount)}</span>}
                                  {hasTiktok && <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full ring-1 ring-white/50" style={{ background: "#000" }} />{formatRupiah(r.tiktok_amount)}</span>}
                                  {r.partner && <span className="text-zinc-500">· {r.partner}</span>}
                                </p>
                              )}
                            </div>
                            <p className="shrink-0 text-sm font-semibold">{formatRupiah(r.amount)}</p>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </GlassCard>
              ))}
            </div>
          )}
        </>
      )}

      <Sheet open={exportOpen} title={t("gmvx_title")} onClose={() => !exporting && setExportOpen(false)}>
        <div className="space-y-4">
          <p className="text-xs text-zinc-400">{t("gmvx_scope")}</p>
          <div className="space-y-2">
            {scopeBtn("", t("gmvx_all"))}
            {names.map((n) => scopeBtn(n, t("gmvx_partner_only").replace("{name}", n)))}
          </div>
          {names.length === 0 && <p className="text-[11px] text-zinc-500">{t("gmvx_no_partner_data")}</p>}
          <div className="grid grid-cols-2 gap-2">
            {[["png", t("gmvx_png")], ["pdf", t("gmvx_pdf")]].map(([k, label]) => (
              <button key={k} onClick={() => exportReport(k)} disabled={Boolean(exporting)} className="flex items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-medium text-black disabled:opacity-60">
                {exporting === k ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}{label}
              </button>
            ))}
          </div>
        </div>
      </Sheet>
    </div>
  );
}
