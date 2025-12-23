"use client";

import * as React from "react";

export function ImageLightbox(props: { src: string; alt?: string; onClose: () => void }) {
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") props.onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [props]);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4" onMouseDown={props.onClose}>
      <div className="relative max-h-[90vh] max-w-[90vw]" onMouseDown={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element -- remote/static images served by API; keep simple */}
        <img src={props.src} alt={props.alt ?? ""} className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain" />
        <button
          type="button"
          onClick={props.onClose}
          className="absolute right-3 top-3 rounded-md bg-black/60 px-3 py-1.5 text-sm font-semibold text-white hover:bg-black/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          Close
        </button>
      </div>
    </div>
  );
}


