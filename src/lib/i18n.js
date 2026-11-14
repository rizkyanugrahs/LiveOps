"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";

const dict = {
  en: {
    tagline: "Your Workday, Under Control.",
    nav_home: "Home", nav_tasks: "Tasks", nav_products: "Products", nav_profile: "Profile",
    loading: "Loading...", save: "Save", cancel: "Cancel", delete: "Delete", close: "Close", back: "Back",
    shift_today: "Today's shift", shift_off: "Off", shift_morning: "Morning", shift_afternoon: "Afternoon", shift_night: "Night",
    shift_not_set: "Not set yet", shift_tap: "Tap to set today's shift",
    todo_title: "Priority tasks", todo_empty: "All clear! No pending tasks.", todo_urgent: "Urgent", todo_normal: "Normal", todo_see_all: "See all",
    gmv_title: "GMV target this month", gmv_achieved: "Achieved", gmv_target: "Target", gmv_no_target: "No target yet. Set one to track your progress.",
    gmv_set_target: "Set target", gmv_log: "Log today's GMV", gmv_amount: "Amount (Rp)", gmv_date: "Date", gmv_saved: "GMV saved.", gmv_target_saved: "Target saved.",
    greeting_morning: "Good morning", greeting_afternoon: "Good afternoon", greeting_evening: "Good evening",
    soon_tasks: "Tasks and shift schedule are coming in the next update.", soon_products: "The product knowledge hub is coming in the next update.",
    profile_title: "Profile", profile_name: "Full name", profile_empid: "Employee ID", profile_join: "Join date", profile_tenure: "Work tenure",
    tenure_years: "yr", tenure_months: "mo", tenure_days: "d", tenure_unset: "Set your join date in Settings to start the tenure counter.",
    gallery_title: "Personal gallery", gallery_soon: "Your photo gallery is coming in a later update.",
    gmv_report_title: "GMV report checker", gmv_report_soon: "Flexible GMV reports are coming in a later update.",
    settings: "Settings", settings_title: "Settings", language: "Language", lang_en: "English", lang_id: "Bahasa Indonesia",
    personal_data: "Personal data", about: "About", version: "Version", developed_by: "Developed by",
    guest_banner: "You are using Guest mode.", guest_link: "Link to a permanent PIN", guest_link_hint: "Create a 6-digit PIN so your data stays with you.",
    pin_create: "Create PIN", pin_linked: "Done! Your data is now linked to your PIN.",
    logout: "Log out", logout_confirm: "Log out of LiveOps?",
    delete_all: "Delete all data", delete_all_hint: "Removes every task, shift, product, GMV record and photo entry from your account.",
    delete_all_confirm: "Delete ALL your data? This cannot be undone.", delete_all_done: "All data has been deleted.",
    saved: "Saved.", error_generic: "Something went wrong.",
    login_title: "Welcome to LiveOps", login_sub: "Enter your 6-digit PIN",
    login_enter: "Log in", login_create: "Create PIN", login_mode_in: "Log in", login_mode_new: "Create new PIN",
    login_pin_confirm: "Repeat your new PIN", login_pin_mismatch: "The two PINs are not the same.", login_pin_short: "PIN must be 6 digits.",
    login_guest: "Continue as Guest", login_or: "or",
    config_title: "Almost ready", config_body: "The Supabase address and key are not set in Vercel yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then redeploy.",
    soon_label: "Coming soon",
  },
  id: {
    tagline: "Hari kerjamu, tetap terkendali.",
    nav_home: "Beranda", nav_tasks: "Tugas", nav_products: "Produk", nav_profile: "Profil",
    loading: "Memuat...", save: "Simpan", cancel: "Batal", delete: "Hapus", close: "Tutup", back: "Kembali",
    shift_today: "Shift hari ini", shift_off: "Libur", shift_morning: "Pagi", shift_afternoon: "Siang", shift_night: "Malam",
    shift_not_set: "Belum diatur", shift_tap: "Ketuk untuk mengatur shift hari ini",
    todo_title: "Tugas prioritas", todo_empty: "Beres! Tidak ada tugas yang tertunda.", todo_urgent: "Urgent", todo_normal: "Normal", todo_see_all: "Lihat semua",
    gmv_title: "Target GMV bulan ini", gmv_achieved: "Tercapai", gmv_target: "Target", gmv_no_target: "Belum ada target. Atur dulu untuk memantau progres.",
    gmv_set_target: "Atur target", gmv_log: "Catat GMV hari ini", gmv_amount: "Jumlah (Rp)", gmv_date: "Tanggal", gmv_saved: "GMV tersimpan.", gmv_target_saved: "Target tersimpan.",
    greeting_morning: "Selamat pagi", greeting_afternoon: "Selamat siang", greeting_evening: "Selamat malam",
    soon_tasks: "Tugas dan jadwal shift hadir di pembaruan berikutnya.", soon_products: "Pusat informasi produk hadir di pembaruan berikutnya.",
    profile_title: "Profil", profile_name: "Nama lengkap", profile_empid: "ID karyawan", profile_join: "Tanggal bergabung", profile_tenure: "Masa kerja",
    tenure_years: "thn", tenure_months: "bln", tenure_days: "hr", tenure_unset: "Isi tanggal bergabung di Pengaturan untuk memulai hitungan masa kerja.",
    gallery_title: "Galeri pribadi", gallery_soon: "Galeri foto hadir di pembaruan berikutnya.",
    gmv_report_title: "Pengecek laporan GMV", gmv_report_soon: "Laporan GMV yang fleksibel hadir di pembaruan berikutnya.",
    settings: "Pengaturan", settings_title: "Pengaturan", language: "Bahasa", lang_en: "English", lang_id: "Bahasa Indonesia",
    personal_data: "Data pribadi", about: "Tentang", version: "Versi", developed_by: "Developed by",
    guest_banner: "Kamu sedang memakai mode Tamu.", guest_link: "Hubungkan ke PIN permanen", guest_link_hint: "Buat PIN 6 digit supaya datamu tetap tersimpan untukmu.",
    pin_create: "Buat PIN", pin_linked: "Berhasil! Datamu sekarang terhubung ke PIN kamu.",
    logout: "Keluar", logout_confirm: "Keluar dari LiveOps?",
    delete_all: "Hapus semua data", delete_all_hint: "Menghapus semua tugas, shift, produk, catatan GMV, dan data galeri dari akunmu.",
    delete_all_confirm: "Hapus SEMUA datamu? Tindakan ini tidak bisa dibatalkan.", delete_all_done: "Semua data sudah dihapus.",
    saved: "Tersimpan.", error_generic: "Ada yang kurang pas.",
    login_title: "Selamat datang di LiveOps", login_sub: "Masukkan PIN 6 digit kamu",
    login_enter: "Masuk", login_create: "Buat PIN", login_mode_in: "Masuk", login_mode_new: "Buat PIN baru",
    login_pin_confirm: "Ulangi PIN baru kamu", login_pin_mismatch: "Kedua PIN belum sama.", login_pin_short: "PIN harus 6 angka.",
    login_guest: "Lanjut sebagai Tamu", login_or: "atau",
    config_title: "Hampir siap", config_body: "Alamat dan kunci Supabase belum diisi di Vercel. Tambahkan NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY, lalu deploy ulang.",
    soon_label: "Segera hadir",
  },
};

const I18nContext = createContext({ lang: "en", setLang: () => {}, t: (k) => k });

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("liveops_lang");
      if (saved === "id" || saved === "en") setLangState(saved);
    } catch (e) {}
  }, []);

  const setLang = useCallback((l) => {
    setLangState(l);
    try { localStorage.setItem("liveops_lang", l); } catch (e) {}
    if (typeof document !== "undefined") document.documentElement.lang = l;
  }, []);

  const t = useCallback((key) => (dict[lang] && dict[lang][key]) || dict.en[key] || key, [lang]);

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
