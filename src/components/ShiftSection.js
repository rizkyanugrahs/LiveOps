"use client";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Download, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useI18n } from "@/lib/i18n";
import { friendlyError } from "@/lib/supabase";
import { todayStr, monthStr, monthRange, addDays, weekStart, formatDay, pad } from "@/lib/dates";
import { PLATFORMS, LEAVE_COLORS, LEAVE_CLASSES, fmtTime, breakMinutes, fmtDuration, sessionList, teamList, isOff, isLeave } from "@/lib/shifts";
import { drawShiftImage } from "@/lib/shiftImage";
import GlassCard from "@/components/GlassCard";
import Notice from "@/components/Notice";
import ConfirmDialog from "@/components/ConfirmDialog";
import ShiftForm from "@/components/ShiftForm";
import Sheet from "@/components/Sheet";


const LEAVE_ABBR = { annual: "AL", sick: "SL", unpaid: "UL" };

function shiftMonthStr(m, delta) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 1 + delta, 1);
  return d.getFullYear() + "-" + pad(d.getMonth() + 1);
}

// Penanda kecil di dalam satu kotak tanggal kalender
function CalendarMark({ row, t }) {
  if (!row) return null;
  if (isLeave(row)) {
    return <span className={"rounded px-1 text-[9px] font-semibold leading-4 " + LEAVE_CLASSES[row.shift_type]}>{LEAVE_ABBR[row.shift_type]}</span>;
  }
  if (isOff(row)) return <span className="rounded bg-white/10 px-1 text-[9px] font-semibold leading-4 text-zinc-300">{t("shift_cal_off")}</span>;
  const sessions = sessionList(row);
  if (!sessions.length) return <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />;
  return (
    <span className="flex w-full flex-col gap-[3px]">
      {sessions.map((s, i) => {
        const p = PLATFORMS[s.platform] || PLATFORMS.shopee;
        return <span key={i} className={"block h-[7px] w-full rounded-full " + (s.platform === "tiktok" ? "bg-black ring-1 ring-white/60" : "")} style={s.platform === "tiktok" ? undefined : { background: p.hex }} />;
      })}
    </span>
  );
}

function Pill({ platform }) {
  const p = PLATFORMS[platform] || PLATFORMS.shopee;
  return <span className={"shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium " + p.cls}>{p.label}</span>;
}

// Isi satu hari: Off Day / dua sesi dengan platform / jadwal lama
function ShiftSummary({ row, t }) {
  if (!row) return <p className="text-sm text-zinc-500">{t("shift_unset")}</p>;
  if (isOff(row) || isLeave(row)) {
    return (
      <div>
        <p className="flex items-center gap-2 text-sm"><span className="h-2.5 w-2.5 rounded-full" style={{ background: isLeave(row) ? LEAVE_COLORS[row.shift_type] : "#71717a" }} />{isLeave(row) ? t("leave_type_" + row.shift_type) : t("shift_kind_off")}</p>
        {row.note && <p className="mt-0.5 truncate text-xs text-zinc-400">{row.note}</p>}
      </div>
    );
  }
  const sessions = sessionList(row);
  if (!sessions.length) {
    return (
      <div>
        <p className="text-sm">{t("shift_" + row.shift_type)}</p>
        {row.note && <p className="mt-0.5 truncate text-xs text-zinc-400">{row.note}</p>}
      </div>
    );
  }
  const brk = breakMinutes(row);
  const team = teamList(row);
  return (
    <div className="space-y-1">
      {sessions.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          <Pill platform={s.platform} />
          <span className="text-sm font-medium">{fmtTime(s.start)} - {fmtTime(s.end)}</span>
          {i === 0 && brk ? <span className="text-[11px] text-zinc-500">· {t("shift_break")} {fmtDuration(brk, { h: t("shift_unit_h"), m: t("shift_unit_m") })}</span> : null}
        </div>
      ))}
      {(row.partner || team.length > 0) && (
        <p className="truncate text-xs text-zinc-400">
          {row.partner ? row.partner : ""}{row.partner && team.length ? " + " : ""}{team.length ? team.join(", ") : ""}
        </p>
      )}
      {row.note && <p className="truncate text-xs text-zinc-500">{row.note}</p>}
    </div>
  );
}

