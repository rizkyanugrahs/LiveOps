"use client";
import { useState } from "react";
import { ArrowLeft, Download, Trash2, Pencil, Plus, Loader2, MapPin, CalendarDays, X } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useI18n } from "@/lib/i18n";
import { friendlyError } from "@/lib/supabase";
import { formatDay } from "@/lib/dates";
import { removeImage } from "@/lib/storage";
import { sortedPhotos, uploadItem, downloadPhoto } from "@/lib/memories";
import Notice from "@/components/Notice";
import ConfirmDialog from "@/components/ConfirmDialog";
import SignedImage from "@/components/SignedImage";
import PhotoQueue from "@/components/PhotoQueue";

// Tampilan lengkap satu momen: semua foto, detail, unduh, tambah/hapus foto
export default function MemoryDetail({ memory, onClose, onChanged }) {
  const { supabase, user } = useAuth();
  const { t, lang } = useI18n();
  const photos = sortedPhotos(memory);
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: memory.title || "", date: memory.memory_date || "", location: memory.location || "" });
  const [saving, setSaving] = useState(false);
  const [files, setFiles] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(null); // indeks foto
  const [photoToDelete, setPhotoToDelete] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busyDownload, setBusyDownload] = useState(false);

  const title = memory.title || t("mem_untitled");

  async function saveDetails() {
    setSaving(true);
    const { error } = await supabase.from("memories").update({ title: form.title.trim() || null, memory_date: form.date || null, location: form.location.trim() || null }).eq("id", memory.id);
    setSaving(false);
    if (error) { setMsg({ type: "error", text: friendlyError(error) }); return; }
    setEditing(false);
    onChanged(t("mem_details_saved"));
  }

  async function addPhotos(items) {
    setFiles(null);
    if (!items.length) return;
    setUploading(true);
    const uploaded = [];
    try {
      let order = photos.reduce((m, p) => Math.max(m, p.sort_order || 0), 0);
      for (const item of items) {
        const path = await uploadItem(supabase, user.id, item);
        uploaded.push(path);
        order += 1;
        const { error } = await supabase.from("memory_photos").insert({ memory_id: memory.id, image_path: path, sort_order: order });
        if (error) throw error;
      }
      onChanged(t("mem_photos_added"));
    } catch (e) {
      for (const p of uploaded) await removeImage(supabase, p);
      setMsg({ type: "error", text: t("photo_error") + " " + friendlyError(e) });
    } finally {
      items.forEach((i) => URL.revokeObjectURL(i.preview));
      setUploading(false);
    }
  }

  async function deletePhoto() {
    const p = photoToDelete;
    setPhotoToDelete(null);
    const { error } = await supabase.from("memory_photos").delete().eq("id", p.id);
    if (error) { setMsg({ type: "error", text: friendlyError(error) }); return; }
    await removeImage(supabase, p.image_path);
    setLightbox(null);
    onChanged(t("mem_photo_deleted"));
  }

  async function deleteMemory() {
    setConfirmDelete(false);
    const paths = photos.map((p) => p.image_path);
    const { error } = await supabase.from("memories").delete().eq("id", memory.id);
    if (error) { setMsg({ type: "error", text: friendlyError(error) }); return; }
    for (const p of paths) await removeImage(supabase, p);
    onChanged(t("mem_deleted"), true);
  }

  async function download(photo, index) {
    try { await downloadPhoto(supabase, photo.image_path, memory.title, index); }
    catch (e) { setMsg({ type: "error", text: friendlyError(e) }); }
  }

  async function downloadAll() {
    setBusyDownload(true);
    for (let i = 0; i < photos.length; i++) {
      await download(photos[i], i);
      await new Promise((r) => setTimeout(r, 500));
    }
    setBusyDownload(false);
  }

  const inputCls = "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-white/40";

  return (
    <div className="fixed inset-0 z-[55] overflow-y-auto bg-neutral-950">
      <div className="mx-auto min-h-full w-full max-w-md px-4 pb-10 pt-5 md:max-w-2xl">
        <div className="flex items-center justify-between">
          <button onClick={onClose} aria-label={t("back")} className="glass flex h-9 w-9 items-center justify-center rounded-full"><ArrowLeft size={18} /></button>
          <div className="flex gap-2">
            <button onClick={() => setEditing(!editing)} aria-label={t("mem_edit")} className="glass flex h-9 w-9 items-center justify-center rounded-full"><Pencil size={16} /></button>
            <button onClick={() => setConfirmDelete(true)} aria-label={t("delete")} className="glass flex h-9 w-9 items-center justify-center rounded-full text-red-300"><Trash2 size={16} /></button>
          </div>
        </div>

        <div className="mt-5 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {(memory.memory_date || memory.location) && (
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-400">
              {memory.memory_date && <span className="flex items-center gap-1.5"><CalendarDays size={14} />{formatDay(memory.memory_date, lang, { day: "numeric", month: "long", year: "numeric" })}</span>}
              {memory.location && <span className="flex items-center gap-1.5"><MapPin size={14} />{memory.location}</span>}
            </p>
          )}
          <p className="text-xs text-zinc-500">{t("mem_photos").replace("{n}", photos.length)}</p>
        </div>

        <div className="mt-4 space-y-3">
          <Notice type={msg.type === "ok" ? "ok" : "error"}>{msg.text}</Notice>

          {editing && (
            <div className="glass space-y-3 rounded-2xl p-4">
              <label className="block text-xs text-zinc-400">{t("mem_title_label")} <span className="text-zinc-600">({t("mem_optional")})</span>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t("mem_title_ph")} className={inputCls + " mt-1"} />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs text-zinc-400">{t("mem_date")}
                  <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls + " mt-1"} />
                </label>
                <label className="block text-xs text-zinc-400">{t("mem_location")}
                  <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder={t("mem_location_ph")} className={inputCls + " mt-1"} />
                </label>
              </div>
              <button onClick={saveDetails} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-medium text-black disabled:opacity-60">{saving && <Loader2 size={16} className="animate-spin" />}{t("save")}</button>
            </div>
          )}

          <div className="flex gap-2">
            <label className={"flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 py-2.5 text-xs text-zinc-200 " + (uploading ? "pointer-events-none opacity-60" : "")}>
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}{t("mem_add_photos")}
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { const f = Array.from(e.target.files || []); e.target.value = ""; if (f.length) setFiles(f); }} />
            </label>
            <button onClick={downloadAll} disabled={busyDownload || !photos.length} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 py-2.5 text-xs text-zinc-200 disabled:opacity-50">
              {busyDownload ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}{t("mem_download_all")}
            </button>
          </div>
        </div>

        <div className="mt-4 columns-2 gap-3">
          {photos.map((p, i) => (
            <div key={p.id} className="relative mb-3 break-inside-avoid overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              <button onClick={() => setLightbox(i)} className="block w-full">
                <SignedImage path={p.image_path} className="block h-auto w-full" placeholderClass="min-h-[9rem]" />
              </button>
              <button onClick={() => download(p, i)} aria-label={t("mem_download")} className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur"><Download size={14} /></button>
            </div>
          ))}
        </div>
      </div>

      {lightbox !== null && photos[lightbox] && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-black/95">
          <div className="flex items-center justify-between p-4">
            <button onClick={() => setLightbox(null)} aria-label={t("mem_close")} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10"><X size={18} /></button>
            <div className="flex gap-2">
              <button onClick={() => download(photos[lightbox], lightbox)} className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-medium text-black"><Download size={14} />{t("mem_download")}</button>
              {photos.length > 1 && <button onClick={() => setPhotoToDelete(photos[lightbox])} aria-label={t("delete")} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-red-300"><Trash2 size={16} /></button>}
            </div>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center p-4" onClick={() => setLightbox(null)}>
            <SignedImage path={photos[lightbox].image_path} className="max-h-full max-w-full rounded-xl object-contain" />
          </div>
        </div>
      )}

      {files && <PhotoQueue files={files} onDone={addPhotos} />}
      <ConfirmDialog open={Boolean(photoToDelete)} danger message={t("mem_photo_delete_confirm")} confirmLabel={t("delete")} onConfirm={deletePhoto} onCancel={() => setPhotoToDelete(null)} />
      <ConfirmDialog open={confirmDelete} danger message={t("mem_delete_confirm")} confirmLabel={t("delete")} onConfirm={deleteMemory} onCancel={() => setConfirmDelete(false)} />
    </div>
  );
}
