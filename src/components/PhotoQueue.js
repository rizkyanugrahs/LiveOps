"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import PhotoEditor from "@/components/PhotoEditor";

// Mengedit beberapa foto satu per satu. Hasilnya dikirim lewat onDone sebagai daftar item.
export default function PhotoQueue({ files, onDone }) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [items, setItems] = useState([]);
  const current = files[index];
  if (!current) return null;

  function next(item) {
    const all = item ? [...items, item] : items;
    if (index + 1 >= files.length) onDone(all);
    else { setItems(all); setIndex(index + 1); }
  }

  return (
    <PhotoEditor
      key={index}
      file={current}
      queueLabel={files.length > 1 ? t("photo_queue").replace("{n}", index + 1).replace("{m}", files.length) : ""}
      onConfirm={(blob) => next({ kind: "blob", data: blob, preview: URL.createObjectURL(blob) })}
      onUseOriginal={() => next({ kind: "file", data: current, preview: URL.createObjectURL(current) })}
      onCancel={() => next(null)}
    />
  );
}
