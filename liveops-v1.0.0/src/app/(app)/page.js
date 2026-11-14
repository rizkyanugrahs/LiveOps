"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Plus, Target, Radio, Loader2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useI18n } from "@/lib/i18n";
import { todayStr, monthStr, monthRange, formatRupiah } from "@/lib/dates";
import { friendlyError } from "@/lib/supabase";
import GlassCard from "@/components/GlassCard";
import Notice from "@/components/Notice";

const SHIFTS = ["off", "morning", "afternoon", "night"];

export default function HomePage() {
  const { supabase, user, profile } = useAuth();
  const { t, lang } = useI18n();
  const [ready, setReady] = useState(false);
  const [shift, setShift] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [achieved, setAchieved] = useState(0);
  const [target, setTarget] = useState(0);
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [showShiftPicker, setShowShiftPicker] = useState(false);
  const [panel, setPanel] = useState(""); // "", "target", "log"
  const [targetInput, setTargetInput] = useState("");
  const [logAmount, setLogAmount] = useState("");
  const [logDate, setLogDate] = useState(todayStr());

  const load = useCallback(async () => {
    if (!supabase || !user) return;
    const month = monthStr();
    const { start, end } = monthRange(month);
    const [s, tk, g, tg] = await Promise.all([
      supabase.from("shifts").select("*").eq("shift_date", todayStr()).maybeSingle(),
      supabase.from("tasks").select("*").eq("is_done", false).order("created_at", { ascending: false }).limit(50),
      supabase.from("gmv_entries").select("amount").gte("entry_date", start).lt("entry_date", end),
      supabase.from("gmv_targets").select("*").eq("month", month).maybeSingle(),
    ]);
    const firstError = [s, tk, g, tg].find((r) => r.error);
    if (firstError) setMsg({ type: "error", text: friendlyError(firstError.error) });
    setShift(s.data ? s.data.shift_type : null);
    const list = (tk.data || []).sort((a, b) => (a.priority === b.priority ? 0 : a.priority === "urgent" ? -1 : 1)).slice(0, 5);
    setTasks(list);
    setAchieved((g.data || []).reduce((sum, r) => sum + Number(r.amount || 0), 0));
    setTarget(tg.data ? Number(tg.data.target) : 0);
    setReady(true);
  }, [supabase, user]);

  useEffect(() => { load(); }, [load]);

  async function chooseShift(type) {
    setMsg({ type: "", text: "" });
    const { error } = await supabase.from("shifts").upsert({ user_id: user.id, shift_date: todayStr(), shift_type: type }, { onConflict: "user_id,shift_date" });
    if (error) { setMsg({ type: "error", text: friendlyError(error) }); return; }
    setShift(type);
    setShowShiftPicker(false);
  }

  async function toggleTask(task) {
    const { error } = await supabase.from("tasks").update({ is_done: true }).eq("id", task.id);
    if (error) { setMsg({ type: "error", text: friendlyError(error) }); return; }
    setTasks((prev) => prev.filter((x) => x.id !== task.id));
  }

  async function saveTarget() {
    const value = Number(String(targetInput).replace(/[^0-9]/g, ""));
    if (!value) { setMsg({ type: "error", text: lang === "id" ? "Isi target dengan angka lebih dari 0." : "Enter a target above 0." }); return; }
    const { error } = await supabase.from("gmv_targets").upsert({ user_id: user.id, month: monthStr(), target: value }, { onConflict: "user_id,month" });
    if (error) { setMsg({ type: "error", text: friendlyError(error) }); return; }
    setTarget(value); setPanel(""); setTargetInput("");
    setMsg({ type: "ok", text: t("gmv_target_saved") });
  }

  async function saveLog() {
    const value = Number(String(logAmount).replace(/[^0-9]/g, ""));
    if (!value) { setMsg({ type: "error", text: lang === "id" ? "Isi jumlah GMV dengan angka lebih dari 0." : "Enter an amount above 0." }); return; }
    const { error } = await supabase.from("gmv_entries").upsert({ user_id: user.id, entry_date: logDate, amount: value }, { onConflict: "user_id,entry_date" });
    if (error) { setMsg({ type: "error", text: friendlyError(error) }); return; }
    setPanel(""); setLogAmount("");
    setMsg({ type: "ok", text: t("gmv_saved") });
    load();
  }

  const hour = new Date().getHours();
  const greeting = hour < 11 ? t("greeting_morning") : hour < 15 ? t("greeting_afternoon") : t("greeting_evening");
  const name = profile && profile.full_name ? profile.full_name.split(" ")[0] : "";
  const pct = target > 0 ? Math.min(100, Math.round((achieved / target) * 100)) : 0;
  const shiftLabel = shift ? t("shift_" + shift) : t("shift_not_set");

  if (!ready) {
    return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-zinc-400" /></div>;
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2"><Radio size={20} /><h1 className="text-2xl font-semibold tracking-tight">LiveOps</h1></div>
          <p className="mt-1 text-sm text-zinc-400">{greeting}{name ? ", " + name : ""}</p>
        </div>
      </header>

      <Notice type={msg.type === "ok" ? "ok" : "error"}>{msg.text}</Notice>

      <GlassCard>
        <button onClick={() => setShowShiftPicker(!showShiftPicker)} className="flex w-full items-center justify-between text-left">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-400">{t("shift_today")}</p>
            <p className="mt-1 text-xl font-semibold">{shiftLabel}</p>
          </div>
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300">{shift ? "✎" : "+"}</span>
        </button>
        {showShiftPicker && (
          <div className="mt-3 grid grid-cols-4 gap-2">
            {SHIFTS.map((s) => (
              <button key={s} onClick={() => chooseShift(s)} className={"rounded-xl border py-2 text-xs " + (shift === s ? "border-white bg-white text-black" : "border-white/10 text-zinc-300")}>{t("shift_" + s)}</button>
            ))}
          </div>
        )}
      </GlassCard>

      <GlassCard>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{t("todo_title")}</p>
          <Link href="/tasks" className="text-xs text-zinc-400">{t("todo_see_all")}</Link>
        </div>
        {tasks.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-400">{t("todo_empty")}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {tasks.map((task) => (
              <li key={task.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
                <button onClick={() => toggleTask(task)} aria-label="Selesai" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/30">
                  <Check size={12} className="opacity-0" />
                </button>
                <span className="flex-1 text-sm">{task.title}</span>
                <span className={"rounded-full px-2 py-0.5 text-[10px] " + (task.priority === "urgent" ? "bg-red-400/15 text-red-300" : "bg-white/10 text-zinc-300")}>
                  {task.priority === "urgent" ? t("todo_urgent") : t("todo_normal")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>

      <GlassCard>
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-medium"><Target size={16} />{t("gmv_title")}</p>
          <span className="text-sm font-semibold">{target > 0 ? pct + "%" : "-"}</span>
        </div>
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-white/10">
          <div className={"h-full rounded-full transition-all " + (pct >= 100 ? "bg-emerald-400" : "bg-white")} style={{ width: pct + "%" }} />
        </div>
        {target > 0 ? (
          <div className="mt-3 flex justify-between text-xs text-zinc-400">
            <span>{t("gmv_achieved")}: <b className="text-white">{formatRupiah(achieved)}</b></span>
            <span>{t("gmv_target")}: <b className="text-white">{formatRupiah(target)}</b></span>
          </div>
        ) : (
          <p className="mt-3 text-xs text-zinc-400">{t("gmv_no_target")}</p>
        )}

        <div className="mt-4 flex gap-2">
          <button onClick={() => { setPanel(panel === "target" ? "" : "target"); setTargetInput(target ? String(target) : ""); }} className="flex-1 rounded-xl border border-white/10 py-2 text-xs text-zinc-200">{t("gmv_set_target")}</button>
          <button onClick={() => setPanel(panel === "log" ? "" : "log")} className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-white py-2 text-xs font-medium text-black"><Plus size={14} />{t("gmv_log")}</button>
        </div>

        {panel === "target" && (
          <div className="mt-3 space-y-2">
            <input inputMode="numeric" value={targetInput} onChange={(e) => setTargetInput(e.target.value)} placeholder={t("gmv_target") + " (Rp)"} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-white/40" />
            <button onClick={saveTarget} className="w-full rounded-xl bg-white py-2.5 text-sm font-medium text-black">{t("save")}</button>
          </div>
        )}
        {panel === "log" && (
          <div className="mt-3 space-y-2">
            <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-white/40" />
            <input inputMode="numeric" value={logAmount} onChange={(e) => setLogAmount(e.target.value)} placeholder={t("gmv_amount")} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-white/40" />
            <button onClick={saveLog} className="w-full rounded-xl bg-white py-2.5 text-sm font-medium text-black">{t("save")}</button>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
