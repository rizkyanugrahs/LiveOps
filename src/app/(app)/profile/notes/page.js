"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Search, X, Loader2, Trash2, Image as ImageIcon } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useI18n } from "@/lib/i18n";
import { friendlyError } from "@/lib/supabase";
import { todayStr, formatDay } from "@/lib/dates";
import { uploadImage, removeImage } from "@/lib/storage";
import GlassCard from "@/components/GlassCard";
import Notice from "@/components/Notice";
import Sheet from "@/components/Sheet";
import ConfirmDialog from "@/components/ConfirmDialog";
import SignedImage from "@/components/SignedImage";

const blank = () => ({ id: null, title: "", content: "", date: todayStr(), image_path: null });

export default function NotesPage() {
  const { supabase, user } = useAuth();
  const { t, lang } = useI18n();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank());
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [toDelete, setToDelete] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from("notes").select("*").order("created_at", { ascending: false });
    if (error) setMsg({ type: "error", text: friendlyError(error) });
    else setNotes(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  function openNew() { setForm(blank()); setFile(null); setPreview(""); setRemovePhoto(false); setFormError(""); setOpen(true); }
  function openEdit(n) {
    setForm({ id: n.id, title: n.title || "", content: n.content || "", date: n.note_date || "", image_path: n.image_path || null });
    setFile(null); setPreview(""); setRemovePhoto(false); setFormError(""); setOpen(true);
  }
  function pickFile(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setFile(f); setPreview(URL.createObjectURL(f)); setRemovePhoto(false);
  }

  async function save() {
    if (!form.title.trim() && !form.content.trim()) { setFormError(t("notes_need_text")); return; }
    setSaving(true); setFormError("");
    try {
      const oldPath = form.image_path;
      let imagePath = form.image_path;
      if (file) imagePath = await uploadImage(supabase, user.id, "notes", file).catch((e) => { throw new Error(t("photo_error") + " (" + (e.message || e) + ")"); });
      else if (removePhoto) imagePath = null;
      const payload = { title: form.title.trim() || null, content: form.content.trim() || null, note_date: form.date || null, image_path: imagePath };
      const res = form.id ? await supabase.from("notes").update(payload).eq("id", form.id) : await supabase.from("notes").insert(payload);
      if (res.error) throw res.error;
      if (oldPath && oldPath !== imagePath) await removeImage(supabase, oldPath);
      setOpen(false);
      setMsg({ type: "ok", text: t("notes_saved") });
      load();
    } catch (e) {
      setFormError(e && e.message && e.message.startsWith(t("photo_error")) ? e.message : friendlyError(e));
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    setToDelete(false);
    const { error } = await supabase.from("notes").delete().eq("id", form.id);
    if (error) { setFormError(friendlyError(error)); return; }
    if (form.image_path) await removeImage(supabase, form.image_path);
    setOpen(false);
    setMsg({ type: "ok", text: t("notes_deleted") });
    load();
  }

  const q = query.trim().toLowerCase();
  const shown = notes.filter((n) => !q || (n.title || "").toLowerCase().includes(q) || (n.content || "").toLowerCase().includes(q));
  const inputCls = "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-white/40";
  const showCurrent = form.image_path && !removePhoto && !file;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/profile" aria-label={t("back")} className="glass flex h-9 w-9 items-center justify-center rounded-full"><ArrowLeft size={18} /></Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t("notes_title")}</h1>
            {notes.length > 0 && <p className="text-xs text-zinc-400">{t("notes_count").replace("{n}", notes.length)}</p>}
          </div>
        </div>
        <button onClick={openNew} className="flex items-center gap-1 rounded-full bg-white px-4 py-2 text-xs font-medium text-black"><Plus size={14} />{t("notes_add")}</button>
      </div>

      <div className="glass flex items-center gap-3 rounded-2xl px-4 py-3">
        <Search size={18} className="shrink-0 text-zinc-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("notes_search_ph")} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-500" />
        {query && <button onClick={() => setQuery("")} aria-label={t("close")}><X size={16} className="text-zinc-400" /></button>}
      </div>

      <Notice type={msg.type === "ok" ? "ok" : "error"}>{msg.text}</Notice>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-zinc-400" /></div>
      ) : notes.length === 0 ? (
        <GlassCard className="py-10 text-center text-sm text-zinc-400">{t("notes_empty")}</GlassCard>
      ) : shown.length === 0 ? (
        <GlassCard className="py-10 text-center text-sm text-zinc-400">{t("notes_no_result")}</GlassCard>
      ) : (
        <div className="columns-2 gap-3">
          {shown.map((n) => (
            <button key={n.id} onClick={() => openEdit(n)} className="glass mb-3 block w-full break-inside-avoid overflow-hidden rounded-2xl text-left">
              {n.image_path && <SignedImage path={n.image_path} className="block h-auto w-full" placeholderClass="min-h-[6rem]" />}
              <div className="space-y-1 p-3">
                <p className="line-clamp-2 text-sm font-semibold leading-snug">{n.title || t("notes_untitled")}</p>
                {n.content && <p className="line-clamp-6 whitespace-pre-wrap text-xs leading-relaxed text-zinc-400">{n.content}</p>}
                {(n.note_date) && <p className="pt-1 text-[10px] text-zinc-500">{formatDay(n.note_date, lang, { day: "numeric", month: "short", year: "numeric" })}</p>}
              </div>
            </button>
          ))}
        </div>
      )}

      <Sheet open={open} title={form.id ? t("notes_edit") : t("notes_add")} onClose={() => !saving && setOpen(false)}>
        <div className="space-y-4">
          <Notice>{formError}</Notice>
          <label className="block text-xs text-zinc-400">{t("notes_title_label")}
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t("notes_title_ph")} className={inputCls + " mt-1"} />
          </label>
          <label className="block text-xs text-zinc-400">{t("notes_content")}
            <textarea rows={7} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder={t("notes_content_ph")} className={inputCls + " mt-1"} />
          </label>
          <label className="block text-xs text-zinc-400">{t("notes_date")}
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls + " mt-1"} />
          </label>
          <div>
            <p className="text-xs text-zinc-400">{t("notes_photo")}</p>
            {(preview || showCurrent) && (
              <div className="relative mt-2 inline-block">
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="" className="h-28 w-28 rounded-xl border border-white/10 object-cover" />
                ) : (
                  <SignedImage path={form.image_path} className="h-28 w-28 rounded-xl border border-white/10 object-cover" />
                )}
                <button type="button" onClick={() => { setFile(null); setPreview(""); setRemovePhoto(true); }} aria-label={t("task_photo_remove")} className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white"><X size={12} /></button>
              </div>
            )}
            <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 py-3 text-sm text-zinc-300">
              <ImageIcon size={16} />{preview || showCurrent ? t("task_photo_change") : t("task_photo_add")}
              <input type="file" accept="image/*" onChange={pickFile} className="hidden" />
            </label>
          </div>
          <div className="flex gap-2">
            {form.id && <button onClick={() => setToDelete(true)} aria-label={t("delete")} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 text-red-300"><Trash2 size={18} /></button>}
            <button onClick={save} disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-medium text-black disabled:opacity-60">
              {saving && <Loader2 size={16} className="animate-spin" />}{saving ? t("uploading") : t("save")}
            </button>
          </div>
        </div>
      </Sheet>
      <ConfirmDialog open={toDelete} danger message={t("notes_delete_confirm")} confirmLabel={t("delete")} onConfirm={doDelete} onCancel={() => setToDelete(false)} />
    </div>
  );
}
