"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Card, Button } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";

type FilmSubmission = {
  _id: string;
  status: string;
  title: string;
  createdAt?: string;
};

export function PlayerFilmStatusWidget() {
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
      if (role && role !== "player") throw new Error("This page is only available to player accounts.");

      const res = await apiFetch<{ results: FilmSubmission[] }>("/film-submissions/me", { token });
      setResults(res.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load film status");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const counts = useMemo(() => {
    const c = { submitted: 0, in_review: 0, completed: 0 };
    for (const r of results) {
      if (r.status === "submitted") c.submitted += 1;
      else if (r.status === "in_review") c.in_review += 1;
      else if (r.status === "completed") c.completed += 1;
    }
    return c;
  }, [results]);

  const latest = useMemo(() => {
    if (!results.length) return null;
    return results
      .slice()
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))[0];
  }, [results]);

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Evaluation status</h2>
          <p className="mt-1 text-sm text-white/80">Track where your film is in the evaluation process.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button type="button" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
          <Link href="/player/film" className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
            View submissions
          </Link>
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs uppercase tracking-wide text-white/70">Submitted</div>
          <div className="mt-1 text-2xl font-semibold">{counts.submitted}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs uppercase tracking-wide text-white/70">In review</div>
          <div className="mt-1 text-2xl font-semibold">{counts.in_review}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs uppercase tracking-wide text-white/70">Completed</div>
          <div className="mt-1 text-2xl font-semibold">{counts.completed}</div>
        </div>
      </div>

      {latest ? (
        <p className="mt-4 text-sm text-white/80">
          Latest: <span className="text-white">{latest.title}</span> ({latest.status.replace("_", " ")})
        </p>
      ) : (
        <p className="mt-4 text-sm text-white/70">No submissions yet.</p>
      )}
    </Card>
  );
}


