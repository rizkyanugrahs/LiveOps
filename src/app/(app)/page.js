"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Radio, Loader2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useI18n } from "@/lib/i18n";
import { todayStr, taskDue, dueStatus, formatDue, sortKeyDue, daysToPayday } from "@/lib/dates";
import { friendlyError } from "@/lib/supabase";
import GlassCard from "@/components/GlassCard";
import Notice from "@/components/Notice";
import TodayShiftCard from "@/components/TodayShiftCard";
import GmvTargetCard from "@/components/GmvTargetCard";

export default function HomePage() {
  const { supabase, user, profile } = useAuth();
  const { t, lang } = useI18n();
  const [ready, setReady] = useState(false);
  const [shiftRow, setShiftRow] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const load = useCallback(async () => {
    if (!supabase || !user) return;
    const [s, tk] = await Promise.all([
      supabase.from("shifts").select("*").eq("shift_date", todayStr()).maybeSingle(),
      supabase.from("tasks").select("*").eq("is_done", false).order("created_at", { ascending: false }).limit(50),
    ]);
    const firstError = [s, tk].find((r) => r.error);
    if (firstError) setMsg({ type: "error", text: friendlyError(firstError.error) });
    setShiftRow(s.data || null);
    const list = (tk.data || []).sort((a, b) => {
      if (a.priority !== b.priority) return a.priority === "urgent" ? -1 : 1;
      const ka = sortKeyDue(a);
      const kb = sortKeyDue(b);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    }).slice(0, 5);
    setTasks(list);
    setReady(true);
  }, [supabase, user]);

  useEffect(() => { load(); }, [load]);

  async function toggleTask(task) {
    const { error } = await supabase.from("tasks").update({ is_done: true }).eq("id", task.id);
    if (error) { setMsg({ type: "error", text: friendlyError(error) }); return; }
    setTasks((prev) => prev.filter((x) => x.id !== task.id));
  }

  const hour = new Date().getHours();
  const greeting = hour < 11 ? t("greeting_morning") : hour < 15 ? t("greeting_afternoon") : t("greeting_evening");
  const name = profile && profile.full_name ? profile.full_name.split(" ")[0] : "";
  const toPayday = daysToPayday(profile && profile.payday);

  if (!ready) {
    return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-zinc-400" /></div>;
  }

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2"><Radio size={20} /><h1 className="text-2xl font-semibold tracking-tight">LiveOps</h1></div>
          <p className="mt-1 text-sm text-zinc-400">{greeting}{name ? ", " + name : ""}</p>
        </div>
        {toPayday === null ? (
          <Link href="/profile/settings" className="mt-1 text-xs text-zinc-400 underline underline-offset-4">{t("payday_set")}</Link>
        ) : (
          <div className="text-right">
            <p className="text-lg font-bold leading-none tracking-tight text-white">{toPayday === 0 ? t("payday_today") : t("payday_chip").replace("{n}", toPayday)}</p>
            <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.2em] text-zinc-400">{t("payday_label")}</p>
          </div>
        )}
      </header>

      <Notice type={msg.type === "ok" ? "ok" : "error"}>{msg.text}</Notice>

      <TodayShiftCard row={shiftRow} />

      <GlassCard>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{t("todo_title")}</p>
          <Link href="/tasks" className="text-xs text-zinc-400">{t("todo_see_all")}</Link>
        </div>
        {tasks.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-400">{t("todo_empty")}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {tasks.map((task) => {
              const due = taskDue(task);
              const status = dueStatus(due);
              return (
                <li key={task.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
                  <button onClick={() => toggleTask(task)} aria-label="Selesai" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/30" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{task.title}</span>
                    {due && (
                      <span className={"block text-[11px] " + (status === "overdue" ? "text-red-300" : "text-zinc-400")}>
                        {status === "overdue" ? t("overdue") + " · " : ""}{formatDue(due, lang)}
                      </span>
                    )}
                  </span>
                  <span className={"rounded-full px-2 py-0.5 text-[10px] " + (task.priority === "urgent" ? "bg-red-400/15 text-red-300" : "bg-white/10 text-zinc-300")}>
                    {task.priority === "urgent" ? t("todo_urgent") : t("todo_normal")}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </GlassCard>

      <GmvTargetCard />
    </div>
  );
}
