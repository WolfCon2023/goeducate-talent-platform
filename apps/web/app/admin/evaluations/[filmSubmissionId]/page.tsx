"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Card, Button } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";
import { AdminGuard } from "../../Guard";
import { EvaluatorEvaluationForm } from "@/components/EvaluatorEvaluationForm";

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
  updatedAt?: string;
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

export default function AdminEvaluationDetailPage() {
  const params = useParams<{ filmSubmissionId: string }>();
  const filmSubmissionId = String(params?.filmSubmissionId ?? "").trim();

  const [film, setFilm] = useState<FilmSubmission | null>(null);
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      setLoading(true);
      try {
        const token = getAccessToken();
        const role = getTokenRole(token);
        if (!token) throw new Error("Please login first.");
        if (role !== "admin") throw new Error("Insufficient permissions.");

        const filmRes = await apiFetch<FilmSubmission>(`/film-submissions/${encodeURIComponent(filmSubmissionId)}`, { token });
        const evalRes = await apiFetch<EvaluationReport>(`/evaluations/film/${encodeURIComponent(filmSubmissionId)}`, { token }).catch(
          (e) => {
            const msg = e instanceof Error ? e.message : "Failed to load evaluation";
            if (msg === "Evaluation not found") return null;
            throw e;
          }
        );

        if (cancelled) return;
        setFilm(filmRes);
        setReport(evalRes);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load evaluation");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (filmSubmissionId) void load();
    return () => {
      cancelled = true;
    };
  }, [filmSubmissionId]);

  return (
    <AdminGuard>
      <div className="grid gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Evaluation (admin)</h1>
          <Link href="/admin" className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
            Back to admin
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
                <div className="mt-1 text-xs text-white/60">FilmSubmissionId: {film._id}</div>
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

            <div className="mt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold">Evaluation report</div>
                {report ? <div className="text-sm text-white/80">Grade: {report.overallGrade}/10</div> : null}
              </div>

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
              ) : (
                <div className="mt-2 text-sm text-white/80">
                  No evaluation report exists yet for this submission. (Admins can still open the evaluation form below.
                  )
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button type="button" className="border border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={() => setShowForm((p) => !p)}>
                {showForm ? "Hide evaluation form" : "Open evaluation form"}
              </Button>
              <Link href="/admin#admin-evaluations" className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
                Back to evaluations table
              </Link>
            </div>

            {showForm ? (
              <div className="mt-6">
                <EvaluatorEvaluationForm filmSubmissionId={filmSubmissionId} />
              </div>
            ) : null}
          </Card>
        ) : null}
      </div>
    </AdminGuard>
  );
}


