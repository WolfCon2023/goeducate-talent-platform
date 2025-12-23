"use client";

import * as React from "react";
import Link from "next/link";

import { Card, Button } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";

export function CoachWatchlist() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<
    Array<{
      _id: string;
      playerUserId: string;
      createdAt: string;
      playerProfile?: { firstName?: string; lastName?: string; position?: string; gradYear?: number; city?: string; state?: string } | null;
    }>
  >([]);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Please login as a coach first.");
      const res = await apiFetch<{ results: any[] }>("/watchlists", { token });
      setRows(res.results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load watchlist");
    } finally {
      setLoading(false);
    }
  }

  async function remove(playerUserId: string) {
    setError(null);
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Please login as a coach first.");
      await apiFetch(`/watchlists/${playerUserId}`, { method: "DELETE", token });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove from watchlist");
    }
  }

  React.useEffect(() => {
    void load();
  }, []);

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold">Watchlist</div>
          <p className="mt-1 text-sm text-white/80">Players you’re tracking for new evaluations.</p>
        </div>
        <Button type="button" className="border border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={load} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </Button>
      </div>

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

      <div className="mt-4 grid gap-2">
        {rows.map((r) => {
          const p = r.playerProfile ?? {};
          const name = `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || "Player";
          const meta = [p.position, p.gradYear ? String(p.gradYear) : "", p.city && p.state ? `${p.city}, ${p.state}` : p.state].filter(Boolean).join(" · ");
          return (
            <div key={r._id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
              <div>
                <Link href={`/coach/player/${r.playerUserId}`} className="text-sm font-semibold text-indigo-300 hover:text-indigo-200 hover:underline">
                  {name}
                </Link>
                {meta ? <div className="mt-0.5 text-sm text-white/70">{meta}</div> : null}
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" className="border border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={() => remove(r.playerUserId)}>
                  Remove
                </Button>
              </div>
            </div>
          );
        })}

        {rows.length === 0 && !loading ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
            Your watchlist is empty. Use <span className="font-semibold">Player search</span> to add athletes you want to track.
          </div>
        ) : null}
      </div>
    </Card>
  );
}


