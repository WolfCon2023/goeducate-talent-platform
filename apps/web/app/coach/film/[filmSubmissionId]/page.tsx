"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Card, Button } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { CoachGuard } from "../../Guard";

type FilmSubmission = {
  _id: string;
  userId: string;
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
  rubric?: unknown;
};

function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export default function CoachFilmDetailPage() {
  const params = useParams<{ filmSubmissionId: string }>();
  const search = useSearchParams();
  const filmSubmissionId = String(params?.filmSubmissionId ?? "").trim();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [film, setFilm] = useState<FilmSubmission | null>(null);

  const [evalLoading, setEvalLoading] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const evalRef = useRef<HTMLDivElement | null>(null);

  const showEvaluation = useMemo(() => String(search?.get("view") ?? "").toLowerCase() === "evaluation", [search]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      setLoading(true);
      try {
        const token = getAccessToken();
        if (!token) throw new Error("Please login first.");
        const res = await apiFetch<FilmSubmission>(`/film-submissions/${encodeURIComponent(filmSubmissionId)}`, { token });
        if (!cancelled) setFilm(res);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load film");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (filmSubmissionId) void load();
    return () => {
      cancelled = true;
    };
  }, [filmSubmissionId]);

  useEffect(() => {
    let cancelled = false;
    async function loadEval() {
      setEvalError(null);
      setEvalLoading(true);
      try {
        const token = getAccessToken();
        if (!token) throw new Error("Please login first.");
        const res = await apiFetch<EvaluationReport>(`/evaluations/film/${encodeURIComponent(filmSubmissionId)}`, { token });
        if (!cancelled) setReport(res);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to load evaluation";
        if (!cancelled) {
          if (msg === "Evaluation not found") setReport(null);
          else setEvalError(msg);
        }
      } finally {
        if (!cancelled) setEvalLoading(false);
      }
    }
    if (!filmSubmissionId) return;
    if (showEvaluation || film?.status === "completed") void loadEval();
    return () => {
      cancelled = true;
    };
  }, [filmSubmissionId, film?.status, showEvaluation]);

  useEffect(() => {
    if (!showEvaluation) return;
    const t = setTimeout(() => {
      evalRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
    return () => clearTimeout(t);
  }, [showEvaluation, report, evalError, evalLoading]);

  return (
    <CoachGuard>
      <div className="grid gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Film submission</h1>
          <Link href="/coach" className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
            Back to coach dashboard
          </Link>
        </div>

        {error ? (
          <Card>
            <div className="text-sm text-red-300">{error}</div>
          </Card>
        ) : null}

        {loading ? (
          <Card>
            <div className="text-sm text-white/80">Loading…</div>
          </Card>
        ) : null}

        {film ? (
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">{film.title}</div>
                <div className="mt-1 text-sm text-white/80">
                  Status: <span className="font-semibold text-white">{film.status}</span>
                </div>
                <div className="mt-1 text-sm text-white/80">Submitted: {fmtDate(film.createdAt)}</div>
                {film.opponent ? <div className="mt-1 text-sm text-white/80">Opponent: {film.opponent}</div> : null}
                {film.gameDate ? <div className="mt-1 text-sm text-white/80">Game date: {fmtDate(film.gameDate)}</div> : null}
              </div>
              {film.videoUrl ? (
                <a
                  href={film.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                >
                  View video
                </a>
              ) : null}
            </div>

            {film.notes ? (
              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm font-semibold">Notes</div>
                <div className="mt-2 whitespace-pre-wrap text-sm text-white/80">{film.notes}</div>
              </div>
            ) : null}

            <div ref={evalRef} className="mt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold">Evaluation</div>
                {report && !evalLoading ? (
                  <div className="text-sm text-white/80">Grade: {report.overallGrade}/10</div>
                ) : null}
              </div>

              {evalError ? <div className="mt-2 text-sm text-red-300">{evalError}</div> : null}
              {evalLoading ? <div className="mt-2 text-sm text-white/80">Loading evaluation…</div> : null}

              {report ? (
                <div className="mt-3 grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs text-white/60">Created: {fmtDate(report.createdAt)}</div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-white/60">Strengths</div>
                    <div className="mt-2 whitespace-pre-wrap text-sm text-white/90">{report.strengths}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-white/60">Improvements</div>
                    <div className="mt-2 whitespace-pre-wrap text-sm text-white/90">{report.improvements}</div>
                  </div>
                  {report.notes ? (
                    <div>
                      <div className="text-xs uppercase tracking-wide text-white/60">Notes</div>
                      <div className="mt-2 whitespace-pre-wrap text-sm text-white/90">{report.notes}</div>
                    </div>
                  ) : null}
                </div>
              ) : report === null && (film.status === "completed" || showEvaluation) ? (
                <div className="mt-2 text-sm text-white/80">No evaluation found yet.</div>
              ) : null}
            </div>

            <div className="mt-6">
              <Link href="/coach">
                <Button type="button" className="border border-white/15 bg-white/5 text-white hover:bg-white/10">
                  Back
                </Button>
              </Link>
            </div>
          </Card>
        ) : null}
      </div>
    </CoachGuard>
  );
}


