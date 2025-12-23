"use client";

import * as React from "react";

import { Card, Button } from "@/components/ui";
import { getAccessToken } from "@/lib/auth";

function getApiBaseUrl() {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error("Missing NEXT_PUBLIC_API_URL");
  return url.replace(/\/+$/, "");
}

export function ProfilePhotoUploader(props: { title: string }) {
  const [file, setFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);

  React.useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function upload() {
    setError(null);
    setSuccess(null);
    setUploading(true);
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Please login first.");
      if (!file) throw new Error("Please select an image first.");

      const baseUrl = getApiBaseUrl();
      const form = new FormData();
      form.append("file", file);

      const res = await fetch(`${baseUrl}/users/me/profile-photo`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form
      });

      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || `Upload failed (${res.status})`);
      }

      setSuccess("Profile photo updated.");
      setFile(null);
      // Let nav/avatar refresh
      window.dispatchEvent(new Event("goeducate:me-changed"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold">{props.title}</div>
          <p className="mt-1 text-sm text-white/80">Upload a JPG, PNG, or WebP (max 5MB).</p>
        </div>
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- preview blob URL
          <img src={previewUrl} alt="Preview" className="h-16 w-16 rounded-full border border-white/10 object-cover" />
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full max-w-sm text-sm text-white/80 file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-white/15"
        />
        <Button type="button" onClick={upload} disabled={uploading || !file}>
          {uploading ? "Uploading..." : "Upload"}
        </Button>
        {success ? <span className="text-sm text-white/80">{success}</span> : null}
        {error ? <span className="text-sm text-red-300">{error}</span> : null}
      </div>
    </Card>
  );
}


