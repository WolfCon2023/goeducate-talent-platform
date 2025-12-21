"use client";

import { useEffect } from "react";

export function ImageLightbox(props: { src: string; alt?: string; onClose: () => void }) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") props.onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [props]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.currentTarget === e.target) props.onClose();
      }}
    >
      <div className="w-full max-w-3xl">
        <div className="mb-3 flex items-center justify-end">
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            Close
          </button>
        </div>
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          {/* eslint-disable-next-line @next/next/no-img-element -- modal display; keep simple/reliable */}
          <img src={props.src} alt={props.alt ?? "Image"} className="h-auto w-full object-contain" />
        </div>
      </div>
    </div>
  );
}


