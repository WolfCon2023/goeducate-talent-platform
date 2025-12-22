"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function LegalPageFrame(props: { title: string; children: React.ReactNode }) {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-4xl rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xl font-semibold tracking-tight">{props.title}</div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-white/90 hover:bg-white/10"
          >
            Back
          </button>
          <Link href="/" className="rounded-md bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-500">
            Home
          </Link>
        </div>
      </div>

      <div className="mt-4 max-h-[70vh] overflow-y-auto pr-2 legal-page-body">{props.children}</div>
    </div>
  );
}


