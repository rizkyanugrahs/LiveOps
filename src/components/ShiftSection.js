"use client";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Loader2, Trash2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useI18n } from "@/lib/i18n";
import { friendlyError } from "@/lib/supabase";
import { todayStr, monthStr, monthRange, addDays, weekStart, formatDay } from "@/lib/dates";
import GlassCard from "@/components/GlassCard";
import Notice from "@/components/Notice";
import Sheet from "@/components/Sheet";
import ConfirmDialog from "@/components/ConfirmDialog";

const TYPES = ["off", "morning", "afternoon", "night"];
const DOT = { off: "bg-zinc-500", morning: "bg-amber-300", afternoon: "bg-sky-300", night: "bg-indigo-300" };

export default function ShiftSection() {
  const { supabase, user } = useAuth();
  const { t, lang } = useI18n();
  const [view, setView] = useState("week");
  const [start, setStart] = useState(weekStart(todayStr()));
  const [month, setMonth] = useState(monthStr());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ id: null, shift_date: todayStr(), shift_type: "morning", note: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [toDelete, setToDelete] = useState(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    let from, to;
    if (view === "week") { from = start; to = addDays(start, 7); }
    else { const r = monthRange(month); from = r.start; to = r.end; }
    const { data, error } = await supabase.from("shifts").select("*").gte("shift_date", from).lt("shift_date", to).order("shift_date", { ascending: true });
    if (error) setMsg({ type: "error", text: friendlyError(error) });
    else setRows(data || []);
    setLoading(false);
  }, [supabase, view, start, month]);

  useEffect(() => { load(); }, [load]);

  function openForDate(date) {
    const existing = rows.find((r) => r.shift_date === date);
    if (existing) setForm({ id: existing.id, shift_date: existing.shift_date, shift_type: existing.shift_type, note: existing.note || "" });
    else setForm({ id: null, shift_date: date, shift_type: "morning", note: "" });
    setFormError(""); setOpen(true);
  }
  function openRow(row) {
    setForm({ id: row.id, shift_date: row.shift_date, shift_type: row.shift_type, note: row.note || "" });
    setFormError(""); setOpen(true);
  }

  async function save() {
    if (!form.shift_date) { setFormError(t("shift_date")); return; }
    setSaving(true); setFormError("");
    const payload = { shift_date: form.shift_date, shift_type: form.shift_type, note: form.note.trim() || null };
    const res = form.id
      ? await supabase.from("shifts").update(payload).eq("id", form.id)
      : await supabase.from("shifts").upsert({ ...payload, user_id: user.id }, { onConflict: "user_id,shift_date" });
    setSaving(false);
    if (res.error) { setFormError(friendlyError(res.error)); return; }
    setOpen(false);
    setMsg({ type: "ok", text: t("shift_saved") });
    load();
  }

  async function doDelete() {
    const row = toDelete;
    setToDelete(null);
    const { error } = await supabase.from("shifts").delete().eq("id", row.id);
    if (error) { setMsg({ type: "error", text: friendlyError(error) }); return; }
    setOpen(false);
    setMsg({ type: "ok", text: t("shift_deleted") });
    load();
  }

  const today = todayStr();
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const byDate = Object.fromEntries(rows.map((r) => [r.shift_date, r]));
  const inputCls = "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-white/40";

  return (
    <div className="space-y-4">
      <Notice type={msg.type === "ok" ? "ok" : "error"}>{msg.text}</Notice>

      <div className="grid grid-cols-2 gap-2">
        {[["week", "shift_week"], ["table", "shift_table"]].map(([k, label]) => (
          <button key={k} onClick={() => setView(k)} className={"rounded-xl border py-2 text-xs " + (view === k ? "border-white bg-white text-black" : "border-white/10 text-zinc-300")}>{t(label)}</button>
        ))}
      </div>

      {view === "week" ? (
        <>
          <div className="flex items-center justify-between">
            <button onClick={() => setStart(addDays(start, -7))} aria-label={t("shift_prev")} className="glass flex h-9 w-9 items-center justify-center rounded-full"><ChevronLeft size={18} /></button>
            <button onClick={() => setStart(weekStart(todayStr()))} className="text-sm text-zinc-300">{formatDay(start, lang, { day: "numeric", month: "short" })} – {formatDay(addDays(start, 6), lang, { day: "numeric", month: "short" })}</button>
            <button onClick={() => setStart(addDays(start, 7))} aria-label={t("shift_next")} className="glass flex h-9 w-9 items-center justify-center rounded-full"><ChevronRight size={18} /></button>
          </div>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-zinc-400" /></div>
          ) : (
            <ul className="space-y-2">
              {days.map((d) => {
                const r = byDate[d];
                return (
                  <li key={d}>
                    <button onClick={() => openForDate(d)} className={"glass flex w-full items-center gap-3 rounded-2xl p-3 text-left " + (d === today ? "ring-1 ring-white/40" : "")}>
                      <div className="w-20 shrink-0">
                        <p className="text-sm font-medium">{formatDay(d, lang, { weekday: "short" })}</p>
                        <p className="text-xs text-zinc-400">{formatDay(d, lang, { day: "numeric", month: "short" })}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        {r ? (
                          <>
                            <p className="flex items-center gap-2 text-sm"><span className={"h-2.5 w-2.5 rounded-full " + DOT[r.shift_type]} />{t("shift_" + r.shift_type)}</p>
                            {r.note && <p className="mt-0.5 truncate text-xs text-zinc-400">{r.note}</p>}
                          </>
                        ) : (
                          <p className="text-sm text-zinc-500">{t("shift_unset")}</p>
                        )}
                      </div>
                      {d === today && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-zinc-300">{t("shift_today_label")}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <label className="flex-1 text-xs text-zinc-400">{t("shift_month")}
              <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className={inputCls + " mt-1"} />
            </label>
            <button onClick={() => openForDate(todayStr())} className="mt-5 flex h-[42px] items-center gap-1 rounded-xl bg-white px-4 text-sm font-medium text-black"><Plus size={16} />{t("shift_add")}</button>
          </div>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-zinc-400" /></div>
          ) : rows.length === 0 ? (
            <GlassCard className="py-10 text-center text-sm text-zinc-400">{t("shift_empty")}</GlassCard>
          ) : (
            <div className="glass overflow-hidden rounded-2xl">
              <table className="w-full text-sm">
                <thead className="border-b border-white/10 text-left text-xs text-zinc-400">
                  <tr><th className="px-3 py-2 font-normal">{t("shift_date")}</th><th className="px-3 py-2 font-normal">{t("shift_type")}</th><th className="px-3 py-2 font-normal">{t("shift_note")}</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} onClick={() => openRow(r)} className="cursor-pointer border-b border-white/5 last:border-0 active:bg-white/5">
                      <td className="whitespace-nowrap px-3 py-2.5">{formatDay(r.shift_date, lang)}</td>
                      <td className="px-3 py-2.5"><span className="flex items-center gap-2"><span className={"h-2 w-2 rounded-full " + DOT[r.shift_type]} />{t("shift_" + r.shift_type)}</span></td>
                      <td className="max-w-[8rem] truncate px-3 py-2.5 text-xs text-zinc-400">{r.note || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <Sheet open={open} title={form.id ? t("shift_edit_title") : t("shift_add")} onClose={() => !saving && setOpen(false)}>
        <div className="space-y-4">
          <Notice>{formError}</Notice>
          <label className="block text-xs text-zinc-400">{t("shift_date")}
            <input type="date" value={form.shift_date} onChange={(e) => setForm({ ...form, shift_date: e.target.value })} className={inputCls + " mt-1"} />
          </label>
          <div>
            <p className="text-xs text-zinc-400">{t("shift_type")}</p>
            <div className="mt-1 grid grid-cols-4 gap-2">
              {TYPES.map((k) => (
                <button key={k} type="button" onClick={() => setForm({ ...form, shift_type: k })} className={"rounded-xl border py-2.5 text-xs " + (form.shift_type === k ? "border-white bg-white text-black" : "border-white/10 text-zinc-300")}>{t("shift_" + k)}</button>
              ))}
            </div>
          </div>
          <label className="block text-xs text-zinc-400">{t("shift_note")}
            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder={t("shift_note_ph")} className={inputCls + " mt-1"} />
          </label>
          <div className="flex gap-2">
            {form.id && (
              <button onClick={() => setToDelete({ id: form.id })} aria-label={t("delete")} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 text-red-300"><Trash2 size={18} /></button>
            )}
            <button onClick={save} disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-medium text-black disabled:opacity-60">
              {saving && <Loader2 size={16} className="animate-spin" />}{t("save")}
            </button>
          </div>
        </div>
      </Sheet>

      <ConfirmDialog open={Boolean(toDelete)} danger message={t("shift_delete_confirm")} confirmLabel={t("delete")} onConfirm={doDelete} onCancel={() => setToDelete(null)} />
    </div>
  );
}
