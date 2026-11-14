"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import TodoSection from "@/components/TodoSection";
import ShiftSection from "@/components/ShiftSection";

export default function TasksPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState("todo");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t("nav_tasks")}</h1>
      <div className="glass grid grid-cols-2 rounded-full p-1">
        {[["todo", "tab_todo"], ["shift", "tab_shift"]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={"rounded-full py-2 text-sm transition " + (tab === k ? "bg-white font-medium text-black" : "text-zinc-400")}>{t(label)}</button>
        ))}
      </div>
      {tab === "todo" ? <TodoSection /> : <ShiftSection />}
    </div>
  );
}
