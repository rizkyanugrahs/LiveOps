import { BUCKET, uploadBlob, uploadImage } from "@/lib/storage";

export const MEMORY_FOLDER = "memories";

// Foto momen urut sesuai sort_order, lalu waktu dibuat
export function sortedPhotos(memory) {
  return [...(memory.memory_photos || [])].sort((a, b) => (a.sort_order - b.sort_order) || String(a.created_at || "").localeCompare(String(b.created_at || "")));
}

// Momen terbaru di atas: pakai tanggal momen, kalau kosong pakai tanggal dibuat
export function sortMemories(list) {
  const key = (m) => m.memory_date || String(m.created_at || "").slice(0, 10);
  return [...list].sort((a, b) => (key(a) < key(b) ? 1 : key(a) > key(b) ? -1 : String(b.created_at).localeCompare(String(a.created_at))));
}

export function hasInfo(m) { return Boolean(m.title || m.memory_date || m.location); }

// Mengunggah satu item hasil editor ({ kind: "blob" | "file", data })
export async function uploadItem(supabase, userId, item) {
  return item.kind === "blob"
    ? uploadBlob(supabase, userId, MEMORY_FOLDER, item.data)
    : uploadImage(supabase, userId, MEMORY_FOLDER, item.data);
}

function safeName(text) {
  return String(text || "memory").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "memory";
}

// Mengunduh satu foto lewat tautan sementara yang memaksa unduhan
export async function downloadPhoto(supabase, path, title, index) {
  const filename = safeName(title) + "-" + (index + 1) + ".jpg";
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 120, { download: filename });
  if (error || !data) throw error || new Error("Tautan unduhan tidak tersedia");
  const a = document.createElement("a");
  a.href = data.signedUrl;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
