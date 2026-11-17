"use client";
import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useI18n } from "@/lib/i18n";
import { friendlyError } from "@/lib/supabase";
import { usePartners } from "@/lib/usePartners";
import { TIME_TEMPLATES, TEAM_TEMPLATES, PLATFORMS, otherPlatform, fmtTime, durationMinutes, fmtDuration, breakMinutes, sessionsOverlap, isOff } from "@/lib/shifts";
import Sheet from "@/components/Sheet";
import Notice from "@/components/Notice";
import NamePicker from "@/components/NamePicker";

const blank = (date) => ({ id: null, shift_date: date, kind: "live", s1: { start: "", end: "" }, s2: { start: "", end: "" }, first: "shopee", partner: [], team: [], note: "" });

function PlatformPill({ platform }) {
  const p = PLATFORMS[platform];
  return <span className={"rounded-full px-3 py-1 text-xs font-medium " + p.cls}>{p.label}</span>;
}

function SessionEditor({ n, platform, value, onChange }) {
  const { t } = useI18n();
  const units = { h: t("shift_unit_h"), m: t("shift_unit_m") };
  const dur = durationMinutes(value.start, value.end);
  const inputCls = "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-white/40";
  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{t("shift_session").replace("{n}", n)}</p>
        <div className="flex items-center gap-2">
          {dur ? <span className="text-xs text-zinc-400">{fmtDuration(dur, units)}</span> : null}
          <PlatformPill platform={platform} />
        </div>
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {TIME_TEMPLATES.map(([a, b]) => {
          const active = value.start === a && value.end === b;
          return (
            <button key={a + b} type="button" onClick={() => onChange({ start: a, end: b })} className={"shrink-0 rounded-full border px-3 py-1.5 text-xs " + (active ? "border-white bg-white text-black" : "border-white/10 text-zinc-300")}>{fmtTime(a)} - {fmtTime(b)}</button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-zinc-400">{t("shift_start")}
          <input type="time" value={value.start} onChange={(e) => onChange({ ...value, start: e.target.value })} className={inputCls + " mt-1"} />
        </label>
        <label className="text-xs text-zinc-400">{t("shift_end")}
          <input type="time" value={value.end} onChange={(e) => onChange({ ...value, end: e.target.value })} className={inputCls + " mt-1"} />
        </label>
      </div>
    </div>
  );
}

export default function ShiftForm({ open, initial, defaultDate, onClose, onSaved, onDelete }) {
  const { supabase, user } = useAuth();
  const { t } = useI18n();
  const { partners, defaultPartner } = usePartners();
  const [form, setForm] = useState(blank(defaultDate));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    if (initial) {
      const live = !isOff(initial);
      setForm({
        id: initial.id,
        shift_date: initial.shift_date,
        kind: live ? "live" : "off",
        s1: { start: initial.session1_start || "", end: initial.session1_end || "" },
        s2: { start: initial.session2_start || "", end: initial.session2_end || "" },
        first: initial.session2_platform === "shopee" ? "tiktok" : "shopee",
        partner: initial.partner ? [initial.partner] : [],
        team: Array.isArray(initial.team) ? initial.team : [],
        note: initial.note || "",
      });
    } else {
      setForm({ ...blank(defaultDate), partner: defaultPartner ? [defaultPartner.name] : [] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial, defaultDate]);

  const p1 = form.first;
  const p2 = otherPlatform(form.first);
  const names = partners.map((p) => p.name);
  const preview = form.kind === "live" && form.s1.start && form.s2.start ? { session1_start: form.s1.start, session1_end: form.s1.end, session2_start: form.s2.start, session2_end: form.s2.end } : null;
  const brk = preview ? breakMinutes(preview) : null;

  async function save() {
    if (!form.shift_date) { setError(t("shift_date")); return; }
    let payload;
    if (form.kind === "off") {
      payload = {
        shift_date: form.shift_date, shift_type: "off", note: form.note.trim() || null,
        session1_start: null, session1_end: null, session1_platform: null,
        session2_start: null, session2_end: null, session2_platform: null,
        partner: null, team: [],
      };
    } else {
      const { s1, s2 } = form;
      if (!s1.start || !s1.end || !s2.start || !s2.end) { setError(t("shift_sessions_required")); return; }
      if (s1.start === s1.end || s2.start === s2.end) { setError(t("shift_session_same")); return; }
      if (sessionsOverlap({ session1_start: s1.start, session1_end: s1.end, session2_start: s2.start, session2_end: s2.end })) { setError(t("shift_session_overlap")); return; }
      payload = {
        shift_date: form.shift_date, shift_type: "live", note: form.note.trim() || null,
        session1_start: s1.start, session1_end: s1.end, session1_platform: p1,
        session2_start: s2.start, session2_end: s2.end, session2_platform: p2,
        partner: form.partner[0] || null, team: form.team.slice(0, 2),
      };
    }
    setSaving(true); setError("");
    const res = form.id
      ? await supabase.from("shifts").update(payload).eq("id", form.id)
      : await supabase.from("shifts").upsert({ ...payload, user_id: user.id }, { onConflict: "user_id,shift_date" });
    setSaving(false);
    if (res.error) { setError(friendlyError(res.error)); return; }
    onSaved();
  }

  const inputCls = "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-white/40";

  return (
    <Sheet open={open} title={form.id ? t("shift_edit_title") : t("shift_add")} onClose={() => !saving && onClose()}>
      <div className="space-y-4">
        <Notice>{error}</Notice>

        <label className="block text-xs text-zinc-400">{t("shift_date")}
          <input type="date" value={form.shift_date} onChange={(e) => setForm({ ...form, shift_date: e.target.value })} className={inputCls + " mt-1"} />
        </label>

        <div className="grid grid-cols-2 gap-2">
          {[["live", t("shift_kind_live")], ["off", t("shift_kind_off")]].map(([k, label]) => (
            <button key={k} type="button" onClick={() => setForm({ ...form, kind: k })} className={"rounded-xl border py-2.5 text-sm " + (form.kind === k ? "border-white bg-white text-black" : "border-white/10 text-zinc-300")}>{label}</button>
          ))}
        </div>

        {form.kind === "live" && (
          <>
            <div>
              <p className="text-xs text-zinc-400">{t("shift_platform_order")}</p>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {[["shopee", t("shift_order_shopee_first")], ["tiktok", t("shift_order_tiktok_first")]].map(([k, label]) => (
                  <button key={k} type="button" onClick={() => setForm({ ...form, first: k })} className={"rounded-xl border py-2.5 text-xs " + (form.first === k ? "border-white bg-white text-black" : "border-white/10 text-zinc-300")}>{label}</button>
                ))}
              </div>
            </div>

            <SessionEditor n={1} platform={p1} value={form.s1} onChange={(v) => setForm({ ...form, s1: v })} />
            {brk ? <p className="text-center text-xs text-zinc-400">{t("shift_break")} {fmtDuration(brk, { h: t("shift_unit_h"), m: t("shift_unit_m") })}</p> : null}
            <SessionEditor n={2} platform={p2} value={form.s2} onChange={(v) => setForm({ ...form, s2: v })} />

            <NamePicker label={t("shift_partner")} hint={t("shift_partner_note")} names={names} value={form.partner} max={1} onChange={(v) => setForm({ ...form, partner: v })} />
            <NamePicker label={t("shift_team")} names={names} value={form.team} max={2} presets={TEAM_TEMPLATES} presetsLabel={t("shift_team_templates")} onChange={(v) => setForm({ ...form, team: v })} />
          </>
        )}

        <label className="block text-xs text-zinc-400">{t("shift_note")}
          <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder={t("shift_note_ph")} className={inputCls + " mt-1"} />
        </label>

        <div className="flex gap-2">
          {form.id && (
            <button onClick={() => onDelete(form.id)} aria-label={t("delete")} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 text-red-300"><Trash2 size={18} /></button>
          )}
          <button onClick={save} disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-medium text-black disabled:opacity-60">
            {saving && <Loader2 size={16} className="animate-spin" />}{t("save")}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
