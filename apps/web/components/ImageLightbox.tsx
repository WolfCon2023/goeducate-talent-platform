"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function ImageLightbox(props: { src: string; alt?: string; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") props.onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [props]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.currentTarget === e.target) props.onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col">
        <div className="mb-3 flex items-center justify-end">
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 overflow-auto rounded-2xl border border-white/10 bg-white/5 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- modal display; keep simple/reliable */}
          <img src={props.src} alt={props.alt ?? "Image"} className="mx-auto max-h-[82vh] w-auto max-w-full object-contain" />
        </div>
      </div>
    </div>
    ,
    document.body
  );
}


