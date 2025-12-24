"use client";

import * as React from "react";
import Link from "next/link";

import { Card, Input, Label, Button } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";

type PlayerCard = {
  userId: string;
  firstName: string;
  lastName: string;
  sport?: string;
  position?: string;
  gradYear?: number;
  school?: string;
  city?: string;
  state?: string;
  highlightPhotoUrl?: string;
};

export function CoachPublicPlayerSearch() {
  const [q, setQ] = React.useState("");
  const [state, setState] = React.useState("");
  const [position, setPosition] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<PlayerCard[]>([]);

  async function search() {
    setError(null);
    setLoading(true);
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Please login as a coach first.");
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (state.trim()) params.set("state", state.trim());
      if (position.trim()) params.set("position", position.trim());
      const res = await apiFetch<{ results: PlayerCard[] }>(`/search/players?${params.toString()}`, { token });
      setResults(res.results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid gap-6">
      <Card>
        <h1 className="text-2xl font-semibold tracking-tight">Player search</h1>
        <p className="mt-2 text-sm text-white/80">Search public player profiles. Private profiles do not appear in search.</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="searchQ">Search</Label>
            <Input id="searchQ" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, position, school, city..." />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="searchState">State</Label>
            <Input id="searchState" value={state} onChange={(e) => setState(e.target.value)} placeholder="CA" />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="searchPosition">Position</Label>
            <Input id="searchPosition" value={position} onChange={(e) => setPosition(e.target.value)} placeholder="Quarterback (QB)" />
          </div>
          <div className="flex items-end">
            <Button type="button" onClick={search} disabled={loading}>
              {loading ? "Searching…" : "Search"}
            </Button>
          </div>
        </div>

        {error ? <div className="mt-4 text-sm text-red-300">{error}</div> : null}
      </Card>

      <Card>
        <div className="text-sm font-semibold">Results</div>
        <div className="mt-4 grid gap-3">
          {results.length === 0 ? <div className="text-sm text-white/70">No results.</div> : null}
          {results.map((p) => {
            const title = `${p.firstName} ${p.lastName}`;
            const subtitle = [
              p.position ? p.position : null,
              p.gradYear ? `Class of ${p.gradYear}` : null,
              p.state ? p.state : null
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <Link
                key={p.userId}
                href={`/players/${encodeURIComponent(p.userId)}`}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition"
              >
                <div className="flex items-center gap-4">
                  {p.highlightPhotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.highlightPhotoUrl} alt={title} className="h-12 w-12 rounded-xl object-cover border border-white/10" />
                  ) : (
                    <div className="h-12 w-12 rounded-xl border border-white/10 bg-white/5" />
                  )}
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-white">{title}</div>
                    <div className="mt-1 truncate text-sm text-white/70">{subtitle || "—"}</div>
                    <div className="mt-1 truncate text-xs text-white/60">
                      {[p.school, p.city, p.state].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </Card>
    </div>
  );
}


