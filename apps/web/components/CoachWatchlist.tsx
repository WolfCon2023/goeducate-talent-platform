"use client";

import { useEffect, useState } from "react";

import { Button, Card } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";

type WatchlistItem = {
  _id: string;
  playerUserId: string;
  createdAt?: string;
  playerProfile?: {
    firstName?: string;
    lastName?: string;
    position?: string;
    gradYear?: number;
    city?: string;
    state?: string;
  } | null;
};

export function CoachWatchlist() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<WatchlistItem[]>([]);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login as a coach first.");
      if (role !== "coach" && role !== "admin") throw new Error("Insufficient permissions.");
      const res = await apiFetch<{ results: WatchlistItem[] }>("/watchlists", { token });
      setResults(res.results);
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
      setError(err instanceof Error ? err.message : "Failed to remove");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Watchlist</h2>
          <p className="mt-1 text-sm text-slate-300">Save players you want to track.</p>
        </div>
        <Button type="button" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

      <div className="mt-6 grid gap-3">
        {results.map((w) => (
          <div key={w._id} className="rounded-lg border border-slate-800 bg-slate-950 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-semibold">
                  <a className="text-white underline hover:text-slate-200" href={`/coach/player/${w.playerUserId}`}>
                    {w.playerProfile?.firstName
                      ? `${w.playerProfile.firstName} ${w.playerProfile.lastName ?? ""}`.trim()
                      : "Player (profile not created yet)"}
                  </a>
                </div>
                {w.playerProfile?.position ? (
                  <div className="mt-1 text-sm text-slate-300">
                    {w.playerProfile.position}
                    {typeof w.playerProfile.gradYear === "number" ? ` · ${w.playerProfile.gradYear}` : ""}
                    {w.playerProfile.city && w.playerProfile.state ? ` · ${w.playerProfile.city}, ${w.playerProfile.state}` : ""}
                  </div>
                ) : null}
              </div>
              <Button type="button" className="bg-slate-100" onClick={() => remove(w.playerUserId)}>
                Remove
              </Button>
            </div>
          </div>
        ))}
        {results.length === 0 ? <p className="text-sm text-slate-400">No players saved yet.</p> : null}
      </div>
    </Card>
  );
}


