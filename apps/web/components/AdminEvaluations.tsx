"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Card, Input, RefreshIconButton } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";

type Row = {
  _id: string;
  userId: string;
  title: string;
  status: string;
  createdAt?: string;
  player?: {
    id?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    sport?: string;
    position?: string;
  };
  evaluation?: {
    id?: string;
    createdAt?: string;
    overallGrade?: number;
    sport?: string;
    position?: string;
    evaluatorEmail?: string;
  } | null;
};

function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function playerLabel(r: Row) {
  const name = `${r.player?.firstName ?? ""} ${r.player?.lastName ?? ""}`.trim();
  return name || r.player?.email || "Unknown player";
}

export function AdminEvaluations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");
  const [hasEval, setHasEval] = useState<string>("");
  const [page, setPage] = useState(1);

  const limit = 25;
  const skip = (page - 1) * limit;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("skip", String(skip));
    if (q.trim()) params.set("q", q.trim());
    if (status) params.set("status", status);
    if (hasEval) params.set("hasEval", hasEval);
    return params.toString();
  }, [q, status, hasEval, skip]);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "admin") throw new Error("Insufficient permissions.");

      const res = await apiFetch<{ total: number; results: Row[] }>(`/admin/evaluations?${query}`, { token });
      setResults(res.results ?? []);
      setTotal(Number(res.total ?? 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load evaluations");
    } finally {
      setLoading(false);
    }
  }

  // Reset to first page when filters change
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status, hasEval]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Evaluations</h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Admin table of film submissions with evaluation status. Open any record, regardless of status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshIconButton onClick={load} loading={loading} />
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1">
          <div className="text-xs text-[color:var(--muted-2)]">Search</div>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Player name/email, film title, evaluator email…"
          />
        </div>

        <div className="grid gap-1">
          <div className="text-xs text-[color:var(--muted-2)]">Film status</div>
          <select
            className="w-full rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)]"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All</option>
            <option value="submitted">Submitted</option>
            <option value="in_review">In review</option>
            <option value="needs_changes">Needs changes</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div className="grid gap-1">
          <div className="text-xs text-[color:var(--muted-2)]">Has evaluation report</div>
          <select
            className="w-full rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)]"
            value={hasEval}
            onChange={(e) => setHasEval(e.target.value)}
          >
            <option value="">All</option>
            <option value="1">Yes</option>
            <option value="0">No</option>
          </select>
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

      <div className="mt-5 overflow-x-auto rounded-2xl border border-[color:var(--border)]">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-[var(--surface)]/80">
            <tr className="text-left text-[color:var(--muted)]">
              <th className="px-4 py-3 font-semibold">Film</th>
              <th className="px-4 py-3 font-semibold">Player</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Eval</th>
              <th className="px-4 py-3 font-semibold">Evaluator</th>
              <th className="px-4 py-3 font-semibold">Submitted</th>
              <th className="px-4 py-3 font-semibold">Open</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--border)]">
            {results.map((r) => (
              <tr key={r._id} className="align-top">
                <td className="px-4 py-3">
                  <div className="font-semibold text-[color:var(--foreground)]">{r.title}</div>
                  <div className="mt-1 text-xs text-[color:var(--muted-2)]">{r._id}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-[color:var(--foreground)]">{playerLabel(r)}</div>
                  <div className="mt-1 text-xs text-[color:var(--muted-2)]">
                    {r.player?.sport ? `${r.player.sport}` : "—"}
                    {r.player?.position ? ` · ${r.player.position}` : ""}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/90">
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {r.evaluation?.id ? (
                    <div className="text-[color:var(--foreground)]">
                      Grade: <span className="font-semibold">{r.evaluation.overallGrade ?? "—"}</span>/10
                      <div className="mt-1 text-xs text-[color:var(--muted-2)]">{fmtDate(r.evaluation.createdAt)}</div>
                    </div>
                  ) : (
                    <div className="text-[color:var(--muted)]">No report</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="text-[color:var(--muted)]">{r.evaluation?.evaluatorEmail ?? "—"}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-[color:var(--muted)]">{fmtDate(r.createdAt)}</div>
                </td>
                <td className="px-4 py-3">
                  <Link
                    className="text-indigo-300 hover:text-indigo-200 hover:underline"
                    href={`/admin/evaluations/${encodeURIComponent(r._id)}`}
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
            {results.length === 0 && !error ? (
              <tr>
                <td className="px-4 py-6 text-sm text-[color:var(--muted)]" colSpan={7}>
                  No results.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[color:var(--muted)]">
        <div>
          Showing <span className="text-[color:var(--foreground)]">{results.length}</span> of{" "}
          <span className="text-[color:var(--foreground)]">{total}</span> (page {page} of {totalPages})
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-1.5 text-sm text-[color:var(--foreground)] hover:bg-[var(--surface)] disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <button
            type="button"
            className="rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-1.5 text-sm text-[color:var(--foreground)] hover:bg-[var(--surface)] disabled:opacity-50"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      </div>
    </Card>
  );
}


