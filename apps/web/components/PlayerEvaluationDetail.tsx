"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button, Card } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";

type FilmSubmission = {
  _id: string;
  title: string;
  opponent?: string;
  gameDate?: string;
  status: string;
  videoUrl?: string;
  notes?: string;
  createdAt?: string;
};

type EvaluationReport = {
  _id: string;
  filmSubmissionId: string;
  sport?: string;
  position?: string;
  positionOther?: string;
  overallGrade: number;
  overallGradeRaw?: number;
  rubric?: {
    categories: Array<{
      key: string;
      traits: Array<{ key: string; valueNumber?: number; valueOption?: string }>;
    }>;
  };
  strengths: string;
  improvements: string;
  notes?: string;
  createdAt?: string;
};

function suggestedProjectionFromAverage(avg: number) {
  if (avg >= 9) return "Elite Upside";
  if (avg >= 7.5) return "High Upside";
  if (avg >= 6) return "Solid";
  return "Developmental";
}

export function PlayerEvaluationDetail(props: { filmSubmissionId: string }) {
  const filmSubmissionId = props.filmSubmissionId;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [film, setFilm] = useState<FilmSubmission | null>(null);
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  async function load() {
    setError(null);
    setReportError(null);
    setLoading(true);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role && role !== "player") throw new Error("This page is only available to player accounts.");

      const f = await apiFetch<FilmSubmission>(`/film-submissions/${filmSubmissionId}`, { token });
      setFilm(f);

      try {
        const r = await apiFetch<EvaluationReport>(`/evaluations/film/${filmSubmissionId}`, { token });
        setReport(r);
      } catch (err) {
        // Evaluation might not exist yet.
        setReport(null);
        setReportError(err instanceof Error ? err.message : "No evaluation yet.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load evaluation");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filmSubmissionId]);

  const shareText = useMemo(() => {
    if (!film) return "";
    const lines = [
      `GoEducate Talent Platform – Evaluation`,
      ``,
      `Film: ${film.title}`,
      film.opponent ? `Opponent: ${film.opponent}` : null,
      film.gameDate ? `Game date: ${new Date(film.gameDate).toLocaleDateString()}` : null,
      `Status: ${film.status.replace("_", " ")}`,
      report ? `Overall grade: ${report.overallGrade}/10` : `Evaluation: not completed yet`,
      ``,
      `Link: ${typeof window !== "undefined" ? window.location.href : ""}`
    ].filter(Boolean) as string[];
    return lines.join("\n");
  }, [film, report]);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }

  function downloadJson() {
    const payload = { film, report };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `evaluation-${filmSubmissionId}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-start justify-between gap-6 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Evaluation</h1>
          <p className="mt-2 text-sm text-white/80">Full evaluation report for this film submission.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/player/film" className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
            Back to submissions
          </Link>
          <Button type="button" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{film?.title ?? (loading ? "Loading..." : "Film")}</h2>
            <div className="mt-1 text-sm text-white/80">
              {film?.opponent ? <>Opponent: {film.opponent}</> : null}
              {film?.opponent && film?.gameDate ? " · " : null}
              {film?.gameDate ? <>Game date: {new Date(film.gameDate).toLocaleDateString()}</> : null}
              {film ? ` · ${film.status.replace("_", " ")}` : null}
            </div>
            {film?.videoUrl ? (
              <div className="mt-2 text-sm print:hidden">
                <a className="text-indigo-300 hover:text-indigo-200 hover:underline" href={film.videoUrl} target="_blank" rel="noreferrer">
                  View video link
                </a>
              </div>
            ) : null}
            {film?.notes ? <p className="mt-3 text-sm text-white/80 whitespace-pre-wrap">{film.notes}</p> : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Button type="button" onClick={() => copy(window.location.href)} disabled={!film}>
              Copy link
            </Button>
            <Button type="button" onClick={() => copy(shareText)} disabled={!film}>
              Copy summary
            </Button>
            <Button type="button" onClick={() => window.print()} disabled={!film}>
              Print / Save PDF
            </Button>
            <Button type="button" onClick={downloadJson} disabled={!film}>
              Download JSON
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Evaluation report</h2>
          {report?.createdAt ? <div className="text-xs text-white/60">Created: {new Date(report.createdAt).toLocaleString()}</div> : null}
        </div>

        {report ? (
          <div className="mt-5 grid gap-5 text-sm text-white/90">
            {report.sport || report.position || report.positionOther ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-wide text-white/70">Sport / Position</div>
                <div className="mt-1 text-sm text-white/90">
                  {report.sport ? report.sport : "—"}
                  {" · "}
                  {report.position === "Other" ? report.positionOther ?? "Other" : report.position ?? "—"}
                </div>
              </div>
            ) : null}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-wide text-white/70">Overall grade</div>
              <div className="mt-1 text-2xl font-semibold">{report.overallGrade}/10</div>
            </div>

            {typeof report.overallGradeRaw === "number" ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-wide text-white/70">Average score</div>
                <div className="mt-1 flex flex-wrap items-baseline justify-between gap-3">
                  <div className="text-2xl font-semibold">{report.overallGradeRaw.toFixed(1)}/10</div>
                  <div className="text-sm text-white/80">Suggested projection: {suggestedProjectionFromAverage(report.overallGradeRaw)}</div>
                </div>
                <div className="mt-3 relative h-3 w-full overflow-hidden rounded-full border border-white/10 bg-white/5">
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(90deg, rgba(239,68,68,.85) 0%, rgba(245,158,11,.85) 35%, rgba(99,102,241,.9) 70%, rgba(16,185,129,.9) 100%)"
                    }}
                  />
                  <div
                    className="absolute top-0 h-full w-1 rounded-full bg-white"
                    style={{ left: `${Math.max(0, Math.min(100, ((report.overallGradeRaw - 1) / 9) * 100))}%` }}
                    aria-hidden
                  />
                </div>
              </div>
            ) : null}

            {report.rubric?.categories?.length ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-wide text-white/70">Rubric</div>
                <div className="mt-3 grid gap-4">
                  {report.rubric.categories.map((c) => (
                    <div key={c.key} className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="font-semibold text-white">{c.key}</div>
                      <div className="mt-2 grid gap-1 text-sm text-white/80">
                        {c.traits.map((t) => (
                          <div key={t.key} className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-white/90">{t.key}</div>
                            <div className="text-white/70">
                              {typeof t.valueNumber === "number" ? t.valueNumber : t.valueOption ?? "—"}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <div className="text-xs uppercase tracking-wide text-white/70">Strengths</div>
              <div className="mt-2 whitespace-pre-wrap">{report.strengths}</div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-white/70">Improvements</div>
              <div className="mt-2 whitespace-pre-wrap">{report.improvements}</div>
            </div>

            {report.notes ? (
              <div>
                <div className="text-xs uppercase tracking-wide text-white/70">Notes</div>
                <div className="mt-2 whitespace-pre-wrap">{report.notes}</div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-sm text-white/80">
              {reportError?.toLowerCase().includes("not found") || reportError?.toLowerCase().includes("no evaluation")
                ? "No evaluation yet. Check back once an evaluator completes your report."
                : reportError ?? "No evaluation yet."}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}


