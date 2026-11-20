"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, StickyNote } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useI18n } from "@/lib/i18n";

// Kartu Notes di halaman Profil (di atas Memories)
export default function NotesCard() {
  const { supabase } = useAuth();
  const { t } = useI18n();
  const [count, setCount] = useState(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.from("notes").select("id", { count: "exact", head: true }).then(({ count: c, error }) => setCount(error ? null : c));
  }, [supabase]);

  return (
    <Link href="/profile/notes" className="glass flex items-center justify-between rounded-2xl p-4">
      <span className="flex items-center gap-3">
        <StickyNote size={20} className="text-zinc-300" />
        <span>
          <span className="block text-sm font-medium">{t("notes_title")}</span>
          <span className="block text-xs text-zinc-400">{count ? t("notes_count").replace("{n}", count) : t("notes_card_hint")}</span>
        </span>
      </span>
      <ChevronRight size={18} className="text-zinc-500" />
    </Link>
  );
}
