"use client";
import { useEffect, useRef, useState } from "react";
import { RotateCcw, RotateCw, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { baseScale, centerOffset, clampOffset, zoomAround, cropRect, outputSize } from "@/lib/crop";
import { rotateCanvas90, toCanvas } from "@/lib/imageTools";

const ASPECTS = [["orig", "photo_aspect_orig"], [1, "1:1"], [4 / 5, "4:5"], [16 / 9, "16:9"]];
const SOURCE_MAX = 2048;
const makeCanvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };

// Edit foto: geser, cubit untuk zoom (di komputer: roda mouse / cubit trackpad), putar, dan potong.
// circle = true dipakai untuk foto profil (bingkai bulat, rasio 1:1).
export default function PhotoEditor({ file, circle = false, maxSide = 1280, queueLabel, onConfirm, onUseOriginal, onCancel }) {
  const { t } = useI18n();
  const [src, setSrc] = useState(null); // kanvas sumber (sudah diputar bila perlu)
  const [url, setUrl] = useState("");
  const [aspect, setAspect] = useState(circle ? 1 : "orig");
  const [box, setBox] = useState({ w: 300, h: 300 });
  const [view, setView] = useState({ zoom: 1, ox: 0, oy: 0 });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const pointers = useRef(new Map());
  const lastDist = useRef(0);
  const frameRef = useRef(null);
  const geom = useRef({ iw: 1, ih: 1, w: 300, h: 300 });

  // muat foto dan perkecil agar ringan
  useEffect(() => {
    if (!file) return;
    const u = URL.createObjectURL(file);
    setSrc(null);
    setFailed(false);
    const im = new Image();
    im.onload = () => setSrc(toCanvas(makeCanvas, im, im.naturalWidth, im.naturalHeight, SOURCE_MAX));
    im.onerror = () => setFailed(true);
    im.src = u;
    return () => URL.revokeObjectURL(u);
  }, [file]);

  // tampilan foto dibuat dari kanvas sumber (supaya hasil putaran ikut tampil)
  useEffect(() => {
    if (!src) return;
    let active = true;
    let made = "";
    src.toBlob((blob) => {
      if (!active || !blob) return;
      made = URL.createObjectURL(blob);
      setUrl(made);
    }, "image/jpeg", 0.92);
    return () => { active = false; if (made) URL.revokeObjectURL(made); };
  }, [src]);

  // ukuran bingkai dan posisi awal saat foto atau rasio berubah
  useEffect(() => {
    if (!src) return;
    const iw = src.width;
    const ih = src.height;
    const a = aspect === "orig" ? iw / ih : aspect;
    const maxW = Math.min(340, window.innerWidth - 72);
    const maxH = Math.max(180, window.innerHeight * 0.45);
    const w = Math.max(120, Math.min(maxW, maxH * a));
    const h = w / a;
    setBox({ w, h });
    geom.current = { iw, ih, w, h };
    const s = baseScale(iw, ih, w, h);
    const o = centerOffset(iw, ih, s, w, h);
    setView({ zoom: 1, ox: o.ox, oy: o.oy });
  }, [src, aspect]);

  // roda mouse / cubit trackpad (harus non-pasif agar halaman tidak ikut zoom)
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    function onWheel(e) {
      e.preventDefault();
      const g = geom.current;
      const rect = el.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0025));
      setView((v) => zoomAround(v, v.zoom * factor, e.clientX - rect.left, e.clientY - rect.top, g.iw, g.ih, g.w, g.h));
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [src, url, failed]);

  if (!file) return null;

  const iw = src ? src.width : 1;
  const ih = src ? src.height : 1;
  const s = src ? baseScale(iw, ih, box.w, box.h) * view.zoom : 1;

  function pan(dx, dy) {
    setView((v) => {
      const g = geom.current;
      const sc = baseScale(g.iw, g.ih, g.w, g.h) * v.zoom;
      const o = clampOffset(v.ox + dx, v.oy + dy, g.iw, g.ih, sc, g.w, g.h);
      return { ...v, ox: o.ox, oy: o.oy };
    });
  }

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
      pan(cur.x - prev.x, cur.y - prev.y);
      pointers.current.set(e.pointerId, cur);
    } else if (pointers.current.size === 2) {
      pointers.current.set(e.pointerId, cur);
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (lastDist.current > 0) {
        const g = geom.current;
        const rect = e.currentTarget.getBoundingClientRect();
        const cx = (a.x + b.x) / 2 - rect.left;
        const cy = (a.y + b.y) / 2 - rect.top;
        const ratio = dist / lastDist.current;
        setView((v) => zoomAround(v, v.zoom * ratio, cx, cy, g.iw, g.ih, g.w, g.h));
      }
      lastDist.current = dist;
    }
  }
  function onPointerUp(e) {
    pointers.current.delete(e.pointerId);
    lastDist.current = 0;
  }

  function rotate(clockwise) {
    if (!src) return;
    setSrc(rotateCanvas90(makeCanvas, src, clockwise));
  }

  function confirm() {
    if (!src) return;
    setBusy(true);
    const r = cropRect(view, iw, ih, box.w, box.h);
    const { w, h } = outputSize(r.sw, r.sh, circle ? 640 : maxSide);
    const canvas = makeCanvas(w, h);
    canvas.getContext("2d").drawImage(src, r.sx, r.sy, r.sw, r.sh, 0, 0, w, h);
    canvas.toBlob((blob) => {
      setBusy(false);
      if (blob) onConfirm(blob);
    }, "image/jpeg", 0.88);
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/90 p-4">
      <div className="my-auto w-full max-w-sm space-y-4 rounded-3xl border border-white/10 bg-neutral-950 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("photo_edit_title")}</h2>
          {queueLabel ? <span className="text-xs text-zinc-400">{queueLabel}</span> : null}
        </div>

        {failed ? (
          <p className="py-8 text-center text-sm text-red-300">{t("photo_error")}</p>
        ) : !src || !url ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-zinc-400" /></div>
        ) : (
          <>
            <div className="flex justify-center">
              <div
                ref={frameRef}
                className="relative select-none overflow-hidden rounded-xl border border-white/20 bg-black"
                style={{ width: box.w, height: box.h, touchAction: "none", cursor: "grab" }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" draggable={false} style={{ position: "absolute", left: 0, top: 0, width: iw * s, height: ih * s, maxWidth: "none", transform: "translate(" + view.ox + "px," + view.oy + "px)", pointerEvents: "none" }} />
                {circle && <div className="pointer-events-none absolute inset-0 rounded-full" style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)" }} />}
              </div>
            </div>
            <p className="text-center text-[11px] text-zinc-500">{t("photo_hint")}</p>

            <div className="flex items-center justify-center gap-2">
              <button type="button" onClick={() => rotate(false)} aria-label={t("photo_rotate_left")} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-zinc-200"><RotateCcw size={18} /></button>
              <button type="button" onClick={() => rotate(true)} aria-label={t("photo_rotate_right")} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-zinc-200"><RotateCw size={18} /></button>
              {!circle && (
                <div className="ml-2 flex flex-wrap justify-center gap-1.5">
                  {ASPECTS.map(([k, label]) => (
                    <button key={String(k)} type="button" onClick={() => setAspect(k)} className={"rounded-full border px-2.5 py-1.5 text-xs " + (aspect === k ? "border-white bg-white text-black" : "border-white/10 text-zinc-300")}>{label.startsWith("photo_") ? t(label) : label}</button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-zinc-300">{t("cancel")}</button>
          {onUseOriginal && <button type="button" onClick={onUseOriginal} disabled={busy} className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-zinc-200">{t("photo_use_original")}</button>}
          <button type="button" onClick={confirm} disabled={busy || !src} className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-white py-2.5 text-sm font-medium text-black disabled:opacity-50">{busy && <Loader2 size={14} className="animate-spin" />}{t("save")}</button>
        </div>
      </div>
    </div>
  );
}
