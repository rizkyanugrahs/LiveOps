"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus, Loader2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useI18n } from "@/lib/i18n";
import { friendlyError } from "@/lib/supabase";
import { monthStr, monthRange, formatRupiah } from "@/lib/dates";
import { PLATFORMS } from "@/lib/shifts";
import GlassCard from "@/components/GlassCard";
import Notice from "@/components/Notice";
import Sheet from "@/components/Sheet";
import GmvLogForm from "@/components/GmvLogForm";

const hasValue = (v) => v !== null && v !== undefined;

// Kartu "GMV Target Bulan Ini". Diklik: buka halaman laporan lengkap.
export default function GmvTargetCard() {
  const { supabase, user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState([]);
  const [target, setTarget] = useState(0);
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [sheet, setSheet] = useState(""); // "", "target", "log"
  const [targetInput, setTargetInput] = useState("");
  const [targetError, setTargetError] = useState("");

  const load = useCallback(async () => {
    if (!supabase || !user) return;
    const month = monthStr();
    const { start, end } = monthRange(month);
    const [g, tg] = await Promise.all([
      supabase.from("gmv_entries").select("amount, shopee_amount, tiktok_amount").gte("entry_date", start).lt("entry_date", end),
      supabase.from("gmv_targets").select("*").eq("month", month).maybeSingle(),
    ]);
    const err = [g, tg].find((r) => r.error);
    if (err) setMsg({ type: "error", text: friendlyError(err.error) });
    // hanya hari yang sudah punya hasil GMV (bukan yang baru mengisi GMV awal)
    setRows((g.data || []).filter((r) => hasValue(r.shopee_amount) || hasValue(r.tiktok_amount) || Number(r.amount) > 0));
    setTarget(tg.data ? Number(tg.data.target) : 0);
    setReady(true);
  }, [supabase, user]);

  useEffect(() => { load(); }, [load]);

  async function saveTarget() {
    const value = Number(String(targetInput).replace(/[^0-9]/g, ""));
    if (!value) { setTargetError(t("gmv_need_one")); return; }
    const { error } = await supabase.from("gmv_targets").upsert({ user_id: user.id, month: monthStr(), target: value }, { onConflict: "user_id,month" });
    if (error) { setTargetError(friendlyError(error)); return; }
    setSheet("");
    setMsg({ type: "ok", text: t("gmv_target_saved") });
    load();
  }

  const achieved = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const pct = target > 0 ? Math.min(100, Math.round((achieved / target) * 100)) : 0;
  const avgOf = (key) => {
    const list = rows.filter((r) => hasValue(r[key]));
    return list.length ? list.reduce((s, r) => s + Number(r[key] || 0), 0) / list.length : null;
  };
  const avgs = [
    { key: "shopee", label: t("gmvt_avg_shopee"), value: avgOf("shopee_amount") },
    { key: "tiktok", label: t("gmvt_avg_tiktok"), value: avgOf("tiktok_amount") },
  ];
  const inputCls = "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-white/40";

  return (
    <>
      <Notice type={msg.type === "ok" ? "ok" : "error"}>{msg.text}</Notice>
      <GlassCard className="cursor-pointer" role="link" tabIndex={0} onClick={() => router.push("/gmv")} onKeyDown={(e) => { if (e.key === "Enter") router.push("/gmv"); }}>
        {!ready ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-zinc-400" /></div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{t("gmvt_title")}</p>
              <span className="flex items-center gap-1 text-sm font-semibold">{target > 0 ? pct + "%" : "-"}<ChevronRight size={16} className="text-zinc-500" /></span>
            </div>

            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
              <div className={"h-full rounded-full transition-all " + (pct >= 100 ? "bg-emerald-400" : "bg-white")} style={{ width: pct + "%" }} />
            </div>
            {target > 0 ? (
              <p className="mt-2 flex justify-between text-xs text-zinc-400">
                <span>{t("gmv_achieved")} <b className="text-white">{formatRupiah(achieved)}</b></span>
                <span>{t("gmv_target")} <b className="text-white">{formatRupiah(target)}</b></span>
              </p>
            ) : (
              <p className="mt-2 text-xs text-zinc-400">{t("gmv_no_target")}</p>
            )}

            <div className="mt-4 grid grid-cols-2 divide-x divide-white/10 border-t border-white/10 pt-3">
              {avgs.map((a, i) => (
                <div key={a.key} className={i === 0 ? "pr-3" : "pl-4"}>
                  <p className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                    <span className="h-2 w-2 rounded-full ring-1 ring-white/40" style={{ background: PLATFORMS[a.key].hex }} />{a.label}
                  </p>
                  <p className="mt-1 text-sm font-semibold">{a.value === null ? "-" : formatRupiah(a.value)}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 flex gap-2" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
              <button onClick={() => { setTargetInput(target ? String(target) : ""); setTargetError(""); setSheet("target"); }} className="flex-1 rounded-xl border border-white/10 py-2 text-xs text-zinc-200">{t("gmv_set_target")}</button>
              <button onClick={() => setSheet("log")} className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-white py-2 text-xs font-medium text-black"><Plus size={14} />{t("gmv_log")}</button>
            </div>
          </>
        )}
      </GlassCard>

      <Sheet open={sheet === "target"} title={t("gmv_set_target")} onClose={() => setSheet("")}>
        <div className="space-y-3">
          <Notice>{targetError}</Notice>
          <input inputMode="numeric" value={targetInput} onChange={(e) => setTargetInput(e.target.value)} placeholder={t("gmv_target") + " (Rp)"} className={inputCls} />
          <button onClick={saveTarget} className="w-full rounded-xl bg-white py-2.5 text-sm font-medium text-black">{t("save")}</button>
        </div>
      </Sheet>

      <Sheet open={sheet === "log"} title={t("gmv_log")} onClose={() => setSheet("")}>
        <GmvLogForm onSaved={(key) => { setSheet(""); setMsg({ type: "ok", text: t(key || "gmv_saved") }); load(); }} />
      </Sheet>
    </>
  );
}
