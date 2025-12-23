"use client";

import { useCallback, useEffect, useState } from "react";

import { Button, Card, RefreshIconButton } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole, getTokenSub } from "@/lib/auth";
import { useConfirm } from "@/components/ConfirmDialog";

type FilmSubmission = {
  _id: string;
  title: string;
  opponent?: string;
  gameDate?: string;
  createdAt?: string;
  status: string;
  userId: string;
  assignedEvaluatorUserId?: string;
  assignedAt?: string;
  assignedEvaluator?: { _id?: string; email?: string } | null;
  playerProfile?: {
    firstName?: string;
    lastName?: string;
    position?: string;
    gradYear?: number;
    city?: string;
    state?: string;
  } | null;
};

export function EvaluatorQueue() {
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<FilmSubmission[]>([]);
  const [view, setView] = useState<"all" | "mine">(() => {
    // Default to "all" so new submissions are visible even before assignment.
    // Persist the user's choice across sessions.
    try {
      const raw = window.localStorage.getItem("goeducate:evaluatorQueueView");
      if (raw === "mine" || raw === "all") return raw;
    } catch {}
    return "all";
  });

  useEffect(() => {
    try {
      window.localStorage.setItem("goeducate:evaluatorQueueView", view);
    } catch {}
  }, [view]);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "evaluator" && role !== "admin") throw new Error("Insufficient permissions.");
      const mine = view === "mine" ? "?mine=1" : "";
      const res = await apiFetch<{ results: FilmSubmission[] }>(`/film-submissions/queue${mine}`, { token });
      setResults(res.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load queue");
    } finally {
      setLoading(false);
    }
  }, [view]);

  async function assignToMe(id: string) {
    setError(null);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "evaluator" && role !== "admin") throw new Error("Insufficient permissions.");
      await apiFetch(`/film-submissions/${id}/assignment`, { method: "PATCH", token, body: JSON.stringify({ action: "assign_to_me" }) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign");
    }
  }

  async function unassign(id: string) {
    setError(null);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "evaluator" && role !== "admin") throw new Error("Insufficient permissions.");
      await apiFetch(`/film-submissions/${id}/assignment`, { method: "PATCH", token, body: JSON.stringify({ action: "unassign" }) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unassign");
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

  async function returnForEdits(id: string) {
    const ok = await confirm({
      title: "Return submission for edits?",
      message: "This will move the submission to Needs changes and notify the player.",
      confirmText: "Return",
      cancelText: "Cancel",
      destructive: true
    });
    if (!ok) return;

    setError(null);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "evaluator" && role !== "admin") throw new Error("Insufficient permissions.");
      await apiFetch(`/film-submissions/${id}/status`, { method: "PATCH", token, body: JSON.stringify({ status: "needs_changes" }) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to return for edits");
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Queue</h2>
          <p className="mt-1 text-sm text-white/80">Includes submitted and in-review. Oldest first.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-1">
            <button
              type="button"
              onClick={() => setView("all")}
              className={`rounded-xl px-3 py-1.5 text-sm ${view === "all" ? "bg-indigo-600 text-white" : "text-white/80 hover:bg-white/10"}`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setView("mine")}
              className={`rounded-xl px-3 py-1.5 text-sm ${view === "mine" ? "bg-indigo-600 text-white" : "text-white/80 hover:bg-white/10"}`}
            >
              My queue
            </button>
          </div>
          <RefreshIconButton onClick={load} loading={loading} />
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

      <div className="mt-6 grid gap-3">
        {results.map((s) => {
          const token = getAccessToken();
          const myId = getTokenSub(token);
          const assignedToMe = myId && s.assignedEvaluatorUserId && String(s.assignedEvaluatorUserId) === String(myId);
          const assignedLabel = s.assignedEvaluator?.email
            ? `Assigned: ${s.assignedEvaluator.email}`
            : s.assignedEvaluatorUserId
              ? "Assigned"
              : "Unassigned";
          return (
          <div key={s._id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="font-semibold">{s.title}</div>
              <div className="text-xs uppercase tracking-wide text-white/70">{s.status.replace("_", " ")}</div>
            </div>
            <div className="mt-1 text-sm text-white/80">
              {s.opponent ? <>Opponent: {s.opponent}</> : null}
              {s.opponent && s.gameDate ? " · " : null}
              {s.gameDate ? <>Game date: {new Date(s.gameDate).toLocaleDateString()}</> : null}
            </div>
            <div className="mt-2 text-xs text-white/60">{assignedLabel}</div>
            <div className="mt-2 text-xs text-white/60">
              {s.playerProfile?.firstName ? (
                <>
                  Player: {s.playerProfile.firstName} {s.playerProfile.lastName}
                  {s.playerProfile.position ? ` · ${s.playerProfile.position}` : ""}
                  {typeof s.playerProfile.gradYear === "number" ? ` · ${s.playerProfile.gradYear}` : ""}
                  {s.playerProfile.city && s.playerProfile.state ? ` · ${s.playerProfile.city}, ${s.playerProfile.state}` : ""}
                </>
              ) : (
                <>Player: (profile not created yet)</>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" onClick={() => assignToMe(s._id)} disabled={loading || !!s.assignedEvaluatorUserId}>
                Assign to me
              </Button>
              {assignedToMe ? (
                <Button type="button" className="border border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={() => unassign(s._id)}>
                  Unassign
                </Button>
              ) : null}
              <Button
                type="button"
                onClick={() => markInReview(s._id)}
                disabled={loading || (s.status !== "submitted" && s.status !== "needs_changes")}
              >
                Mark in review
              </Button>
              <Button
                type="button"
                className="border border-white/15 bg-white/5 text-white hover:bg-white/10"
                onClick={() => returnForEdits(s._id)}
                disabled={loading || s.status !== "in_review"}
              >
                Return for edits
              </Button>
              <a
                className="rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
                href={`/evaluator/film/${s._id}`}
              >
                Complete evaluation
              </a>
            </div>
          </div>
        )})}
        {results.length === 0 && !error ? <p className="text-sm text-white/70">No submissions in queue.</p> : null}
      </div>
    </Card>
  );
}


