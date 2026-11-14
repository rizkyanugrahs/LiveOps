"use client";
import { ListChecks } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import GlassCard from "@/components/GlassCard";

export default function TasksPage() {
  const { t } = useI18n();
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{t("nav_tasks")}</h1>
      <GlassCard className="mt-6 flex flex-col items-center gap-3 py-10 text-center">
        <ListChecks size={32} className="text-zinc-400" />
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400">{t("soon_label")}</span>
        <p className="max-w-xs text-sm text-zinc-400">{t("soon_tasks")}</p>
      </GlassCard>
    </div>
  );
}
