"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Card, RefreshIconButton } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";
import { AdminGuard } from "../../../Guard";

type Film = { _id: string; title: string; createdAt?: string; status: string };
type Eval = { filmSubmissionId: string; overallGrade: number; createdAt?: string };

function fmt(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export default function AdminPlayerEvaluationsPage() {
  const params = useParams<{ userId: string }>();
  const userId = String(params?.userId ?? "").trim();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [films, setFilms] = useState<Film[]>([]);
  const [evals, setEvals] = useState<Eval[]>([]);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "admin") throw new Error("Insufficient permissions.");

      const [filmsRes, evalRes] = await Promise.all([
        apiFetch<{ results: Film[] }>(`/film-submissions/player/${encodeURIComponent(userId)}`, { token }),
        apiFetch<{ results: Eval[] }>(`/evaluations/player/${encodeURIComponent(userId)}`, { token })
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
    if (userId) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const rows = useMemo(() => {
    const byFilm = new Map(films.map((f) => [f._id, f]));
    return (evals ?? [])
      .map((r) => {
        const f = byFilm.get(String(r.filmSubmissionId));
        return {
          filmId: String(r.filmSubmissionId),
          filmTitle: f?.title ?? "Film submission",
          filmStatus: f?.status ?? "—",
          submittedAt: f?.createdAt,
          evalAt: r.createdAt,
          grade: r.overallGrade
        };
      })
      .sort((a, b) => (b.evalAt ?? "").localeCompare(a.evalAt ?? ""));
  }, [films, evals]);

  return (
    <AdminGuard>
      <div className="grid gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Player evaluations</h1>
            <p className="mt-2 text-sm text-white/80">Evaluation history for player id: {userId}</p>
          </div>
          <div className="flex items-center gap-3">
            <RefreshIconButton onClick={load} loading={loading} />
            <Link href="/admin" className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
              Back to admin
            </Link>
          </div>
        </div>

        {error ? (
          <Card>
            <div className="text-sm text-red-300">{error}</div>
          </Card>
        ) : null}

        <Card>
          <div className="text-sm font-semibold">Evaluations ({rows.length})</div>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-white/5 text-left text-white/70">
                <tr>
                  <th className="px-4 py-3 font-semibold">Film</th>
                  <th className="px-4 py-3 font-semibold">Film status</th>
                  <th className="px-4 py-3 font-semibold">Submitted</th>
                  <th className="px-4 py-3 font-semibold">Eval grade</th>
                  <th className="px-4 py-3 font-semibold">Evaluated</th>
                  <th className="px-4 py-3 font-semibold">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {rows.map((r) => (
                  <tr key={r.filmId}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white">{r.filmTitle}</div>
                      <div className="mt-1 text-xs text-white/50">{r.filmId}</div>
                    </td>
                    <td className="px-4 py-3 text-white/80">{r.filmStatus}</td>
                    <td className="px-4 py-3 text-white/70">{fmt(r.submittedAt)}</td>
                    <td className="px-4 py-3 text-white/80">
                      <span className="font-semibold text-white">{r.grade}</span>/10
                    </td>
                    <td className="px-4 py-3 text-white/70">{fmt(r.evalAt)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/evaluations/${encodeURIComponent(r.filmId)}`} className="text-indigo-300 hover:text-indigo-200 hover:underline">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
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
    </AdminGuard>
  );
}


