"use client";
import { useState } from "react";
import { ChevronRight, Check, Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import Sheet from "@/components/Sheet";

// Kolom pilihan nama. Diketuk -> daftar yang bisa di-scroll. max = 1 (partner) atau lebih (tim, multi-pilih).
export default function PersonPicker({ label, title, names, value, max, onChange, presets }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const has = (n) => value.some((v) => v.toLowerCase() === n.toLowerCase());
  const full = value.length >= max;
  // nama manual yang belum ada di daftar tetap tampil di daftar supaya bisa dilepas lagi
  const all = Array.from(new Set([...(names || []), ...value]));

  function choose(name) {
    if (has(name)) { onChange(value.filter((v) => v.toLowerCase() !== name.toLowerCase())); return; }
    if (max === 1) { onChange([name]); setOpen(false); return; }
    if (full) return;
    onChange([...value, name]);
  }
  function addCustom() {
    const n = custom.trim();
    if (!n) return;
    setCustom("");
    if (has(n)) return;
    if (max === 1) { onChange([n]); setOpen(false); }
    else if (!full) onChange([...value, n]);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-left">
        <span className="min-w-0">
          <span className="block text-[11px] text-zinc-500">{label}</span>
          <span className={"block truncate text-sm " + (value.length ? "font-medium text-white" : "text-zinc-500")}>{value.length ? value.join(", ") : t("shift_pick_tap")}</span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-zinc-500" />
      </button>

      <Sheet open={open} title={title} onClose={() => setOpen(false)} zClass="z-[65]">
        <div className="space-y-3">
          {presets && presets.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] text-zinc-500">{t("shift_team_templates")}</p>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {presets.map((list) => (
                  <button key={list.join("-")} type="button" onClick={() => onChange(list.slice(0, max))} className="shrink-0 rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-300">{list.join(" & ")}</button>
                ))}
              </div>
            </div>
          )}

          <div className="max-h-[42vh] overflow-y-auto rounded-2xl border border-white/10 bg-black/20">
            {all.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-zinc-500">{t("shift_pick_none")}</p>
            ) : (
              <ul className="divide-y divide-white/5">
                {all.map((n) => {
                  const on = has(n);
                  const blocked = !on && full && max > 1;
                  return (
                    <li key={n}>
                      <button type="button" onClick={() => choose(n)} disabled={blocked} className={"flex w-full items-center justify-between px-4 py-3 text-left text-sm disabled:opacity-35 " + (on ? "font-medium text-white" : "text-zinc-300")}>
                        <span>{n}</span>
                        {on && <Check size={16} className="text-emerald-300" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {max > 1 && full && <p className="text-[11px] text-zinc-500">{t("shift_team_max")}</p>}

          <div className="flex gap-2">
            <input value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} placeholder={t("shift_name_custom_ph")} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-white/40" />
            <button type="button" onClick={addCustom} className="flex shrink-0 items-center gap-1 rounded-xl border border-white/10 px-3 text-xs text-zinc-200"><Plus size={14} />{t("shift_name_add")}</button>
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={() => onChange([])} className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-zinc-300">{t("shift_pick_clear")}</button>
            <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-xl bg-white py-2.5 text-sm font-medium text-black">{t("shift_pick_done")}</button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
