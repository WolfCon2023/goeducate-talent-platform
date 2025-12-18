"use client";

import { useEffect, useState } from "react";

import { Button, Card } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";

type FilmSubmission = {
  _id: string;
  title: string;
  opponent?: string;
  gameDate?: string;
  createdAt?: string;
  status: string;
  userId: string;
};

export function EvaluatorQueue() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<FilmSubmission[]>([]);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "evaluator" && role !== "admin") throw new Error("Insufficient permissions.");
      const res = await apiFetch<{ results: FilmSubmission[] }>("/film-submissions/queue", { token });
      setResults(res.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load queue");
    } finally {
      setLoading(false);
    }
  }

  async function markInReview(id: string) {
    setError(null);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "evaluator" && role !== "admin") throw new Error("Insufficient permissions.");
      await apiFetch(`/film-submissions/${id}/status`, { method: "PATCH", token, body: JSON.stringify({ status: "in_review" }) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Submitted</h2>
          <p className="mt-1 text-sm text-slate-300">Oldest first.</p>
        </div>
        <Button type="button" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

      <div className="mt-6 grid gap-3">
        {results.map((s) => (
          <div key={s._id} className="rounded-lg border border-slate-800 bg-slate-950 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="font-semibold">{s.title}</div>
              <div className="text-xs uppercase tracking-wide text-slate-400">{s.status}</div>
            </div>
            <div className="mt-1 text-sm text-slate-300">
              {s.opponent ? <>Opponent: {s.opponent}</> : null}
              {s.opponent && s.gameDate ? " · " : null}
              {s.gameDate ? <>Game date: {new Date(s.gameDate).toLocaleDateString()}</> : null}
            </div>
            <div className="mt-2 text-xs text-slate-500">Player userId: {s.userId}</div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" onClick={() => markInReview(s._id)} disabled={loading || s.status !== "submitted"}>
                Mark in review
              </Button>
              <a
                className="rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
                href={`/evaluator/film/${s._id}?playerUserId=${encodeURIComponent(s.userId)}`}
              >
                Complete evaluation
              </a>
            </div>
          </div>
        ))}
        {results.length === 0 && !error ? <p className="text-sm text-slate-400">No submissions in queue.</p> : null}
      </div>
    </Card>
  );
}


