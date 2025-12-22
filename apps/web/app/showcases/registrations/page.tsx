"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Card, Button } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { ShowcasesGuard } from "../Guard";

type RegistrationRow = {
  id: string;
  paymentStatus: string;
  createdAt: string;
  fullName: string;
  email: string;
  showcase?: {
    _id: string;
    slug?: string;
    title?: string;
    startDateTime?: string;
    endDateTime?: string;
    city?: string;
    state?: string;
    locationName?: string;
  };
};

function fmtDateTime(iso?: string) {
  if (!iso) return "TBD";
  return new Date(iso).toLocaleString();
}

function statusPill(status: string) {
  const s = (status || "").toLowerCase();
  if (s === "paid") return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
  if (s === "refunded") return "border-amber-400/30 bg-amber-500/10 text-amber-200";
  if (s === "failed") return "border-red-400/30 bg-red-500/10 text-red-200";
  return "border-white/10 bg-white/5 text-white/70";
}

export default function MyShowcaseRegistrationsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<RegistrationRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      setLoading(true);
      try {
        const token = getAccessToken();
        if (!token) throw new Error("Please login first.");
        const res = await apiFetch<{ results: RegistrationRow[] }>("/showcase-registrations/me", { token });
        if (!cancelled) setResults(res.results ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load registrations");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const empty = useMemo(() => !loading && !error && results.length === 0, [loading, error, results.length]);

  return (
    <ShowcasesGuard>
      <div className="grid gap-8">
        <section className="rounded-2xl border border-white/10 bg-[var(--surface)] p-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <h1 className="text-balance text-4xl font-semibold tracking-tight">My registrations</h1>
              <p className="mt-3 text-lg text-white/90">Your showcase registration history.</p>
            </div>
            <Link href="/showcases" className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
              Back to showcases
            </Link>
          </div>
        </section>

        {error ? (
          <Card>
            <p className="text-sm text-red-300">{error}</p>
          </Card>
        ) : null}

        {loading ? (
          <Card>
            <p className="text-sm text-white/80">Loading registrations...</p>
          </Card>
        ) : null}

        {empty ? (
          <Card>
            <h2 className="text-lg font-semibold">No registrations yet.</h2>
            <p className="mt-2 text-sm text-white/80">When you register for a showcase, it will appear here.</p>
            <div className="mt-4">
              <Link href="/showcases">
                <Button type="button">Browse showcases</Button>
              </Link>
            </div>
          </Card>
        ) : null}

        {results.length ? (
          <div className="grid gap-4">
            {results.map((r) => {
              const s = r.showcase;
              const slug = s?.slug ?? s?._id;
              return (
                <div key={r.id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-white">{s?.title ?? "Showcase"}</div>
                      <div className="mt-1 text-sm text-white/80">
                        {s?.city ? `${s.city}, ${s.state}` : "Location TBD"} {s?.locationName ? `· ${s.locationName}` : ""}
                      </div>
                      <div className="mt-1 text-sm text-white/80">
                        {fmtDateTime(s?.startDateTime)} {s?.endDateTime ? `– ${fmtDateTime(s.endDateTime)}` : ""}
                      </div>
                      <div className="mt-2 text-xs text-white/70">Registered: {fmtDateTime(r.createdAt)}</div>
                    </div>
                    <div className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusPill(r.paymentStatus)}`}>
                      {(r.paymentStatus || "pending").toUpperCase()}
                    </div>
                  </div>
                  {slug ? (
                    <div className="mt-4">
                      <Link href={`/showcases/${encodeURIComponent(slug)}`} className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
                        View showcase
                      </Link>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </ShowcasesGuard>
  );
}


