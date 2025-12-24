"use client";

import * as React from "react";
import Link from "next/link";

import { Button, Card } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";

export function PlayerFilmStatusWidget() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [latest, setLatest] = React.useState<{
    _id: string;
    title: string;
    status: string;
    createdAt?: string;
  } | null>(null);
  const [latestEval, setLatestEval] = React.useState<{ overallGrade: number; createdAt?: string } | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      setLoading(true);
      try {
        const token = getAccessToken();
        const role = getTokenRole(token);
        if (!token) throw new Error("Please login first.");
        if (role && role !== "player") return;

        const res = await apiFetch<{ results: Array<{ _id: string; title: string; status: string; createdAt?: string }> }>(
          "/film-submissions/me",
          { token }
        );
        const first = (res.results ?? [])[0] ?? null;
        if (cancelled) return;
        setLatest(first);

        if (first?.status === "completed") {
          const report = await apiFetch<{ overallGrade: number; createdAt?: string }>(`/evaluations/film/${first._id}`, { token }).catch(
            () => null
          );
          if (!cancelled) setLatestEval(report);
        } else {
          setLatestEval(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load film status");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card>
      <div className="text-sm font-semibold">Film & evaluation status</div>

      {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}

      {loading ? (
        <p className="mt-2 text-sm text-white/80">Loading…</p>
      ) : latest ? (
        <div className="mt-3 grid gap-2 text-sm text-white/80">
          <div>
            Latest: <span className="font-semibold text-white">{latest.title}</span>
          </div>
          <div>
            Status: <span className="font-semibold text-white">{latest.status}</span>
            {latest.createdAt ? <span className="text-white/60"> · {new Date(latest.createdAt).toLocaleString()}</span> : null}
          </div>
          {latest.status === "completed" ? (
            <div>
              Evaluation:{" "}
              {latestEval ? (
                <span className="font-semibold text-white">
                  {latestEval.overallGrade}/10{latestEval.createdAt ? ` · ${new Date(latestEval.createdAt).toLocaleString()}` : ""}
                </span>
              ) : (
                <span className="text-white/70">Ready</span>
              )}
            </div>
          ) : (
            <div className="text-white/70">Submit film to start an evaluation.</div>
          )}
        </div>
      ) : (
        <p className="mt-2 text-sm text-white/80">No film submitted yet. Submit your first film to start an evaluation.</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link href="/player/film">
          <Button type="button">Submit / manage film</Button>
        </Link>
        {latest?._id ? (
          <Link href={`/player/film/${encodeURIComponent(latest._id)}${latest.status === "completed" ? "?view=evaluation" : ""}`} className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
            Open latest
          </Link>
        ) : null}
      </div>
    </Card>
  );
}


