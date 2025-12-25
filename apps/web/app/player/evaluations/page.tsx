"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Card, RefreshIconButton } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole, getTokenSub } from "@/lib/auth";
import { PlayerGuard } from "../Guard";

type FilmSubmission = { _id: string; title: string; createdAt?: string; status: string };
type EvaluationReport = { filmSubmissionId: string; overallGrade: number; createdAt?: string };

function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export default function PlayerEvaluationsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [films, setFilms] = useState<FilmSubmission[]>([]);
  const [evals, setEvals] = useState<EvaluationReport[]>([]);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      const sub = getTokenSub(token);
      if (!token) throw new Error("Please login first.");
      if (role && role !== "player") throw new Error("Insufficient permissions.");
      if (!sub) throw new Error("Missing user id.");

      const [filmsRes, evalRes] = await Promise.all([
        apiFetch<{ results: FilmSubmission[] }>("/film-submissions/me", { token }),
        apiFetch<{ results: EvaluationReport[] }>(`/evaluations/player/${encodeURIComponent(sub)}`, { token })
      ]);
      setFilms(filmsRes.results ?? []);
      setEvals(evalRes.results ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load evaluations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => {
    const byFilm = new Map(films.map((f) => [f._id, f]));
    return (evals ?? [])
      .map((r) => {
        const f = byFilm.get(String(r.filmSubmissionId));
        return {
          filmId: String(r.filmSubmissionId),
          title: f?.title ?? "Film submission",
          filmStatus: f?.status ?? "—",
          submittedAt: f?.createdAt,
          evaluatedAt: r.createdAt,
          grade: r.overallGrade
        };
      })
      .sort((a, b) => (b.evaluatedAt ?? "").localeCompare(a.evaluatedAt ?? ""));
  }, [films, evals]);

  const avg = useMemo(() => {
    const grades = rows.map((r) => Number(r.grade ?? 0)).filter((g) => g > 0);
    if (!grades.length) return null;
    const sum = grades.reduce((a, b) => a + b, 0);
    return Math.round((sum / grades.length) * 100) / 100;
  }, [rows]);

  return (
    <PlayerGuard>
      <div className="grid gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Evaluations</h1>
            <p className="mt-2 text-sm text-white/80">Your completed evaluation reports.</p>
          </div>
          <div className="flex items-center gap-3">
            {avg != null ? <div className="text-sm text-white/80">Avg: <span className="font-semibold text-white">{avg}</span>/10</div> : null}
            <RefreshIconButton onClick={load} loading={loading} />
            <Link href="/player" className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
              Back to dashboard
            </Link>
          </div>
        </div>

        {error ? (
          <Card>
            <div className="text-sm text-red-300">{error}</div>
          </Card>
        ) : null}

        <Card>
          <div className="text-sm font-semibold">Recent evaluations ({rows.length})</div>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-white/5 text-left text-white/70">
                <tr>
                  <th className="px-4 py-3 font-semibold">Film</th>
                  <th className="px-4 py-3 font-semibold">Film status</th>
                  <th className="px-4 py-3 font-semibold">Submitted</th>
                  <th className="px-4 py-3 font-semibold">Grade</th>
                  <th className="px-4 py-3 font-semibold">Evaluated</th>
                  <th className="px-4 py-3 font-semibold">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {rows.map((r) => (
                  <tr key={r.filmId}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white">{r.title}</div>
                    </td>
                    <td className="px-4 py-3 text-white/80">{r.filmStatus}</td>
                    <td className="px-4 py-3 text-white/70">{fmtDate(r.submittedAt)}</td>
                    <td className="px-4 py-3 text-white/80">
                      <span className="font-semibold text-white">{r.grade}</span>/10
                    </td>
                    <td className="px-4 py-3 text-white/70">{fmtDate(r.evaluatedAt)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/player/film/${encodeURIComponent(r.filmId)}?view=evaluation`} className="text-indigo-300 hover:text-indigo-200 hover:underline">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && !loading ? (
                  <tr>
                    <td className="px-4 py-6 text-white/70" colSpan={6}>
                      No evaluations yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </PlayerGuard>
  );
}