export default function ShiftSection() {
  const { supabase, profile } = useAuth();
  const { t, lang } = useI18n();
  const [view, setView] = useState("week");
  const [start, setStart] = useState(weekStart(todayStr()));
  const [month, setMonth] = useState(monthStr());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [newDate, setNewDate] = useState(todayStr());
  const [toDelete, setToDelete] = useState(null);
  const [dayRow, setDayRow] = useState(null); // detail satu tanggal di kalender

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    let from, to;
    if (view === "week") { from = start; to = addDays(start, 7); }
    else { const r = monthRange(month); from = r.start; to = r.end; }
    const { data, error } = await supabase.from("shifts").select("*").gte("shift_date", from).lt("shift_date", to).order("shift_date", { ascending: true });
    if (error) setMsg({ type: "error", text: friendlyError(error) });
    else setRows(data || []);
    setLoading(false);
  }, [supabase, view, start, month]);

  useEffect(() => { load(); }, [load]);

  function openForDate(date) {
    setEditing(rows.find((r) => r.shift_date === date) || null);
    setNewDate(date);
    setOpen(true);
  }
  function openRow(row) { setEditing(row); setNewDate(row.shift_date); setOpen(true); }

  // Klik tanggal di kalender: ada jadwal -> lihat detail; kosong -> langsung isi jadwal
  function onCalendarDay(date) {
    const row = rows.find((r) => r.shift_date === date);
    if (row) setDayRow(row);
    else { setEditing(null); setNewDate(date); setOpen(true); }
  }

  async function doDelete() {
    const id = toDelete;
    setToDelete(null);
    const row = rows.find((r) => r.id === id);
    // jadwal cuti: hapus catatan cuti-nya (saldo kembali), jadwal ikut terhapus
    const { error } = row && row.leave_entry_id
      ? await supabase.from("leave_entries").delete().eq("id", row.leave_entry_id)
      : await supabase.from("shifts").delete().eq("id", id);
    if (error) { setMsg({ type: "error", text: friendlyError(error) }); return; }
    setOpen(false);
    setDayRow(null);
    setMsg({ type: "ok", text: t("shift_deleted") });
    load();
  }

  function downloadPng() {
    setMsg({ type: "", text: "" });
    let items = [];
    let subtitle = "";
    let fileName = "";
    const dayInfo = (d, row) => ({
      day: formatDay(d, lang, { weekday: "long" }),
      dateText: formatDay(d, lang, { day: "numeric", month: "short", year: "numeric" }),
      row,
      highlight: d === todayStr(),
    });
    if (view === "week") {
      subtitle = formatDay(start, lang, { day: "numeric", month: "short" }) + " – " + formatDay(addDays(start, 6), lang, { day: "numeric", month: "short", year: "numeric" });
      fileName = "jadwal-shift-" + start + ".png";
      items = Array.from({ length: 7 }, (_, i) => addDays(start, i)).map((d) => dayInfo(d, rows.find((x) => x.shift_date === d) || null));
    } else {
      if (!rows.length) { setMsg({ type: "error", text: t("shift_nothing_to_download") }); return; }
      subtitle = formatDay(month + "-01", lang, { month: "long", year: "numeric" });
      fileName = "jadwal-shift-" + month + ".png";
      items = rows.map((r) => dayInfo(r.shift_date, r));
    }
    try {
      const canvas = drawShiftImage((w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }, {
        title: t("shift_image_title"),
        subtitle,
        name: profile && profile.full_name ? profile.full_name : "",
        items,
        footer: t("shift_image_footer"),
        labels: {
          partner: t("shift_partner"),
          team: t("shift_team"),
          off: t("shift_kind_off"),
          breakText: t("shift_break"),
          units: { h: t("shift_unit_h"), m: t("shift_unit_m") },
          leave: (type) => t("leave_type_" + type),
          legacy: (type) => t("shift_" + type),
        },
      });
      canvas.toBlob((blob) => {
        if (!blob) { setMsg({ type: "error", text: t("shift_image_failed") }); return; }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, "image/png");
    } catch (e) {
      setMsg({ type: "error", text: t("shift_image_failed") + " (" + (e.message || e) + ")" });
    }
  }

  const today = todayStr();
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const byDate = Object.fromEntries(rows.map((r) => [r.shift_date, r]));
  const byDateMonth = byDate;
  const inputCls = "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-white/40";

  return (
    <div className="space-y-4">
      <Notice type={msg.type === "ok" ? "ok" : "error"}>{msg.text}</Notice>

      <div className="flex gap-2">
        {[["week", "shift_week"], ["table", "shift_table"]].map(([k, label]) => (
          <button key={k} onClick={() => setView(k)} className={"flex-1 rounded-xl border py-2 text-xs " + (view === k ? "border-white bg-white text-black" : "border-white/10 text-zinc-300")}>{t(label)}</button>
        ))}
        <button onClick={downloadPng} disabled={loading} className="flex items-center gap-1 rounded-xl border border-white/10 px-3 text-xs text-zinc-200 disabled:opacity-40"><Download size={14} />{t("shift_download")}</button>
      </div>

      {view === "week" ? (
        <>
          <div className="flex items-center justify-between">
            <button onClick={() => setStart(addDays(start, -7))} aria-label={t("shift_prev")} className="glass flex h-9 w-9 items-center justify-center rounded-full"><ChevronLeft size={18} /></button>
            <button onClick={() => setStart(weekStart(todayStr()))} className="text-sm text-zinc-300">{formatDay(start, lang, { day: "numeric", month: "short" })} – {formatDay(addDays(start, 6), lang, { day: "numeric", month: "short" })}</button>
            <button onClick={() => setStart(addDays(start, 7))} aria-label={t("shift_next")} className="glass flex h-9 w-9 items-center justify-center rounded-full"><ChevronRight size={18} /></button>
          </div>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-zinc-400" /></div>
          ) : (
            <ul className="space-y-2">
              {days.map((d) => (
                <li key={d}>
                  <button onClick={() => openForDate(d)} className={"glass flex w-full items-start gap-3 rounded-2xl p-3 text-left " + (d === today ? "ring-1 ring-white/40" : "")}>
                    <div className="w-16 shrink-0">
                      <p className="text-sm font-medium">{formatDay(d, lang, { weekday: "short" })}</p>
                      <p className="text-xs text-zinc-400">{formatDay(d, lang, { day: "numeric", month: "short" })}</p>
                    </div>
                    <div className="min-w-0 flex-1"><ShiftSummary row={byDate[d]} t={t} /></div>
                    {d === today && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-zinc-300">{t("shift_today_label")}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <button onClick={() => setMonth(shiftMonthStr(month, -1))} aria-label={t("shift_prev")} className="glass flex h-9 w-9 items-center justify-center rounded-full"><ChevronLeft size={18} /></button>
            <button onClick={() => setMonth(monthStr())} className="text-sm font-medium capitalize">{formatDay(month + "-01", lang, { month: "long", year: "numeric" })}</button>
            <button onClick={() => setMonth(shiftMonthStr(month, 1))} aria-label={t("shift_next")} className="glass flex h-9 w-9 items-center justify-center rounded-full"><ChevronRight size={18} /></button>
          </div>

          <div className="glass rounded-2xl p-2">
            <div className="grid grid-cols-7 pb-1">
              {Array.from({ length: 7 }, (_, i) => addDays(weekStart(todayStr()), i)).map((d) => (
                <p key={d} className="text-center text-[10px] uppercase tracking-wide text-zinc-500">{formatDay(d, lang, { weekday: "short" })}</p>
              ))}
            </div>
            {loading ? (
              <div className="flex justify-center py-16"><Loader2 className="animate-spin text-zinc-400" /></div>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {(() => {
                  const { start: mStart, end: mEnd } = monthRange(month);
                  const lead = (new Date(mStart + "T00:00:00").getDay() + 6) % 7;
                  const cells = [];
                  for (let i = 0; i < lead; i++) cells.push(<div key={"b" + i} />);
                  for (let d = mStart; d < mEnd; d = addDays(d, 1)) {
                    const row = byDateMonth[d];
                    cells.push(
                      <button key={d} onClick={() => onCalendarDay(d)} className={"flex min-h-[3.6rem] flex-col items-stretch gap-1 rounded-xl border p-1 text-left transition active:scale-95 " + (d === today ? "border-white/60 bg-white/10" : "border-white/5 bg-black/20")}>
                        <span className={"text-[11px] " + (d === today ? "font-bold text-white" : "text-zinc-400")}>{Number(d.slice(8))}</span>
                        <span className="flex flex-1 items-end"><CalendarMark row={row} t={t} /></span>
                      </button>
                    );
                  }
                  return cells;
                })()}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-[11px] text-zinc-400">
            <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full" style={{ background: PLATFORMS.shopee.hex }} />Shopee</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-black ring-1 ring-white/60" />TikTok</span>
            <span className="flex items-center gap-1.5"><span className="rounded bg-white/10 px-1 text-[9px] font-semibold text-zinc-300">OFF</span>Off Day</span>
            <span className="flex items-center gap-1.5"><span className={"rounded px-1 text-[9px] font-semibold " + LEAVE_CLASSES.annual}>AL</span><span className={"rounded px-1 text-[9px] font-semibold " + LEAVE_CLASSES.sick}>SL</span><span className={"rounded px-1 text-[9px] font-semibold " + LEAVE_CLASSES.unpaid}>UL</span>{t("shift_cal_legend_leave")}</span>
          </div>
        </>
      )}

      <Sheet open={Boolean(dayRow)} title={dayRow ? formatDay(dayRow.shift_date, lang, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : ""} onClose={() => setDayRow(null)}>
        {dayRow && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><ShiftSummary row={dayRow} t={t} /></div>
            <div className="flex gap-2">
              <button onClick={() => setToDelete(dayRow.id)} aria-label={t("delete")} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 text-red-300"><Trash2 size={18} /></button>
              <button onClick={() => { const r = dayRow; setDayRow(null); openRow(r); }} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-medium text-black"><Pencil size={16} />{t("shift_edit_title")}</button>
            </div>
          </div>
        )}
      </Sheet>

      <ShiftForm
        open={open}
        initial={editing}
        defaultDate={newDate}
        onClose={() => setOpen(false)}
        onSaved={() => { setOpen(false); setMsg({ type: "ok", text: t("shift_saved") }); load(); }}
        onDelete={(id) => setToDelete(id)}
      />
      <ConfirmDialog open={Boolean(toDelete)} danger message={t("shift_delete_confirm")} confirmLabel={t("delete")} onConfirm={doDelete} onCancel={() => setToDelete(null)} />
    </div>
  );
}
