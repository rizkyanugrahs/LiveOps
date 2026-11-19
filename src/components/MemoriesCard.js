"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Images } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useI18n } from "@/lib/i18n";
import { sortMemories, sortedPhotos } from "@/lib/memories";
import SignedImage from "@/components/SignedImage";

// Kartu ringkas Memories di halaman Profil
export default function MemoriesCard() {
  const { supabase } = useAuth();
  const { t } = useI18n();
  const [memories, setMemories] = useState(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.from("memories").select("id, memory_date, created_at, memory_photos(image_path, sort_order, created_at)").then(({ data, error }) => {
      if (!error && data) setMemories(data);
      else setMemories([]);
    });
  }, [supabase]);

  const list = memories ? sortMemories(memories) : [];
  const photoCount = list.reduce((n, m) => n + (m.memory_photos || []).length, 0);
  const covers = list.map((m) => sortedPhotos(m)[0]).filter(Boolean).slice(0, 4);

  return (
    <Link href="/profile/memories" className="glass block rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Images size={20} className="text-zinc-300" />
          <div>
            <p className="text-sm font-medium">{t("mem_title")}</p>
            <p className="text-xs text-zinc-400">{memories === null ? "" : list.length ? t("mem_moments").replace("{n}", list.length) + " · " + t("mem_photos").replace("{n}", photoCount) : t("mem_card_hint")}</p>
          </div>
        </div>
        <ChevronRight size={18} className="text-zinc-500" />
      </div>
      {covers.length > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {covers.map((c, i) => (
            <SignedImage key={c.image_path + i} path={c.image_path} className="aspect-square w-full rounded-xl border border-white/10 object-cover" />
          ))}
        </div>
      )}
    </Link>
  );
}
