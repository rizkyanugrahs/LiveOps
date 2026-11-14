"use client";
import Link from "next/link";
import { Settings, ChevronRight, Image as ImageIcon, BarChart3, UserRound } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useI18n } from "@/lib/i18n";
import { tenureParts } from "@/lib/dates";
import { APP_VERSION } from "@/lib/version";
import GlassCard from "@/components/GlassCard";

export default function ProfilePage() {
  const { profile, isGuest } = useAuth();
  const { t } = useI18n();
  const tenure = tenureParts(profile && profile.join_date);
  const name = profile && profile.full_name ? profile.full_name : isGuest ? "Guest" : "LiveOps";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t("profile_title")}</h1>

      <GlassCard className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5">
          {profile && profile.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : <UserRound size={28} className="text-zinc-400" />}
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{name}</p>
          <p className="text-sm text-zinc-400">{t("profile_empid")}: {profile && profile.employee_id ? profile.employee_id : "-"}</p>
        </div>
      </GlassCard>

      <GlassCard>
        <p className="text-xs uppercase tracking-wide text-zinc-400">{t("profile_tenure")}</p>
        {tenure ? (
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[["years", tenure.years, "tenure_years"], ["months", tenure.months, "tenure_months"], ["days", tenure.days, "tenure_days"]].map(([k, v, label]) => (
              <div key={k} className="rounded-xl border border-white/10 bg-black/20 py-3">
                <p className="text-2xl font-semibold">{v}</p>
                <p className="text-xs text-zinc-400">{t(label)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-zinc-400">{t("tenure_unset")}</p>
        )}
      </GlassCard>

      <GlassCard className="flex items-center gap-3">
        <BarChart3 size={20} className="text-zinc-400" />
        <div>
          <p className="text-sm font-medium">{t("gmv_report_title")}</p>
          <p className="text-xs text-zinc-400">{t("gmv_report_soon")}</p>
        </div>
      </GlassCard>

      <GlassCard className="flex items-center gap-3">
        <ImageIcon size={20} className="text-zinc-400" />
        <div>
          <p className="text-sm font-medium">{t("gallery_title")}</p>
          <p className="text-xs text-zinc-400">{t("gallery_soon")}</p>
        </div>
      </GlassCard>

      <Link href="/profile/settings" className="glass flex items-center justify-between rounded-2xl p-4">
        <span className="flex items-center gap-3 text-sm font-medium"><Settings size={20} className="text-zinc-300" />{t("settings")}</span>
        <ChevronRight size={18} className="text-zinc-500" />
      </Link>

      <p className="pt-2 text-center text-xs text-zinc-500">LiveOps {APP_VERSION}</p>
    </div>
  );
}
