"use client";
import { useEffect, useRef, useState } from "react";
import { Loader2, Maximize2, RotateCcw } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { MIN_SCALE, MAX_SCALE, DEFAULT_SCALE, clampScale, clampPan, placement, renderProductPhoto } from "@/lib/productPhoto";

const makeCanvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };

// Mengatur foto produk: latar putih polos otomatis, atur ukuran dan posisi agar tidak kebesaran / terpotong
export default function ProductPhotoEditor({ file, onConfirm, onCancel }) {
  const { t } = useI18n();
  const [img, setImg] = useState(null);
  const [url, setUrl] = useState("");
  const [frame, setFrame] = useState(300);
  const [view, setView] = useState({ scale: DEFAULT_SCALE, dx: 0, dy: 0 });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const pointers = useRef(new Map());
  const lastDist = useRef(0);
  const frameRef = useRef(null);
  const frameSize = useRef(300);

  useEffect(() => {
    if (!file) return;
    const u = URL.createObjectURL(file);
    setUrl(u);
    setImg(null);
    setFailed(false);
    const im = new Image();
    im.onload = () => setImg(im);
    im.onerror = () => setFailed(true);
    im.src = u;
    setFrame(Math.min(300, window.innerWidth - 72));
    setView({ scale: DEFAULT_SCALE, dx: 0, dy: 0 });
    return () => URL.revokeObjectURL(u);
  }, [file]);

  useEffect(() => { frameSize.current = frame; }, [frame]);

  // roda mouse / cubit trackpad untuk ukuran
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    function onWheel(e) {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0025));
      setView((v) => ({ ...v, scale: clampScale(v.scale * factor) }));
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [img, failed]);

  if (!file) return null;

  const iw = img ? img.naturalWidth : 1;
  const ih = img ? img.naturalHeight : 1;
  const p = img ? placement(iw, ih, frame, view.scale, view.dx, view.dy) : { x: 0, y: 0, w: 0, h: 0 };

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      lastDist.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  }
  function onPointerMove(e) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    if (pointers.current.size === 1) {
      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      setView((v) => ({ ...v, ...clampPan(v.dx + dx, v.dy + dy, frameSize.current) }));
      pointers.current.set(e.pointerId, cur);
    } else if (pointers.current.size === 2) {
      pointers.current.set(e.pointerId, cur);
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (lastDist.current > 0) {
        const ratio = dist / lastDist.current;
        setView((v) => ({ ...v, scale: clampScale(v.scale * ratio) }));
      }
      lastDist.current = dist;
    }
  }
  function onPointerUp(e) {
    pointers.current.delete(e.pointerId);
    lastDist.current = 0;
  }

  function confirm() {
    if (!img) return;
    setBusy(true);
    const canvas = renderProductPhoto(makeCanvas, img, iw, ih, frame, view.scale, view.dx, view.dy, 900);
    canvas.toBlob((blob) => {
      setBusy(false);
      if (blob) onConfirm(blob);
    }, "image/jpeg", 0.92);
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/90 p-4">
      <div className="my-auto w-full max-w-sm space-y-4 rounded-3xl border border-white/10 bg-neutral-950 p-5">
        <h2 className="text-lg font-semibold">{t("pp_title")}</h2>

        {failed ? (
          <p className="py-8 text-center text-sm text-red-300">{t("photo_error")}</p>
        ) : !img ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-zinc-400" /></div>
        ) : (
          <>
            <div className="flex justify-center">
              <div
                ref={frameRef}
                className="relative select-none overflow-hidden rounded-2xl border border-white/20 bg-white"
                style={{ width: frame, height: frame, touchAction: "none", cursor: "grab" }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" draggable={false} style={{ position: "absolute", left: 0, top: 0, width: p.w, height: p.h, maxWidth: "none", transform: "translate(" + p.x + "px," + p.y + "px)", pointerEvents: "none" }} />
              </div>
            </div>
            <p className="text-center text-[11px] text-zinc-500">{t("pp_hint")}</p>

            <div>
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>{t("pp_size")}</span><span>{Math.round(view.scale * 100)}%</span>
              </div>
              <input type="range" min={MIN_SCALE} max={MAX_SCALE} step={0.01} value={view.scale} onChange={(e) => setView({ ...view, scale: clampScale(Number(e.target.value)) })} aria-label={t("pp_size")} className="mt-1 w-full" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setView({ scale: 1, dx: 0, dy: 0 })} className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 py-2 text-xs text-zinc-200"><Maximize2 size={13} />{t("pp_fit")}</button>
              <button type="button" onClick={() => setView({ scale: DEFAULT_SCALE, dx: 0, dy: 0 })} className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 py-2 text-xs text-zinc-200"><RotateCcw size={13} />{t("pp_reset")}</button>
            </div>
          </>
        )}

        <div className="flex gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-zinc-300">{t("cancel")}</button>
          <button type="button" onClick={confirm} disabled={busy || !img} className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-white py-2.5 text-sm font-medium text-black disabled:opacity-50">{busy && <Loader2 size={14} className="animate-spin" />}{t("save")}</button>
        </div>
      </div>
    </div>
  );
}
