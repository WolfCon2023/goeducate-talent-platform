"use client";

import { useEffect, useMemo, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

import { Button } from "@/components/ui";

async function loadImage(src: string) {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

async function cropToBlob(opts: { imageSrc: string; crop: Area; mime: string }) {
  const img = await loadImage(opts.imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(opts.crop.width));
  canvas.height = Math.max(1, Math.floor(opts.crop.height));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.drawImage(
    img,
    opts.crop.x,
    opts.crop.y,
    opts.crop.width,
    opts.crop.height,
    0,
    0,
    opts.crop.width,
    opts.crop.height
  );

  const quality = 0.9;
  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), opts.mime, quality)
  );
  if (!blob) throw new Error("Failed to create cropped image");
  return blob;
}

export function ImageCropDialog(props: {
  file: File;
  onCancel: () => void;
  onConfirm: (cropped: File) => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const objectUrl = useMemo(() => URL.createObjectURL(props.file), [props.file]);
  useEffect(() => {
    return () => URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);

  async function confirm() {
    if (!croppedAreaPixels) return;
    setSaving(true);
    try {
      // Use JPEG to keep file sizes reasonable and ensure broad compatibility for avatars.
      const mime = "image/jpeg";
      const blob = await cropToBlob({ imageSrc: objectUrl, crop: croppedAreaPixels, mime });
      const next = new File([blob], "profile-photo.jpg", { type: mime });
      props.onConfirm(next);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") props.onCancel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [props]);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.currentTarget === e.target) props.onCancel();
      }}
    >
      <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[var(--surface)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-white">Crop profile photo</div>
            <div className="mt-1 text-sm text-white/70">Drag to reposition and zoom. We’ll crop to a square for the circular avatar.</div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" onClick={props.onCancel} disabled={saving} className="border border-white/15 bg-white/5 hover:bg-white/10">
              Cancel
            </Button>
            <Button type="button" onClick={confirm} disabled={saving || !croppedAreaPixels}>
              {saving ? "Cropping..." : "Use photo"}
            </Button>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-black/40">
          <div className="relative h-[55vh] max-h-[520px] w-full">
            <Cropper
              image={objectUrl}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_a, pixels) => setCroppedAreaPixels(pixels)}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="text-xs text-white/70">Zoom</div>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}


