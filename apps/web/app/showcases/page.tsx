"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Card, Button } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { ShowcasesGuard } from "./Guard";

type Showcase = {
  id: string;
  slug: string;
  title: string;
  sportCategories: string[];
  startDateTime: string | null;
  endDateTime: string | null;
  city: string;
  state: string;
  locationName: string;
  costCents: number;
  currency: string;
  capacity?: number;
  spotsRemaining?: number;
  registrationStatus: "open" | "closed" | "sold_out";
  registrationStatusLabel: string;
};

function fmtMoney(cents: number, currency: string) {
  const amount = (cents ?? 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: (currency || "usd").toUpperCase() }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

function fmtDates(startIso: string | null, endIso: string | null) {
  if (!startIso) return "TBD";
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : null;
  const startStr = start.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  if (!end) return startStr;
  const endStr = end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return startStr === endStr ? startStr : `${startStr} – ${endStr}`;
}

export default function ShowcasesPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Showcase[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      setLoading(true);
      try {
        const token = getAccessToken();
        if (!token) throw new Error("Please login first.");
        const res = await apiFetch<{ results: Showcase[] }>("/showcases", { token });
        if (!cancelled) setResults(res.results ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load showcases");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const empty = useMemo(() => !loading && results.length === 0 && !error, [loading, results.length, error]);

  return (
    <ShowcasesGuard>
      <div className="grid gap-8">
      <section className="rounded-2xl border border-white/10 bg-[var(--surface)] p-10">
        <div className="max-w-3xl">
          <h1 className="text-balance text-4xl font-semibold tracking-tight">Showcases</h1>
          <p className="mt-3 text-lg text-white/90">Browse upcoming showcases and register.</p>
        </div>
      </section>

      {error ? (
        <Card>
          <p className="text-sm text-red-300">{error}</p>
        </Card>
      ) : null}

      {loading ? (
        <Card>
          <p className="text-sm text-white/80">Loading showcases...</p>
        </Card>
      ) : null}

      {empty ? (
        <Card>
          <h2 className="text-lg font-semibold">No showcases available yet.</h2>
          <p className="mt-2 text-sm text-white/80">Check back soon.</p>
        </Card>
      ) : null}

      {results.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((s) => {
            const canRegister = s.registrationStatus === "open";
            const soldOut = s.registrationStatus === "sold_out";
            return (
              <div key={s.id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-base font-semibold text-white">{s.title}</div>
                  <div
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${
                      soldOut
                        ? "border-amber-400/30 bg-amber-500/10 text-amber-200"
                        : canRegister
                          ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                          : "border-white/10 bg-white/5 text-white/70"
                    }`}
                  >
                    {s.registrationStatusLabel}
                  </div>
                </div>

                <div className="mt-2 text-sm text-white/80">{fmtDates(s.startDateTime, s.endDateTime)}</div>
                <div className="mt-1 text-sm text-white/80">
                  {s.city}, {s.state} · {s.locationName}
                </div>

                <div className="mt-3 text-sm text-white/90">
                  <span className="font-semibold">Cost:</span> {fmtMoney(s.costCents, s.currency)}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {(s.sportCategories ?? []).slice(0, 6).map((c) => (
                    <span key={c} className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-xs font-semibold text-white/80">
                      {c}
                    </span>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <Link href={`/showcases/${encodeURIComponent(s.slug || s.id)}`} className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
                    Details
                  </Link>
                  <Button
                    type="button"
                    disabled={!canRegister}
                    onClick={() => {
                      window.location.href = `/showcases/${encodeURIComponent(s.slug || s.id)}`;
                    }}
                  >
                    Register
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
      </div>
    </ShowcasesGuard>
  );
}


