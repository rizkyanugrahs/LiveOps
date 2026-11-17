"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useI18n } from "@/lib/i18n";
import { friendlyError } from "@/lib/supabase";
import { todayStr, monthStr, monthRange, addDays, formatDay, formatRupiah, pad } from "@/lib/dates";
import { toCSV, downloadText } from "@/lib/csv";
import GlassCard from "@/components/GlassCard";
import Notice from "@/components/Notice";

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

export default function GmvReport({ refreshKey = 0 }) {
  const { supabase } = useAuth();
  const { t, lang } = useI18n();
  const [mode, setMode] = useState("month");
  const [month, setMonth] = useState(monthStr());
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [rows, setRows] = useState([]);
  const [target, setTarget] = useState(0);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

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
    else { setMsg(""); setRows(res.data); }
    if (targetMonth) {
      const tg = await supabase.from("gmv_targets").select("target").eq("month", targetMonth).maybeSingle();
      setTarget(tg.data ? Number(tg.data.target) : 0);
    } else setTarget(0);
    setLoading(false);
  }, [supabase, range, targetMonth]);

  useEffect(() => { load(); }, [load, refreshKey]);

  // Dua tanggal selalu berurutan: kalau salah satu digeser melewati yang lain, yang lain ikut
  function changeFrom(v) { if (!v) return; setFrom(v); if (to < v) setTo(v); }
  function changeTo(v) { if (!v) return; setTo(v); if (from > v) setFrom(v); }

  const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const days = rows.length;
  const avg = days ? total / days : 0;
  const best = rows.reduce((b, r) => (!b || Number(r.amount) > Number(b.amount) ? r : b), null);
  const pct = target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 0;
  const maxAmount = rows.reduce((m, r) => Math.max(m, Number(r.amount || 0)), 0);

  function download() {
    const data = [["Tanggal", "GMV (Rp)"], ...rows.map((r) => [r.entry_date, Number(r.amount)]), ["Total", total]];
    downloadText("liveops-laporan-gmv.csv", toCSV(data));
  }

  const inputCls = "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-white/40";
  const stat = (label, value) => (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <p className="text-[11px] uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
  const monthLabel = formatDay(month + "-01", lang, { month: "long", year: "numeric" });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{t("gmvr_title")}</h2>
        <button onClick={download} disabled={!rows.length} aria-label={t("gmvr_download")} className="flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-200 disabled:opacity-40"><Download size={14} />CSV</button>
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
            <p className="mt-1 text-3xl font-semibold tracking-tight">{formatRupiah(total)}</p>
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
              <div className="mt-4 grid grid-cols-2 gap-2">
                {stat(t("gmvr_days"), days)}
                {stat(t("gmvr_avg"), formatRupiah(avg))}
                {best && stat(t("gmvr_best"), formatRupiah(best.amount) + " · " + formatDay(best.entry_date, lang, { day: "numeric", month: "short" }))}
              </div>
            )}
          </GlassCard>

          {rows.length > 1 && rows.length <= 62 && (
            <GlassCard>
              <div className="flex h-24 items-end gap-[3px]">
                {rows.map((r) => (
                  <div key={r.id} title={r.entry_date + ": " + formatRupiah(r.amount)} className="flex-1 rounded-t bg-white/70" style={{ height: Math.max(4, (Number(r.amount) / maxAmount) * 100) + "%" }} />
                ))}
              </div>
            </GlassCard>
          )}
        </>
      )}
    </div>
  );
}
