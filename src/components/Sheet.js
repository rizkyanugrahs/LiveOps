"use client";
import { X } from "lucide-react";

// Lembar dari bawah. dismissOnBackdrop = false: tidak menutup saat area kosong disentuh
// (dipakai untuk form input supaya isian tidak hilang tak sengaja). zClass untuk lembar bertingkat.
export default function Sheet({ open, title, onClose, children, dismissOnBackdrop = true, zClass = "z-[55]" }) {
  if (!open) return null;
  return (
    <div className={"fixed inset-0 flex items-end justify-center bg-black/70 md:items-center " + zClass} onClick={dismissOnBackdrop ? onClose : undefined}>
      <div
        className="glass max-h-[88vh] w-full max-w-md overflow-y-auto overflow-x-hidden rounded-t-3xl px-4 pt-5 md:rounded-3xl md:px-5"
        style={{ background: "rgba(18,18,18,0.97)", maxHeight: "88dvh", paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="min-w-0 truncate text-lg font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Tutup" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
