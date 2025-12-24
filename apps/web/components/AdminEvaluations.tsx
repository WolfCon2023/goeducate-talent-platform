"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useConfirm } from "@/components/ConfirmDialog";
import { toast } from "@/components/ToastProvider";
import { Button, Card, Input, RefreshIconButton } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";

type Row = {
  _id: string;
  userId: string;
  title: string;
  status: string;
  createdAt?: string;
  assignedAt?: string;
  assignedEvaluatorUserId?: string | null;
  assignedEvaluator?: { id?: string; email?: string } | null;
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
  reportEvaluator?: { id?: string; email?: string } | null;
};

type UserRow = { id: string; email: string; role: string; firstName?: string; lastName?: string };

function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function playerLabel(r: Row) {
  const name = `${r.player?.firstName ?? ""} ${r.player?.lastName ?? ""}`.trim();
  return name || r.player?.email || "Unknown player";
}

export function AdminEvaluations() {
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);

  const [evalUsers, setEvalUsers] = useState<UserRow[]>([]);
  const [evalUsersLoading, setEvalUsersLoading] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState<Record<string, string>>({});

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");
  const [hasEval, setHasEval] = useState<string>("");
  const [hasAssigned, setHasAssigned] = useState<string>("");
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
    if (hasAssigned) params.set("hasAssigned", hasAssigned);
    return params.toString();
  }, [q, status, hasEval, hasAssigned, skip]);

  async function loadEvaluators() {
    setEvalUsersLoading(true);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) return;
      if (role !== "admin") return;
      const res = await apiFetch<{ results: UserRow[] }>(`/admin/users?role=evaluator&limit=200`, { token });
      setEvalUsers(res.results ?? []);
    } catch {
      // non-fatal
      setEvalUsers([]);
    } finally {
      setEvalUsersLoading(false);
    }
  }

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

      // Set default assignee selection per row (assigned evaluator if present)
      const nextSel: Record<string, string> = {};
      for (const r of res.results ?? []) {
        const existing = selectedAssignee[r._id];
        nextSel[r._id] = existing ?? (r.assignedEvaluator?.id ? String(r.assignedEvaluator.id) : "");
      }
      setSelectedAssignee((prev) => ({ ...nextSel, ...prev }));
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
  }, [q, status, hasEval, hasAssigned]);

  useEffect(() => {
    void loadEvaluators();
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function assign(filmSubmissionId: string, currentAssignedId: string | null | undefined) {
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "admin") throw new Error("Insufficient permissions.");

      const next = String(selectedAssignee[filmSubmissionId] ?? "").trim();
      if (!next) {
        toast({ kind: "error", title: "Missing evaluator", message: "Select an evaluator to assign." });
        return;
      }
      if (currentAssignedId && String(currentAssignedId) === next) {
        toast({ kind: "info", title: "No change", message: "Already assigned to that evaluator." });
        return;
      }

      let force = false;
      if (currentAssignedId && String(currentAssignedId) !== next) {
        const ok = await confirm({
          title: "Reassign submission?",
          message: "This submission is already assigned. Reassigning will move it to the selected evaluator.",
          confirmText: "Reassign",
          cancelText: "Cancel",
          destructive: true
        });
        if (!ok) return;
        force = true;
      }

      await apiFetch(`/film-submissions/${encodeURIComponent(filmSubmissionId)}/assignment`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ action: "assign", evaluatorUserId: next, force })
      });
      toast({ kind: "success", title: "Assigned", message: "Submission assigned." });
      await load();
    } catch (err) {
      toast({ kind: "error", title: "Assign failed", message: err instanceof Error ? err.message : "Could not assign." });
    }
  }

  async function unassign(filmSubmissionId: string) {
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "admin") throw new Error("Insufficient permissions.");

      const ok = await confirm({
        title: "Unassign submission?",
        message: "This will remove the evaluator assignment and return the submission to the unassigned queue.",
        confirmText: "Unassign",
        cancelText: "Cancel",
        destructive: true
      });
      if (!ok) return;

      await apiFetch(`/film-submissions/${encodeURIComponent(filmSubmissionId)}/assignment`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ action: "unassign" })
      });
      toast({ kind: "success", title: "Unassigned", message: "Submission unassigned." });
      await load();
    } catch (err) {
      toast({ kind: "error", title: "Unassign failed", message: err instanceof Error ? err.message : "Could not unassign." });
    }
  }

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

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
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

        <div className="grid gap-1">
          <div className="text-xs text-[color:var(--muted-2)]">Assigned</div>
          <select
            className="w-full rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)]"
            value={hasAssigned}
            onChange={(e) => setHasAssigned(e.target.value)}
          >
            <option value="">All</option>
            <option value="1">Assigned</option>
            <option value="0">Unassigned</option>
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
              <th className="px-4 py-3 font-semibold">Assigned evaluator</th>
              <th className="px-4 py-3 font-semibold">Report evaluator</th>
              <th className="px-4 py-3 font-semibold">Assignment</th>
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
                  <div className="text-[color:var(--muted)]">{r.assignedEvaluator?.email ?? "—"}</div>
                  {r.assignedAt ? <div className="mt-1 text-xs text-[color:var(--muted-2)]">{fmtDate(r.assignedAt)}</div> : null}
                </td>
                <td className="px-4 py-3">
                  <div className="text-[color:var(--muted)]">{r.reportEvaluator?.email ?? (r.evaluation?.evaluatorEmail ?? "—")}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="grid gap-2">
                    <select
                      className="w-full rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] disabled:opacity-50"
                      value={selectedAssignee[r._id] ?? (r.assignedEvaluator?.id ? String(r.assignedEvaluator.id) : "")}
                      disabled={evalUsersLoading || r.status === "completed"}
                      onChange={(e) => setSelectedAssignee((p) => ({ ...p, [r._id]: e.target.value }))}
                    >
                      <option value="">{evalUsersLoading ? "Loading evaluators…" : "Select evaluator…"}</option>
                      {evalUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.email}
                        </option>
                      ))}
                    </select>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="button" disabled={r.status === "completed"} onClick={() => assign(r._id, r.assignedEvaluator?.id ?? r.assignedEvaluatorUserId)}>
                        Assign
                      </Button>
                      <Button type="button" disabled={!r.assignedEvaluator?.id && !r.assignedEvaluatorUserId} onClick={() => unassign(r._id)}>
                        Unassign
                      </Button>
                    </div>
                    {r.status === "completed" ? <div className="text-xs text-[color:var(--muted-2)]">Completed items can’t be assigned.</div> : null}
                  </div>
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
                <td className="px-4 py-6 text-sm text-[color:var(--muted)]" colSpan={9}>
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


