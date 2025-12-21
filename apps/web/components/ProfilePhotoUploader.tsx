"use client";

import { useEffect, useRef, useState } from "react";

import { Button, Card } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";
import { ImageLightbox } from "@/components/ImageLightbox";
import { ImageCropDialog } from "@/components/ImageCropDialog";

function getApiBaseUrl() {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error("Missing NEXT_PUBLIC_API_URL");
  return url.replace(/\/+$/, "");
}

export function ProfilePhotoUploader(props: { title?: string; help?: string }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const token = getAccessToken();
      if (!token) return;
      const res = await apiFetch<{ user: { profilePhotoUrl?: string } }>("/auth/me", { token }).catch(() => null);
      if (!cancelled) setPhotoUrl(res?.user?.profilePhotoUrl ?? null);
    }
    void load();

    const onMeChanged = () => void load();
    window.addEventListener("goeducate:me-changed", onMeChanged);
    return () => {
      cancelled = true;
      window.removeEventListener("goeducate:me-changed", onMeChanged);
    };
  }, []);

  async function upload(file: File) {
    setStatus(null);
    setUploading(true);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "player" && role !== "coach") throw new Error("Only players and coaches can upload profile photos.");

      if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
      if (file.size > 5 * 1024 * 1024) throw new Error("Image is too large (max 5MB).");

      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch(`${getApiBaseUrl()}/users/me/profile-photo`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`
        },
        body: fd
      });
      const body = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) {
        const msg = body?.error?.message ?? "Upload failed";
        throw new Error(msg);
      }

      setStatus("Profile photo updated.");
      setPhotoUrl(body?.profilePhotoUrl ? String(body.profilePhotoUrl) : null);
      window.dispatchEvent(new Event("goeducate:me-changed"));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{props.title ?? "Profile photo"}</div>
          <p className="mt-1 text-sm text-white/80">{props.help ?? "Upload a headshot or clear face photo (JPG/PNG/WebP, max 5MB)."}</p>
          {status ? <div className="mt-2 text-sm text-white/80">{status}</div> : null}
        </div>
        <div className="flex items-center gap-2">
          {photoUrl ? (
            <>
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                aria-label="View profile photo"
                title="Click to enlarge"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- preview thumbnail; keep simple/reliable */}
                <img
                  src={`${getApiBaseUrl()}${photoUrl}`}
                  alt="Profile photo"
                  className="h-10 w-10 rounded-full border border-white/10 object-cover"
                />
              </button>
              {open ? <ImageLightbox src={`${getApiBaseUrl()}${photoUrl}`} alt="Profile photo" onClose={() => setOpen(false)} /> : null}
            </>
          ) : null}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setPendingFile(f);
            }}
          />
          <Button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? "Uploading..." : "Upload photo"}
          </Button>
        </div>
      </div>
      {pendingFile ? (
        <ImageCropDialog
          file={pendingFile}
          onCancel={() => {
            setPendingFile(null);
            if (inputRef.current) inputRef.current.value = "";
          }}
          onConfirm={(cropped) => {
            setPendingFile(null);
            void upload(cropped);
          }}
        />
      ) : null}
    </Card>
  );
}


