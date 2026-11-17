"use client";
import { useCallback, useEffect, useState } from "react";
import { Plus, Loader2, Trash2, Image as ImageIcon } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useI18n } from "@/lib/i18n";
import { friendlyError } from "@/lib/supabase";
import { uploadImage, removeImage } from "@/lib/storage";
import { todayStr, formatDay } from "@/lib/dates";
import GlassCard from "@/components/GlassCard";
import Notice from "@/components/Notice";
import Sheet from "@/components/Sheet";
import ConfirmDialog from "@/components/ConfirmDialog";
import SignedImage from "@/components/SignedImage";

export default function GallerySection() {
  const { supabase, user } = useAuth();
  const { t, lang } = useI18n();
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [progress, setProgress] = useState(null); // { n, m }
  const [active, setActive] = useState(null);
  const [caption, setCaption] = useState("");
  const [takenAt, setTakenAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [toDelete, setToDelete] = useState(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from("gallery_photos").select("*").order("created_at", { ascending: false });
    if (error) setMsg({ type: "error", text: friendlyError(error) });
    else {
      const list = (data || []).sort((a, b) => {
        const da = a.taken_at || a.created_at.slice(0, 10);
        const db = b.taken_at || b.created_at.slice(0, 10);
        return da < db ? 1 : da > db ? -1 : 0;
      });
      setPhotos(list);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  async function addFiles(e) {
    const files = Array.from((e.target.files || []));
    e.target.value = "";
    if (!files.length) return;
    setMsg({ type: "", text: "" });
    let done = 0;
    let failedCount = 0;
    let lastError = "";
    for (let i = 0; i < files.length; i++) {
      setProgress({ n: i + 1, m: files.length });
      try {
        const path = await uploadImage(supabase, user.id, "gallery", files[i]);
        const { error } = await supabase.from("gallery_photos").insert({ image_path: path, taken_at: todayStr() });
        if (error) { await removeImage(supabase, path); throw error; }
        done++;
      } catch (err) {
        failedCount++;
        lastError = friendlyError(err);
      }
    }
    setProgress(null);
    if (failedCount) setMsg({ type: "error", text: t("photo_error") + " " + lastError });
    else setMsg({ type: "ok", text: t("gal_saved") });
    if (done) load();
  }

  function openPhoto(p) {
    setActive(p); setCaption(p.caption || ""); setTakenAt(p.taken_at || ""); setFormError("");
  }

  async function saveDetails() {
    setSaving(true); setFormError("");
    const { error } = await supabase.from("gallery_photos").update({ caption: caption.trim() || null, taken_at: takenAt || null }).eq("id", active.id);
    setSaving(false);
    if (error) { setFormError(friendlyError(error)); return; }
    setActive(null);
    load();
  }

  async function doDelete() {
    const p = toDelete;
    setToDelete(null);
    const { error } = await supabase.from("gallery_photos").delete().eq("id", p.id);
    if (error) { setFormError(friendlyError(error)); return; }
    await removeImage(supabase, p.image_path);
    setActive(null);
    setMsg({ type: "ok", text: t("gal_deleted") });
    load();
  }

  const inputCls = "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-white/40";

  return (
    <GlassCard className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium"><ImageIcon size={18} className="text-zinc-300" />{t("gallery_title")}</p>
          <p className="mt-0.5 text-xs text-zinc-400">{t("gal_count").replace("{n}", photos.length)}</p>
        </div>
        <label className={"flex cursor-pointer items-center gap-1 rounded-full bg-white px-3 py-2 text-xs font-medium text-black " + (progress ? "pointer-events-none opacity-60" : "")}>
          {progress ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}{t("gal_add")}
          <input type="file" accept="image/*" multiple onChange={addFiles} className="hidden" />
        </label>
      </div>

      {progress && <p className="text-xs text-zinc-400">{t("gal_uploading").replace("{n}", progress.n).replace("{m}", progress.m)}</p>}
      <Notice type={msg.type === "ok" ? "ok" : "error"}>{msg.text}</Notice>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-zinc-400" /></div>
      ) : photos.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-400">{t("gal_empty")}</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <button key={p.id} onClick={() => openPhoto(p)} className="aspect-square overflow-hidden rounded-xl border border-white/10">
              <SignedImage path={p.image_path} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <Sheet open={Boolean(active)} title={t("gal_edit")} onClose={() => !saving && setActive(null)}>
        {active && (
          <div className="space-y-4">
            <Notice>{formError}</Notice>
            <SignedImage path={active.image_path} className="max-h-[50vh] w-full rounded-2xl border border-white/10 object-contain" />
            <label className="block text-xs text-zinc-400">{t("gal_caption")}
              <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder={t("gal_caption_ph")} className={inputCls + " mt-1"} />
            </label>
            <label className="block text-xs text-zinc-400">{t("gal_date")}{takenAt ? " · " + formatDay(takenAt, lang, { day: "numeric", month: "long", year: "numeric" }) : ""}
              <input type="date" value={takenAt} onChange={(e) => setTakenAt(e.target.value)} className={inputCls + " mt-1"} />
            </label>
            <div className="flex gap-2">
              <button onClick={() => setToDelete(active)} aria-label={t("delete")} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 text-red-300"><Trash2 size={18} /></button>
              <button onClick={saveDetails} disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-medium text-black disabled:opacity-60">
                {saving && <Loader2 size={16} className="animate-spin" />}{t("save")}
              </button>
            </div>
          </div>
        )}
      </Sheet>
      <ConfirmDialog open={Boolean(toDelete)} danger message={t("gal_delete_confirm")} confirmLabel={t("delete")} onConfirm={doDelete} onCancel={() => setToDelete(null)} />
    </GlassCard>
  );
}
