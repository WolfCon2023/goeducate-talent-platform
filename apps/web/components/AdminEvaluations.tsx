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
  ageHours?: number | null;
  isOverdue?: boolean;
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

export function AdminEvaluations(props?: { initialQ?: string; initialStatus?: string; initialHasEval?: string; initialHasAssigned?: string }) {
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [kpis, setKpis] = useState<{ open: number; unassigned: number; overdue: number; avgOpenAgeHours: number | null } | null>(null);
  const [overdueHours, setOverdueHours] = useState<number>(72);

  const [evalUsers, setEvalUsers] = useState<UserRow[]>([]);
  const [evalUsersLoading, setEvalUsersLoading] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [bulkAssignee, setBulkAssignee] = useState<string>("");
  const [bulkNote, setBulkNote] = useState<string>("");
  const [bulkWorking, setBulkWorking] = useState(false);
  const [rowNote, setRowNote] = useState<Record<string, string>>({});

  const [q, setQ] = useState(props?.initialQ ?? "");
  const [status, setStatus] = useState<string>(props?.initialStatus ?? "");
  const [hasEval, setHasEval] = useState<string>(props?.initialHasEval ?? "");
  const [hasAssigned, setHasAssigned] = useState<string>(props?.initialHasAssigned ?? "");
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

      const res = await apiFetch<{ total: number; results: Row[]; kpis?: any; overdueHours?: number }>(`/admin/evaluations?${query}`, { token });
      setResults(res.results ?? []);
      setTotal(Number(res.total ?? 0));
      if (res.kpis) {
        setKpis({
          open: Number(res.kpis.open) || 0,
          unassigned: Number(res.kpis.unassigned) || 0,
          overdue: Number(res.kpis.overdue) || 0,
          avgOpenAgeHours: typeof res.kpis.avgOpenAgeHours === "number" ? res.kpis.avgOpenAgeHours : null
        });
      } else {
        setKpis(null);
      }
      if (typeof res.overdueHours === "number" && Number.isFinite(res.overdueHours)) setOverdueHours(res.overdueHours);

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
    setSelectedIds({});
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
        body: JSON.stringify({ action: "assign", evaluatorUserId: next, force, note: String(rowNote[filmSubmissionId] ?? "").trim() })
      });
      toast({ kind: "success", title: "Assigned", message: "Submission assigned." });
      setRowNote((p) => ({ ...p, [filmSubmissionId]: "" }));
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
        body: JSON.stringify({ action: "unassign", note: String(rowNote[filmSubmissionId] ?? "").trim() })
      });
      toast({ kind: "success", title: "Unassigned", message: "Submission unassigned." });
      setRowNote((p) => ({ ...p, [filmSubmissionId]: "" }));
      await load();
    } catch (err) {
      toast({ kind: "error", title: "Unassign failed", message: err instanceof Error ? err.message : "Could not unassign." });
    }
  }

  const selectedCount = Object.values(selectedIds).filter(Boolean).length;
  const allOnPageSelected = results.length > 0 && results.every((r) => Boolean(selectedIds[r._id]));

  async function bulkAssignSelected() {
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "admin") throw new Error("Insufficient permissions.");

      const evaluatorUserId = bulkAssignee.trim();
      if (!evaluatorUserId) {
        toast({ kind: "error", title: "Missing evaluator", message: "Select an evaluator for bulk assignment." });
        return;
      }

      const ids = Object.entries(selectedIds).filter(([, v]) => v).map(([id]) => id);
      if (!ids.length) return;

      const selectedRows = results.filter((r) => ids.includes(r._id));
      const needsReassign = selectedRows.some((r) => {
        const current = r.assignedEvaluator?.id ?? r.assignedEvaluatorUserId ?? null;
        return current && String(current) !== evaluatorUserId;
      });
      let force = false;
      if (needsReassign) {
        const ok = await confirm({
          title: "Reassign selected submissions?",
          message: "Some selected submissions are already assigned. Reassigning will move them to the chosen evaluator.",
          confirmText: "Reassign",
          cancelText: "Cancel",
          destructive: true
        });
        if (!ok) return;
        force = true;
      }

      setBulkWorking(true);
      for (const filmSubmissionId of ids) {
        await apiFetch(`/film-submissions/${encodeURIComponent(filmSubmissionId)}/assignment`, {
          method: "PATCH",
          token,
          body: JSON.stringify({ action: "assign", evaluatorUserId, force, note: bulkNote.trim() })
        });
      }
      toast({ kind: "success", title: "Assigned", message: `Assigned ${ids.length} submission(s).` });
      setSelectedIds({});
      setBulkNote("");
      await load();
    } catch (err) {
      toast({ kind: "error", title: "Bulk assign failed", message: err instanceof Error ? err.message : "Could not assign." });
    } finally {
      setBulkWorking(false);
    }
  }

  async function bulkUnassignSelected() {
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "admin") throw new Error("Insufficient permissions.");

      const ids = Object.entries(selectedIds).filter(([, v]) => v).map(([id]) => id);
      if (!ids.length) return;
      const ok = await confirm({
        title: "Unassign selected submissions?",
        message: "This will remove evaluator assignments for the selected submissions.",
        confirmText: "Unassign",
        cancelText: "Cancel",
        destructive: true
      });
      if (!ok) return;

      setBulkWorking(true);
      for (const filmSubmissionId of ids) {
        await apiFetch(`/film-submissions/${encodeURIComponent(filmSubmissionId)}/assignment`, {
          method: "PATCH",
          token,
          body: JSON.stringify({ action: "unassign", note: bulkNote.trim() })
        });
      }
      toast({ kind: "success", title: "Unassigned", message: `Unassigned ${ids.length} submission(s).` });
      setSelectedIds({});
      setBulkNote("");
      await load();
    } catch (err) {
      toast({ kind: "error", title: "Bulk unassign failed", message: err instanceof Error ? err.message : "Could not unassign." });
    } finally {
      setBulkWorking(false);
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

      <div className="mt-5 grid gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] p-4">
          <div className="text-xs uppercase tracking-wide text-[color:var(--muted-2)]">Open</div>
          <div className="mt-1 text-2xl font-semibold text-[color:var(--foreground)]">{kpis?.open ?? "—"}</div>
        </div>
        <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] p-4">
          <div className="text-xs uppercase tracking-wide text-[color:var(--muted-2)]">Unassigned</div>
          <div className="mt-1 text-2xl font-semibold text-[color:var(--foreground)]">{kpis?.unassigned ?? "—"}</div>
        </div>
        <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] p-4">
          <div className="text-xs uppercase tracking-wide text-[color:var(--muted-2)]">Overdue</div>
          <div className={`mt-1 text-2xl font-semibold ${kpis && kpis.overdue > 0 ? "text-amber-300" : "text-[color:var(--foreground)]"}`}>
            {kpis?.overdue ?? "—"}
          </div>
          <div className="mt-1 text-xs text-[color:var(--muted-2)]">SLA: {overdueHours}h</div>
        </div>
        <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] p-4">
          <div className="text-xs uppercase tracking-wide text-[color:var(--muted-2)]">Avg age (open)</div>
          <div className="mt-1 text-2xl font-semibold text-[color:var(--foreground)]">{kpis?.avgOpenAgeHours != null ? `${kpis.avgOpenAgeHours}h` : "—"}</div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] p-4 text-sm text-[color:var(--muted)]">
        <span className="font-semibold text-[color:var(--foreground)]">SLA policy:</span> submissions in{" "}
        <span className="font-semibold text-[color:var(--foreground)]">submitted / in_review / needs_changes</span> older than{" "}
        <span className="font-semibold text-[color:var(--foreground)]">{overdueHours} hours</span> are considered overdue. Use assignment notes to capture reassignment/triage context (stored in submission history).
      </div>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] p-4">
        <div className="text-sm text-[color:var(--muted)]">
          Selected: <span className="font-semibold text-[color:var(--foreground)]">{selectedCount}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="w-64 rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] disabled:opacity-50"
            value={bulkAssignee}
            disabled={evalUsersLoading || bulkWorking}
            onChange={(e) => setBulkAssignee(e.target.value)}
          >
            <option value="">{evalUsersLoading ? "Loading evaluators…" : "Bulk: select evaluator…"}</option>
            {evalUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email}
              </option>
            ))}
          </select>
          <Button type="button" disabled={!selectedCount || bulkWorking} onClick={() => void bulkAssignSelected()}>
            {bulkWorking ? "Working…" : "Assign selected"}
          </Button>
          <Button type="button" disabled={!selectedCount || bulkWorking} onClick={() => void bulkUnassignSelected()}>
            {bulkWorking ? "Working…" : "Unassign selected"}
          </Button>
        </div>
        <div className="w-full">
          <div className="text-xs text-[color:var(--muted-2)]">Assignment note (optional)</div>
          <input
            className="mt-1 w-full rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)]"
            value={bulkNote}
            onChange={(e) => setBulkNote(e.target.value)}
            placeholder="e.g. overdue rescue, reassign due to workload, needs follow-up…"
          />
        </div>
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-[color:var(--border)]">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-[var(--surface)]/80">
            <tr className="text-left text-[color:var(--muted)]">
              <th className="px-4 py-3 font-semibold">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={(e) => {
                    const next = e.target.checked;
                    const patch: Record<string, boolean> = {};
                    for (const r of results) patch[r._id] = next;
                    setSelectedIds((prev) => ({ ...prev, ...patch }));
                  }}
                />
              </th>
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
              <tr key={r._id} className={`align-top ${r.isOverdue ? "bg-amber-500/10" : ""}`}>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedIds[r._id])}
                    onChange={(e) => setSelectedIds((prev) => ({ ...prev, [r._id]: e.target.checked }))}
                    disabled={bulkWorking}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-[color:var(--foreground)]">{r.title}</div>
                  <div className="mt-1 text-xs text-[color:var(--muted-2)]">{r._id}</div>
                  {r.isOverdue ? <div className="mt-2 inline-flex rounded-md bg-amber-500/15 px-2 py-1 text-xs font-semibold text-amber-200">Overdue</div> : null}
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
                    <input
                      className="w-full rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)]"
                      value={rowNote[r._id] ?? ""}
                      onChange={(e) => setRowNote((p) => ({ ...p, [r._id]: e.target.value }))}
                      placeholder="Assignment note (optional)"
                      disabled={r.status === "completed"}
                    />
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
                <td className="px-4 py-6 text-sm text-[color:var(--muted)]" colSpan={10}>
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


