"use client";

import { useState } from "react";

import { Card, Input, Label, Button } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";

type PlayerProfile = {
  _id: string;
  firstName: string;
  lastName: string;
  position: string;
  gradYear: number;
  state: string;
  city: string;
};

export function CoachSearch() {
  const [position, setPosition] = useState("");
  const [gradYear, setGradYear] = useState("");
  const [state, setState] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<PlayerProfile[]>([]);

  async function search() {
    setError(null);
    setLoading(true);
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Please login as a coach first.");

      const params = new URLSearchParams();
      if (position) params.set("position", position);
      if (gradYear) params.set("gradYear", gradYear);
      if (state) params.set("state", state);
      if (q) params.set("q", q);

      const res = await apiFetch<{ results: PlayerProfile[] }>(`/player-profiles?${params.toString()}`, { token });
      setResults(res.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <h2 className="text-lg font-semibold">Player search</h2>
        <p className="mt-1 text-sm text-slate-300">
          Subscription enforcement is later. RBAC is enforced by the API.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          <div className="grid gap-2">
            <Label htmlFor="position">Position</Label>
            <Input id="position" value={position} onChange={(e) => setPosition(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="gradYear">Grad year</Label>
            <Input id="gradYear" value={gradYear} onChange={(e) => setGradYear(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="state">State</Label>
            <Input id="state" value={state} onChange={(e) => setState(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="q">Name</Label>
            <Input id="q" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        <div className="mt-4">
          <Button type="button" onClick={search} disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </Button>
        </div>

        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
      </Card>

      <div className="grid gap-3">
        {results.map((p) => (
          <div key={p._id} className="rounded-xl border border-slate-800 bg-slate-950 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="text-base font-semibold">
                {p.firstName} {p.lastName}
              </div>
              <div className="text-sm text-slate-300">
                {p.position} · {p.gradYear} · {p.city}, {p.state}
              </div>
            </div>
          </div>
        ))}
        {results.length === 0 ? <p className="text-sm text-slate-400">No results yet.</p> : null}
      </div>
    </div>
  );
}


