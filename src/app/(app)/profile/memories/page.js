"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Loader2, Images } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useI18n } from "@/lib/i18n";
import { friendlyError } from "@/lib/supabase";
import { formatDay } from "@/lib/dates";
import { removeImage } from "@/lib/storage";
import { sortMemories, sortedPhotos, uploadItem, hasInfo } from "@/lib/memories";
import GlassCard from "@/components/GlassCard";
import Notice from "@/components/Notice";
import Sheet from "@/components/Sheet";
import SignedImage from "@/components/SignedImage";
import PhotoQueue from "@/components/PhotoQueue";
import MemoryDetail from "@/components/MemoryDetail";

export default function MemoriesPage() {
  const { supabase, user } = useAuth();
  const { t, lang } = useI18n();
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ type: "", text: "" });
  const [files, setFiles] = useState(null);      // foto yang sedang diedit
  const [draft, setDraft] = useState(null);      // foto hasil edit, menunggu detail momen
  const [form, setForm] = useState({ title: "", date: "", location: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from("memories").select("*, memory_photos(id, image_path, sort_order, created_at)");
    if (error) setMsg({ type: "error", text: friendlyError(error) });
    else setMemories(sortMemories(data || []));
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  function onPick(e) {
    const f = Array.from(e.target.files || []);
    e.target.value = "";
    if (f.length) { setMsg({ type: "", text: "" }); setFiles(f); }
  }

  function onEdited(items) {
    setFiles(null);
    if (!items.length) return;
    setForm({ title: "", date: "", location: "" });
    setFormError("");
    setDraft(items);
  }

  function closeDraft() {
    if (draft) draft.forEach((i) => URL.revokeObjectURL(i.preview));
    setDraft(null);
  }

  async function saveNew() {
    setSaving(true);
    setFormError("");
    const uploaded = [];
    let memoryId = null;
    try {
      const { data: created, error } = await supabase.from("memories").insert({
        title: form.title.trim() || null,
        memory_date: form.date || null,
        location: form.location.trim() || null,
      }).select("id").single();
      if (error) throw error;
      memoryId = created.id;
      let order = 0;
      for (const item of draft) {
        const path = await uploadItem(supabase, user.id, item);
        uploaded.push(path);
        order += 1;
        const { error: e2 } = await supabase.from("memory_photos").insert({ memory_id: memoryId, image_path: path, sort_order: order });
        if (e2) throw e2;
      }
      closeDraft();
      setMsg({ type: "ok", text: t("mem_saved") });
      load();
    } catch (e) {
      // batalkan semuanya supaya tidak ada momen setengah jadi
      for (const p of uploaded) await removeImage(supabase, p);
      if (memoryId) await supabase.from("memories").delete().eq("id", memoryId);
      setFormError(t("photo_error") + " " + friendlyError(e));
    } finally {
      setSaving(false);
    }
  }

  const opened = memories.find((m) => m.id === openId) || null;
  const photoTotal = memories.reduce((n, m) => n + (m.memory_photos || []).length, 0);
  const inputCls = "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-white/40";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/profile" aria-label={t("back")} className="glass flex h-9 w-9 items-center justify-center rounded-full"><ArrowLeft size={18} /></Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t("mem_title")}</h1>
            {memories.length > 0 && <p className="text-xs text-zinc-400">{t("mem_moments").replace("{n}", memories.length)} · {t("mem_photos").replace("{n}", photoTotal)}</p>}
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-1 rounded-full bg-white px-4 py-2 text-xs font-medium text-black">
          <Plus size={14} />{t("mem_add")}
          <input type="file" accept="image/*" multiple className="hidden" onChange={onPick} />
        </label>
      </div>

      <Notice type={msg.type === "ok" ? "ok" : "error"}>{msg.text}</Notice>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-zinc-400" /></div>
      ) : memories.length === 0 ? (
        <GlassCard className="py-12 text-center text-sm text-zinc-400">{t("mem_empty")}</GlassCard>
      ) : (
        <div className="columns-2 gap-3">
          {memories.map((m) => {
            const photos = sortedPhotos(m);
            const cover = photos[0];
            return (
              <button key={m.id} onClick={() => setOpenId(m.id)} className="relative mb-3 block w-full break-inside-avoid overflow-hidden rounded-2xl border border-white/10 bg-white/5 text-left">
                {cover ? <SignedImage path={cover.image_path} className="block h-auto w-full" placeholderClass="min-h-[9rem]" /> : <div className="h-32 w-full bg-white/5" />}
                {photos.length > 1 && (
                  <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] backdrop-blur"><Images size={11} />{photos.length}</span>
                )}
                {hasInfo(m) && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3 pb-3 pt-10">
                    {m.title && <p className="line-clamp-2 text-sm font-semibold leading-tight">{m.title}</p>}
                    {(m.memory_date || m.location) && (
                      <p className="mt-0.5 truncate text-[11px] text-zinc-300">{[m.memory_date ? formatDay(m.memory_date, lang, { day: "numeric", month: "short", year: "numeric" }) : "", m.location].filter(Boolean).join(" · ")}</p>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {files && <PhotoQueue files={files} onDone={onEdited} />}

      <Sheet open={Boolean(draft)} title={t("mem_new_title")} onClose={() => !saving && closeDraft()}>
        {draft && (
          <div className="space-y-4">
            <Notice>{formError}</Notice>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {draft.map((i, idx) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={idx} src={i.preview} alt="" className="h-20 w-20 shrink-0 rounded-xl border border-white/10 object-cover" />
              ))}
            </div>
            <label className="block text-xs text-zinc-400">{t("mem_title_label")} <span className="text-zinc-600">({t("mem_optional")})</span>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t("mem_title_ph")} className={inputCls + " mt-1"} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs text-zinc-400">{t("mem_date")} <span className="text-zinc-600">({t("mem_optional")})</span>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls + " mt-1"} />
              </label>
              <label className="block text-xs text-zinc-400">{t("mem_location")} <span className="text-zinc-600">({t("mem_optional")})</span>
                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder={t("mem_location_ph")} className={inputCls + " mt-1"} />
              </label>
            </div>
            <button onClick={saveNew} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-medium text-black disabled:opacity-60">
              {saving && <Loader2 size={16} className="animate-spin" />}{saving ? t("mem_saving") : t("save")}
            </button>
          </div>
        )}
      </Sheet>

      {opened && (
        <MemoryDetail
          key={opened.id}
          memory={opened}
          onClose={() => setOpenId(null)}
          onChanged={(text, closed) => { if (closed) setOpenId(null); setMsg({ type: "ok", text }); load(); }}
        />
      )}
    </div>
  );
}
