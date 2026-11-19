"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useI18n } from "@/lib/i18n";
import { friendlyError } from "@/lib/supabase";
import { todayStr, formatRupiah } from "@/lib/dates";
import { PLATFORMS } from "@/lib/shifts";
import Notice from "@/components/Notice";

const num = (v) => Number(String(v || "").replace(/[^0-9]/g, "")) || 0;
const blankText = (v) => String(v === null || v === undefined ? "" : v).trim() === "";
const asText = (v) => (v === null || v === undefined ? "" : String(Number(v)));
const emptyDiff = () => ({ shopee: { start: "", end: "" }, tiktok: { start: "", end: "" } });

// Input GMV harian: 2 platform sekaligus, dengan 2 cara:
// Manual (angka langsung) atau Selisih (GMV sebelum live dan setelah live). Partner diambil dari jadwal.
export default function GmvLogForm({ onSaved }) {
  const { supabase, user } = useAuth();
  const { t } = useI18n();
  const [date, setDate] = useState(todayStr());
  const [method, setMethod] = useState("manual");
  const [manual, setManual] = useState({ shopee: "", tiktok: "" });
  const [diff, setDiff] = useState(emptyDiff());
  const [order, setOrder] = useState(["shopee", "tiktok"]);
  const [partner, setPartner] = useState("");
  const [detected, setDetected] = useState(false);
  const [legacy, setLegacy] = useState(0);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // setiap tanggal berubah: cek jadwal (partner, urutan platform) dan catatan GMV yang sudah ada
  useEffect(() => {
    if (!supabase || !date) return;
    let active = true;
    setChecking(true);
    Promise.all([
      supabase.from("shifts").select("partner, session1_platform, shift_type").eq("shift_date", date).maybeSingle(),
      supabase.from("gmv_entries").select("*").eq("entry_date", date).maybeSingle(),
    ]).then(([sh, en]) => {
      if (!active) return;
      const shift = sh.data;
      const e = en.data;
      const shiftPartner = shift && shift.shift_type === "live" && shift.partner ? shift.partner : "";
      setDetected(Boolean(shiftPartner));
      setPartner(shiftPartner || (e && e.partner) || "");
      const first = shift && shift.session1_platform === "tiktok" ? "tiktok" : "shopee";
      setOrder([first, first === "shopee" ? "tiktok" : "shopee"]);
      const hasDiff = e && ["shopee_start", "shopee_end", "tiktok_start", "tiktok_end"].some((k) => e[k] !== null && e[k] !== undefined);
      const hasSplit = e && (e.shopee_amount !== null && e.shopee_amount !== undefined || e.tiktok_amount !== null && e.tiktok_amount !== undefined);
      setMethod(hasDiff ? "diff" : "manual");
      setManual({ shopee: e ? asText(e.shopee_amount) : "", tiktok: e ? asText(e.tiktok_amount) : "" });
      setDiff({
        shopee: { start: e ? asText(e.shopee_start) : "", end: e ? asText(e.shopee_end) : "" },
        tiktok: { start: e ? asText(e.tiktok_start) : "", end: e ? asText(e.tiktok_end) : "" },
      });
      setLegacy(e && !hasSplit && !hasDiff ? Number(e.amount || 0) : 0);
      setError("");
      setChecking(false);
    });
    return () => { active = false; };
  }, [supabase, date]);

  // hasil selisih per platform: null jika belum lengkap
  const diffResult = (k) => {
    const d = diff[k];
    if (blankText(d.start) || blankText(d.end)) return null;
    return num(d.end) - num(d.start);
  };
  const total = method === "manual"
    ? num(manual.shopee) + num(manual.tiktok)
    : ["shopee", "tiktok"].reduce((s, k) => s + Math.max(0, diffResult(k) || 0), 0);

  async function save() {
    let payload;
    let doneKey = "gmv_saved";
    if (method === "manual") {
      const shopee = num(manual.shopee);
      const tiktok = num(manual.tiktok);
      if (!shopee && !tiktok) { setError(t("gmv_need_one")); return; }
      payload = {
        shopee_amount: blankText(manual.shopee) ? null : shopee,
        tiktok_amount: blankText(manual.tiktok) ? null : tiktok,
        amount: shopee + tiktok,
        shopee_start: null, shopee_end: null, tiktok_start: null, tiktok_end: null,
      };
    } else {
      payload = { shopee_start: null, shopee_end: null, shopee_amount: null, tiktok_start: null, tiktok_end: null, tiktok_amount: null, amount: 0 };
      let any = false;
      let sum = 0;
      let pending = false;
      for (const k of ["shopee", "tiktok"]) {
        const d = diff[k];
        const hasStart = !blankText(d.start);
        const hasEnd = !blankText(d.end);
        if (!hasStart && !hasEnd) continue;
        any = true;
        if (hasEnd && !hasStart) { setError(t("gmv_need_start")); return; }
        payload[k + "_start"] = num(d.start);
        if (hasEnd) {
          const result = num(d.end) - num(d.start);
          if (result < 0) { setError(t("gmv_diff_negative")); return; }
          payload[k + "_end"] = num(d.end);
          payload[k + "_amount"] = result;
          sum += result;
        } else pending = true;
      }
      if (!any) { setError(t("gmv_need_one")); return; }
      payload.amount = sum;
      if (pending) doneKey = "gmv_start_saved";
    }
    setSaving(true); setError("");
    const { error: e } = await supabase.from("gmv_entries").upsert({ ...payload, user_id: user.id, entry_date: date, partner: partner.trim() || null }, { onConflict: "user_id,entry_date" });
    setSaving(false);
    if (e) { setError(friendlyError(e)); return; }
    onSaved(doneKey);
  }

  const inputCls = "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-white/40";
  const seg = (active) => "rounded-xl border py-2 text-xs " + (active ? "border-white bg-white font-medium text-black" : "border-white/10 text-zinc-300");

  return (
    <div className="space-y-3">
      <Notice>{error}</Notice>
      <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={inputCls} />
      {checking && <p className="text-[11px] text-zinc-500">{t("gmv_loading_date")}</p>}
      {legacy > 0 && <p className="rounded-xl bg-amber-300/10 px-3 py-2 text-xs text-amber-200">{t("gmv_legacy_note").replace("{n}", formatRupiah(legacy))}</p>}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => { setMethod("manual"); setError(""); }} className={seg(method === "manual")}>{t("gmv_method_manual")}</button>
        <button type="button" onClick={() => { setMethod("diff"); setError(""); }} className={seg(method === "diff")}>{t("gmv_method_diff")}</button>
      </div>
      {method === "diff" && <p className="text-[11px] text-zinc-500">{t("gmv_diff_hint")}</p>}

      <div className="space-y-2.5">
        {order.map((k) => {
          const p = PLATFORMS[k];
          if (method === "manual") {
            return (
              <div key={k} className="flex items-center gap-2">
                <span className={"w-20 shrink-0 rounded-full py-1.5 text-center text-xs font-medium " + p.cls}>{p.label}</span>
                <input inputMode="numeric" value={manual[k]} onChange={(e) => setManual({ ...manual, [k]: e.target.value })} placeholder="Rp 0" className={inputCls} />
              </div>
            );
          }
          const r = diffResult(k);
          const pendingStart = !blankText(diff[k].start) && blankText(diff[k].end);
          return (
            <div key={k} className="space-y-2 rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between">
                <span className={"rounded-full px-3 py-1 text-xs font-medium " + p.cls}>{p.label}</span>
                {r !== null ? (
                  <span className={"text-sm font-semibold " + (r < 0 ? "text-rose-300" : "text-emerald-300")}>{t("gmv_result")}: {formatRupiah(r)}</span>
                ) : pendingStart ? (
                  <span className="text-[11px] text-amber-200">{t("gmv_pending")}</span>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] text-zinc-500">{t("gmv_start")}
                  <input inputMode="numeric" value={diff[k].start} onChange={(e) => setDiff({ ...diff, [k]: { ...diff[k], start: e.target.value } })} placeholder="Rp 0" className={inputCls + " mt-1"} />
                </label>
                <label className="text-[11px] text-zinc-500">{t("gmv_end")}
                  <input inputMode="numeric" value={diff[k].end} onChange={(e) => setDiff({ ...diff, [k]: { ...diff[k], end: e.target.value } })} placeholder="Rp 0" className={inputCls + " mt-1"} />
                </label>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
        <span className="text-xs text-zinc-400">{t("gmv_total_calc")}</span>
        <span className="text-sm font-semibold">{formatRupiah(total)}</span>
      </div>

      <label className="block text-xs text-zinc-400">{t("gmv_partner")}
        <input value={partner} onChange={(e) => setPartner(e.target.value)} className={inputCls + " mt-1"} />
        <span className="mt-1 block text-[11px] text-zinc-500">{detected ? t("gmv_partner_auto") : t("gmv_partner_none")}</span>
      </label>

      <button onClick={save} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-medium text-black disabled:opacity-60">
        {saving && <Loader2 size={16} className="animate-spin" />}{t("save")}
      </button>
    </div>
  );
}
