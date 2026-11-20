"use client";
import { useEffect, useState } from "react";
import { Loader2, ArrowUpDown } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useI18n } from "@/lib/i18n";
import { friendlyError } from "@/lib/supabase";
import { todayStr, formatRupiah } from "@/lib/dates";
import { PLATFORMS, otherPlatform } from "@/lib/shifts";
import Notice from "@/components/Notice";

const num = (v) => Number(String(v || "").replace(/[^0-9]/g, "")) || 0;
const blank = (v) => String(v === null || v === undefined ? "" : v).trim() === "";
const asText = (v) => (v === null || v === undefined ? "" : String(Number(v)));
const slot = (platform) => ({ platform, amount: "", start: "", end: "" });
const has = (v) => v !== null && v !== undefined;

// Input GMV harian dalam 2 baris (slot). Badge platform bisa diklik untuk ganti platform,
// dan urutan bisa ditukar. Dua cara: Manual (angka langsung) atau Selisih (sebelum dan sesudah live).
export default function GmvLogForm({ onSaved }) {
  const { supabase, user } = useAuth();
  const { t } = useI18n();
  const [date, setDate] = useState(todayStr());
  const [method, setMethod] = useState("manual");
  const [slots, setSlots] = useState([slot("shopee"), slot("tiktok")]);
  const [partner, setPartner] = useState("");
  const [detected, setDetected] = useState(false);
  const [legacy, setLegacy] = useState(0);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
      let next = [slot(first), slot(otherPlatform(first))];
      let isDiff = false;
      let legacyTotal = 0;
      if (e && Array.isArray(e.slots) && e.slots.length) {
        next = e.slots.slice(0, 2).map((s) => ({ platform: s.platform === "tiktok" ? "tiktok" : "shopee", amount: asText(s.amount), start: asText(s.start), end: asText(s.end) }));
        while (next.length < 2) next.push(slot(otherPlatform(next[0].platform)));
        isDiff = next.some((s) => s.start !== "" || s.end !== "");
      } else if (e) {
        // catatan versi lama: satu angka per platform
        const byPlatform = {
          shopee: { amount: asText(e.shopee_amount), start: asText(e.shopee_start), end: asText(e.shopee_end) },
          tiktok: { amount: asText(e.tiktok_amount), start: asText(e.tiktok_start), end: asText(e.tiktok_end) },
        };
        next = next.map((s) => ({ ...s, ...byPlatform[s.platform] }));
        isDiff = ["shopee_start", "shopee_end", "tiktok_start", "tiktok_end"].some((k) => has(e[k]));
        if (!has(e.shopee_amount) && !has(e.tiktok_amount) && !isDiff) legacyTotal = Number(e.amount || 0);
      }
      setSlots(next);
      setMethod(isDiff ? "diff" : "manual");
      setLegacy(legacyTotal);
      setError("");
      setChecking(false);
    });
    return () => { active = false; };
  }, [supabase, date]);

  const patch = (i, p) => setSlots(slots.map((s, idx) => (idx === i ? { ...s, ...p } : s)));
  const togglePlatform = (i) => patch(i, { platform: otherPlatform(slots[i].platform) });
  const swap = () => setSlots([slots[1], slots[0]]);

  // nilai tiap slot: { result: angka | null, pending: bool }
  const valueOf = (s) => {
    if (method === "manual") return { result: blank(s.amount) ? null : num(s.amount), pending: false };
    const hasStart = !blank(s.start);
    const hasEnd = !blank(s.end);
    if (hasStart && hasEnd) return { result: num(s.end) - num(s.start), pending: false };
    return { result: null, pending: hasStart && !hasEnd };
  };
  const values = slots.map(valueOf);
  const platformSum = (p) => slots.reduce((sum, s, i) => (s.platform === p && values[i].result !== null && values[i].result >= 0 ? sum + values[i].result : sum), 0);
  const platformUsed = (p) => slots.some((s, i) => s.platform === p && values[i].result !== null && values[i].result >= 0);
  const total = platformSum("shopee") + platformSum("tiktok");

  async function save() {
    let doneKey = "gmv_saved";
    let any = false;
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (method === "manual") {
        if (!blank(s.amount) && num(s.amount) > 0) any = true;
      } else {
        const hasStart = !blank(s.start);
        const hasEnd = !blank(s.end);
        if (hasStart || hasEnd) any = true;
        if (hasEnd && !hasStart) { setError(t("gmv_need_start")); return; }
        if (hasStart && hasEnd && num(s.end) < num(s.start)) { setError(t("gmv_diff_negative")); return; }
        if (hasStart && !hasEnd) doneKey = "gmv_start_saved";
      }
    }
    if (!any) { setError(t("gmv_need_one")); return; }

    const stored = slots.map((s, i) => ({
      platform: s.platform,
      amount: values[i].result,
      start: method === "diff" && !blank(s.start) ? num(s.start) : null,
      end: method === "diff" && !blank(s.end) ? num(s.end) : null,
    }));
    const shopee = platformUsed("shopee") ? platformSum("shopee") : null;
    const tiktok = platformUsed("tiktok") ? platformSum("tiktok") : null;

    setSaving(true); setError("");
    const { error: e } = await supabase.from("gmv_entries").upsert({
      user_id: user.id,
      entry_date: date,
      shopee_amount: shopee,
      tiktok_amount: tiktok,
      amount: (shopee || 0) + (tiktok || 0),
      slots: stored,
      shopee_start: null, shopee_end: null, tiktok_start: null, tiktok_end: null,
      partner: partner.trim() || null,
    }, { onConflict: "user_id,entry_date" });
    setSaving(false);
    if (e) { setError(friendlyError(e)); return; }
    onSaved(doneKey);
  }

  const inputCls = "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-white/40";
  const seg = (active) => "rounded-xl border py-2 text-xs " + (active ? "border-white bg-white font-medium text-black" : "border-white/10 text-zinc-300");
  const badge = (i) => {
    const p = PLATFORMS[slots[i].platform];
    return (
      <button type="button" onClick={() => togglePlatform(i)} aria-label={p.label} className={"w-20 shrink-0 rounded-full py-1.5 text-center text-xs font-medium active:scale-95 " + p.cls}>{p.label}</button>
    );
  };

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
      <p className="text-[11px] text-zinc-500">{method === "diff" ? t("gmv_diff_hint") + " " : ""}{t("gmvs_platform_hint")}</p>

      <div className="relative space-y-2.5">
        {slots.map((s, i) => {
          const v = values[i];
          return method === "manual" ? (
            <div key={i} className="flex items-center gap-2">
              {badge(i)}
              <input inputMode="numeric" value={s.amount} onChange={(e) => patch(i, { amount: e.target.value })} placeholder="Rp 0" className={inputCls} />
            </div>
          ) : (
            <div key={i} className="space-y-2 rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between">
                {badge(i)}
                {v.result !== null ? (
                  <span className={"text-sm font-semibold " + (v.result < 0 ? "text-rose-300" : "text-emerald-300")}>{t("gmv_result")}: {formatRupiah(v.result)}</span>
                ) : v.pending ? <span className="text-[11px] text-amber-200">{t("gmv_pending")}</span> : null}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] text-zinc-500">{t("gmv_start")}
                  <input inputMode="numeric" value={s.start} onChange={(e) => patch(i, { start: e.target.value })} placeholder="Rp 0" className={inputCls + " mt-1"} />
                </label>
                <label className="text-[11px] text-zinc-500">{t("gmv_end")}
                  <input inputMode="numeric" value={s.end} onChange={(e) => patch(i, { end: e.target.value })} placeholder="Rp 0" className={inputCls + " mt-1"} />
                </label>
              </div>
            </div>
          );
        })}
        <button type="button" onClick={swap} className="mx-auto flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-zinc-300"><ArrowUpDown size={12} />{t("gmvs_swap")}</button>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-400">{t("gmv_total_calc")}</span>
          <span className="text-sm font-semibold">{formatRupiah(total)}</span>
        </div>
        {(platformUsed("shopee") || platformUsed("tiktok")) && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/5 pt-2 text-[11px] text-zinc-400">
            {["shopee", "tiktok"].filter(platformUsed).map((p) => (
              <span key={p} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full ring-1 ring-white/40" style={{ background: PLATFORMS[p].hex }} />{PLATFORMS[p].label} {formatRupiah(platformSum(p))}</span>
            ))}
          </div>
        )}
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
