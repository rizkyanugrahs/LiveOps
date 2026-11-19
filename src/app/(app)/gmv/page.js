"use client";
import GmvReport from "@/components/GmvReport";

// Halaman detail laporan GMV (dibuka dari kartu "GMV Target Bulan Ini" di Beranda)
export default function GmvPage() {
  return <GmvReport backHref="/" />;
}
