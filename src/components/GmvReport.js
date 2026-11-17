"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Download, Loader2, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useI18n } from "@/lib/i18n";
import { friendlyError } from "@/lib/supabase";
import { todayStr, monthStr, monthRange, addDays, formatDay, formatRupiah } from "@/lib/dates";
import { toCSV, downloadText } from "@/lib/csv";
import GlassCard from "@/components/GlassCard";
import Notice from "@/components/Notice";
import Sheet from "@/components/Sheet";
import ConfirmDialog from "@/components/ConfirmDialog";

const MODES = [["month", "gmvr_mode_month"], ["date", "gmvr_mode_date"], ["range", "gmvr_mode_range"], ["monthly", "gmvr_mode_monthly"], ["all", "gmvr_mode_all"]];

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

export default function GmvReport({ refreshKey = 0, onChanged }) {
  const { supabase, user } = useAuth();
  const { t, lang } = useI18n();
  const [mode, setMode] = useState("month");
  const [date, setDate] = useState(todayStr());
  const [from, setFrom] = useState(monthRange(monthStr()).start);
  const [to, setTo] = useState(todayStr());
  const [month, setMonth] = useState(monthStr());
  const [rows, setRows] = useState([]);
  const [target, setTarget] = useState(0);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ id: null, entry_date: todayStr(), amount: "" });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(false);

  const range = useMemo(() => {
    if (mode === "month") return monthRange(monthStr());
    if (mode === "monthly") return monthRange(month);
    if (mode === "date") return { start: date, end: addDays(date, 1) };
    if (mode === "range") return { start: from, end: addDays(to, 1) };
    return null;
  }, [mode, date, from, to, month]);

  const targetMonth = mode === "month" ? monthStr() : mode === "monthly" ? month : null;
  const invalid = mode === "range" && (!from || !to || from > to);

  const load = useCallback(async () => {
    if (!supabase) return;
    if (invalid) { setRows([]); setLoading(false); return; }
    setLoading(true);
    const res = await fetchAll(supabase, range);
    if (res.error) { setMsg({ type: "error", text: friendlyError(res.error) }); setRows([]); }
    else setRows(res.data);
    if (targetMonth) {
      const tg = await supabase.from("gmv_targets").select("target").eq("month", targetMonth).maybeSingle();
      setTarget(tg.data ? Number(tg.data.target) : 0);
    } else setTarget(0);
    setLoading(false);
  }, [supabase, range, targetMonth, invalid]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const days = rows.length;
  const avg = days ? total / days : 0;
  const best = rows.reduce((b, r) => (!b || Number(r.amount) > Number(b.amount) ? r : b), null);
  const pct = target > 0 ? Math.min(100, Math.round((total / target) * 100)) : 0;
  const maxAmount = rows.reduce((m, r) => Math.max(m, Number(r.amount || 0)), 0);
  const desc = [...rows].reverse();

  function openAdd() {
    setForm({ id: null, entry_date: mode === "date" ? date : todayStr(), amount: "" }); setFormError(""); setOpen(true);
  }
  function openEdit(r) {
    setForm({ id: r.id, entry_date: r.entry_date, amount: String(Number(r.amount)) }); setFormError(""); setOpen(true);
  }

  async function save() {
    const value = Number(String(form.amount).replace(/[^0-9]/g, ""));
    if (!value) { setFormError(t("gmvr_amount_required")); return; }
    if (!form.entry_date) { setFormError(t("gmvr_date_label")); return; }
    setSaving(true); setFormError("");
    const payload = { entry_date: form.entry_date, amount: value };
    const res = form.id
      ? await supabase.from("gmv_entries").update(payload).eq("id", form.id)
      : await supabase.from("gmv_entries").upsert({ ...payload, user_id: user.id }, { onConflict: "user_id,entry_date" });
    setSaving(false);
    if (res.error) { setFormError(friendlyError(res.error)); return; }
    setOpen(false);
    setMsg({ type: "ok", text: t("gmvr_saved") });
    load();
    if (onChanged) onChanged();
  }

  async function doDelete() {
    setToDelete(false);
    const { error } = await supabase.from("gmv_entries").delete().eq("id", form.id);
    if (error) { setFormError(friendlyError(error)); return; }
    setOpen(false);
    setMsg({ type: "ok", text: t("gmvr_deleted") });
    load();
    if (onChanged) onChanged();
  }

  function download() {
    const data = [["Tanggal", "GMV (Rp)"], ...rows.map((r) => [r.entry_date, Number(r.amount)]), ["Total", total]];
    downloadText("liveops-laporan-gmv.csv", toCSV(data));
  }

  const inputCls = "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-white/40";
  const stat = (label, value) => (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <p className="text-[11px] uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold tracking-tight">{t("gmvr_title")}</h2>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {MODES.map(([k, label]) => (
          <button key={k} onClick={() => setMode(k)} className={"shrink-0 rounded-full border px-4 py-2 text-xs " + (mode === k ? "border-white bg-white text-black" : "border-white/10 text-zinc-300")}>{t(label)}</button>
        ))}
      </div>

      {mode === "date" && <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={inputCls} />}
      {mode === "monthly" && <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className={inputCls} />}
      {mode === "range" && (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-zinc-400">{t("gmvr_from")}<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls + " mt-1"} /></label>
          <label className="text-xs text-zinc-400">{t("gmvr_to")}<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls + " mt-1"} /></label>
        </div>
      )}

      <Notice>{invalid && from && to ? t("gmvr_invalid_range") : ""}</Notice>
      <Notice type={msg.type === "ok" ? "ok" : "error"}>{msg.text}</Notice>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-zinc-400" /></div>
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
            <div className="mt-4 grid grid-cols-2 gap-2">
              {stat(t("gmvr_days"), days)}
              {stat(t("gmvr_avg"), formatRupiah(avg))}
              {best && stat(t("gmvr_best"), formatRupiah(best.amount) + " · " + formatDay(best.entry_date, lang, { day: "numeric", month: "short" }))}
            </div>
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

          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{t("gmvr_entries")}</p>
            <div className="flex gap-2">
              <button onClick={download} disabled={!rows.length} className="flex items-center gap-1 rounded-full border border-white/10 px-3 py-2 text-xs text-zinc-200 disabled:opacity-40"><Download size={14} />CSV</button>
              <button onClick={openAdd} className="flex items-center gap-1 rounded-full bg-white px-3 py-2 text-xs font-medium text-black"><Plus size={14} />{t("gmvr_add")}</button>
            </div>
          </div>

          {rows.length === 0 ? (
            <GlassCard className="py-8 text-center text-sm text-zinc-400">{t("gmvr_empty")}</GlassCard>
          ) : (
            <ul className="space-y-2">
              {desc.map((r) => (
                <li key={r.id}>
                  <button onClick={() => openEdit(r)} className="glass flex w-full items-center justify-between rounded-2xl p-3 text-left">
                    <span className="text-sm">{formatDay(r.entry_date, lang, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
                    <span className="flex items-center gap-2 text-sm font-semibold">{formatRupiah(r.amount)}<Pencil size={13} className="text-zinc-500" /></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <Sheet open={open} title={form.id ? t("gmvr_edit") : t("gmvr_add")} onClose={() => !saving && setOpen(false)}>
        <div className="space-y-4">
          <Notice>{formError}</Notice>
          <label className="block text-xs text-zinc-400">{t("gmvr_date_label")}
            <input type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} className={inputCls + " mt-1"} />
          </label>
          <label className="block text-xs text-zinc-400">{t("gmvr_amount_label")}
            <input inputMode="numeric" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputCls + " mt-1"} />
          </label>
          <div className="flex gap-2">
            {form.id && <button onClick={() => setToDelete(true)} aria-label={t("delete")} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 text-red-300"><Trash2 size={18} /></button>}
            <button onClick={save} disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-medium text-black disabled:opacity-60">
              {saving && <Loader2 size={16} className="animate-spin" />}{t("save")}
            </button>
          </div>
        </div>
      </Sheet>
      <ConfirmDialog open={toDelete} danger message={t("gmvr_delete_confirm")} confirmLabel={t("delete")} onConfirm={doDelete} onCancel={() => setToDelete(false)} />
    </div>
  );
}
