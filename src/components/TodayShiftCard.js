"use client";
import Link from "next/link";
import { ChevronRight, Coffee, User, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { PLATFORMS, LEAVE_COLORS, fmtTime, breakMinutes, fmtDuration, sessionList, teamList, isOff, isLeave } from "@/lib/shifts";
import GlassCard from "@/components/GlassCard";

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon size={15} className="mt-0.5 shrink-0 text-zinc-500" />
      <span className="w-14 shrink-0 text-xs text-zinc-500">{label}</span>
      <span className="min-w-0 flex-1 text-sm font-medium leading-snug">{value}</span>
    </div>
  );
}

// Ringkasan shift hari ini: dua kotak sesi, lalu info tambahan yang tersusun rapi
export default function TodayShiftCard({ row }) {
  const { t } = useI18n();
  const units = { h: t("shift_unit_h"), m: t("shift_unit_m") };

  let body;
  if (!row) {
    body = <p className="mt-2 text-lg font-semibold text-zinc-400">{t("shift_not_set")}</p>;
  } else if (isOff(row) || isLeave(row)) {
    const color = isLeave(row) ? LEAVE_COLORS[row.shift_type] : "#71717a";
    body = (
      <p className="mt-2 flex items-center gap-2 text-lg font-semibold">
        <span className="h-3 w-3 rounded-full" style={{ background: color }} />
        {isLeave(row) ? t("leave_type_" + row.shift_type) : t("shift_kind_off")}
      </p>
    );
  } else {
    const sessions = sessionList(row);
    if (!sessions.length) {
      body = <p className="mt-2 text-lg font-semibold">{t("shift_" + row.shift_type)}</p>;
    } else {
      const brk = breakMinutes(row);
      const team = teamList(row);
      const hasInfo = brk || row.partner || team.length > 0;
      body = (
        <div className="mt-3">
          <div className="grid grid-cols-2 gap-2">
            {sessions.map((s, i) => {
              const p = PLATFORMS[s.platform] || PLATFORMS.shopee;
              return (
                <div key={i} className="overflow-hidden rounded-2xl border border-white/10 bg-black/25">
                  <div className="h-1.5" style={{ background: p.hex === "#000000" ? "rgba(255,255,255,0.55)" : p.hex }} />
                  <div className="px-3 py-2.5">
                    <p className="text-[11px] text-zinc-400">{p.label}</p>
                    <p className="text-base font-semibold leading-tight">{fmtTime(s.start)}<span className="text-zinc-500"> – </span>{fmtTime(s.end)}</p>
                  </div>
                </div>
              );
            })}
          </div>
          {hasInfo && (
            <div className="mt-4 divide-y divide-white/5 border-t border-white/10">
              {brk ? <InfoRow icon={Coffee} label={t("shift_break")} value={fmtDuration(brk, units)} /> : null}
              {row.partner ? <InfoRow icon={User} label={t("shift_partner")} value={row.partner} /> : null}
              {team.length > 0 ? <InfoRow icon={Users} label={t("shift_tab_team")} value={team.join(", ")} /> : null}
            </div>
          )}
        </div>
      );
    }
  }

  return (
    <Link href="/tasks" className="block">
      <GlassCard>
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-zinc-400">{t("shift_today")}</p>
          <ChevronRight size={16} className="text-zinc-500" />
        </div>
        {body}
      </GlassCard>
    </Link>
  );
}
