"use client";

import { useCallback, useEffect, useState } from "react";

import { Button, Card, Input, Label } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";

type FilmSubmission = {
  _id: string;
  title: string;
  opponent?: string;
  gameDate?: string;
  notes?: string;
  videoUrl?: string;
  status: string;
  createdAt?: string;
};

type EvaluationReport = {
  filmSubmissionId: string;
  overallGrade: number;
  strengths: string;
  improvements: string;
  notes?: string;
  createdAt?: string;
};

export function FilmSubmissions() {
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<FilmSubmission[]>([]);
  const [reports, setReports] = useState<Record<string, EvaluationReport | null>>({});
  const [reportLoading, setReportLoading] = useState<Record<string, boolean>>({});

  const [title, setTitle] = useState("");
  const [opponent, setOpponent] = useState("");
  const [gameDate, setGameDate] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Please login as a player first.");
      const role = getTokenRole(token);
      if (role && role !== "player") throw new Error("This page is only available to player accounts.");
      const res = await apiFetch<{ results: FilmSubmission[] }>("/film-submissions/me", { token });
      setResults(res.results);

      // Auto-load evaluations for completed submissions (cap to avoid too many requests).
      const completed = res.results.filter((r) => r.status === "completed").slice(0, 10);
      await Promise.all(
        completed.map(async (r) => {
          if (reports[r._id] !== undefined) return;
          await loadReport(r._id);
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load submissions");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadReport(filmSubmissionId: string) {
    setError(null);
    setReportLoading((p) => ({ ...p, [filmSubmissionId]: true }));
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login as a player first.");
      if (role && role !== "player") throw new Error("This page is only available to player accounts.");

      const report = await apiFetch<EvaluationReport>(`/evaluations/film/${filmSubmissionId}`, { token });
      setReports((p) => ({ ...p, [filmSubmissionId]: report }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load evaluation";
      // If no evaluation exists yet, keep it non-fatal and store null
      if (msg === "Evaluation not found") setReports((p) => ({ ...p, [filmSubmissionId]: null }));
      else setError(msg);
    } finally {
      setReportLoading((p) => ({ ...p, [filmSubmissionId]: false }));
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    setError(null);
    setCreating(true);
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Please login as a player first.");
      const role = getTokenRole(token);
      if (role && role !== "player") throw new Error("This page is only available to player accounts.");

      await apiFetch("/film-submissions", {
        method: "POST",
        token,
        body: JSON.stringify({
          title,
          opponent: opponent || undefined,
          gameDate: gameDate ? new Date(gameDate).toISOString() : undefined,
          videoUrl: videoUrl || undefined,
          notes: notes || undefined
        })
      });

      setTitle("");
      setOpponent("");
      setGameDate("");
      setVideoUrl("");
      setNotes("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create submission");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <h2 className="text-lg font-semibold">Submit film (manual MVP)</h2>
        <p className="mt-1 text-sm text-slate-300">
          Add game film metadata. Cloudinary uploads come later. For now, paste a hosted video URL if you have one.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Week 3 vs Central" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="opponent">Opponent</Label>
            <Input id="opponent" value={opponent} onChange={(e) => setOpponent(e.target.value)} placeholder="Central HS" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="gameDate">Game date</Label>
            <Input id="gameDate" type="date" value={gameDate} onChange={(e) => setGameDate(e.target.value)} />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="videoUrl">Video URL (optional)</Label>
            <Input
              id="videoUrl"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <textarea
              id="notes"
              className="min-h-28 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything you want evaluators to focus on..."
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button type="button" onClick={create} disabled={creating || !title.trim()}>
            {creating ? "Submitting..." : "Submit"}
          </Button>
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
        </div>
      </Card>

      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Your submissions</h2>
            <p className="mt-1 text-sm text-slate-300">Status is shown for evaluator workflow.</p>
          </div>
          <Button type="button" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        <div className="mt-6 grid gap-3">
          {results.map((s) => (
            <div key={s._id} className="rounded-lg border border-slate-800 bg-slate-950 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="font-semibold">{s.title}</div>
                <div
                  className={`text-xs uppercase tracking-wide ${
                    s.status === "completed"
                      ? "text-emerald-300"
                      : s.status === "in_review"
                        ? "text-amber-300"
                        : "text-slate-400"
                  }`}
                >
                  {s.status.replace("_", " ")}
                </div>
              </div>
              <div className="mt-1 text-sm text-slate-300">
                {s.opponent ? <>Opponent: {s.opponent}</> : null}
                {s.opponent && s.gameDate ? " · " : null}
                {s.gameDate ? <>Game date: {new Date(s.gameDate).toLocaleDateString()}</> : null}
              </div>
              {s.videoUrl ? (
                <div className="mt-2 text-sm">
                  <a className="text-slate-200 underline hover:text-white" href={s.videoUrl} target="_blank" rel="noreferrer">
                    View video link
                  </a>
                </div>
              ) : null}
              {s.notes ? <p className="mt-2 text-sm text-slate-300">{s.notes}</p> : null}

              {s.status === "completed" ? (
                <div className="mt-4">
                  <Button
                    type="button"
                    className="bg-slate-100"
                    onClick={() => loadReport(s._id)}
                    disabled={!!reportLoading[s._id]}
                  >
                    {reportLoading[s._id] ? "Loading evaluation..." : "View evaluation"}
                  </Button>

                  {reports[s._id] ? (
                    <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950 p-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="font-semibold">Evaluation</div>
                        <div className="text-sm text-slate-300">Grade: {reports[s._id]!.overallGrade}/10</div>
                      </div>
                      <div className="mt-3 grid gap-3 text-sm text-slate-200">
                        <div>
                          <div className="text-xs uppercase tracking-wide text-slate-400">Strengths</div>
                          <div className="mt-1 whitespace-pre-wrap">{reports[s._id]!.strengths}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wide text-slate-400">Improvements</div>
                          <div className="mt-1 whitespace-pre-wrap">{reports[s._id]!.improvements}</div>
                        </div>
                        {reports[s._id]!.notes ? (
                          <div>
                            <div className="text-xs uppercase tracking-wide text-slate-400">Notes</div>
                            <div className="mt-1 whitespace-pre-wrap">{reports[s._id]!.notes}</div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : reports[s._id] === null ? (
                    <p className="mt-3 text-sm text-slate-300">No evaluation yet.</p>
                  ) : null}
                </div>
              ) : s.status === "in_review" ? (
                <p className="mt-4 text-sm text-slate-300">In review. An evaluator is working on your film.</p>
              ) : (
                <p className="mt-4 text-sm text-slate-400">Submitted. Waiting for evaluator review.</p>
              )}
            </div>
          ))}
          {results.length === 0 ? <p className="text-sm text-slate-400">No submissions yet.</p> : null}
        </div>
      </Card>
    </div>
  );
}


