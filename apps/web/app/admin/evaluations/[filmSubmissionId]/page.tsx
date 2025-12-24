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
  _id: string;
  filmSubmissionId: string;
  overallGrade: number;
  overallGradeRaw?: number;
  suggestedProjectionLabel?: string;
  evaluatorUserId?: string;
  strengths: string;
  improvements: string;
  notes?: string;
  createdAt?: string;
  rubric?: unknown;
};

type EvaluationFormDef = {
  _id: string;
  title: string;
  sport?: string;
  categories: Array<{
    key: string;
    label: string;
    weight: number;
    traits: Array<{
      key: string;
      label: string;
      description?: string;
      type: "slider" | "select";
      required?: boolean;
      min?: number;
      max?: number;
      step?: number;
      options?: Array<{ value: string; label: string; score?: number }>;
    }>;
  }>;
};

type Enriched = {
  film: FilmSubmission;
  report: EvaluationReport | null;
  evaluator: { id: string; email?: string | null; firstName?: string | null; lastName?: string | null } | null;
  form: EvaluationFormDef | null;
  rubricBreakdown: Array<{ key: string; label: string; weight: number; average: number | null }> | null;
};

function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function evaluatorLabel(e?: Enriched["evaluator"] | null) {
  if (!e) return "—";
  const name = `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim();
  return name ? `${name}${e.email ? ` (${e.email})` : ""}` : e.email ?? "—";
}

function isProjectionTraitKey(key: string) {
  return String(key ?? "").toLowerCase().includes("projection");
}

function rubricValue(report: EvaluationReport | null, traitKey: string): { kind: "select" | "slider"; value?: string | number } | null {
  const rubric: any = report?.rubric as any;
  const cats: any[] = Array.isArray(rubric?.categories) ? rubric.categories : [];
  for (const c of cats) {
    const traits: any[] = Array.isArray(c?.traits) ? c.traits : [];
    for (const t of traits) {
      if (String(t?.key) !== traitKey) continue;
      if (t?.valueOption != null) return { kind: "select", value: String(t.valueOption) };
      if (t?.valueNumber != null) return { kind: "slider", value: Number(t.valueNumber) };
      return null;
    }
  }
  return null;
}

export default function AdminEvaluationDetailPage() {
  const params = useParams<{ filmSubmissionId: string }>();
  const filmSubmissionId = String(params?.filmSubmissionId ?? "").trim();

  const [data, setData] = useState<Enriched | null>(null);
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

        const bundle = await apiFetch<Enriched>(`/admin/evaluations/film/${encodeURIComponent(filmSubmissionId)}`, { token });

        if (cancelled) return;
        setData(bundle);
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

  const film = data?.film ?? null;
  const report = data?.report ?? null;

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
                {report ? (
                  <div className="text-sm text-white/80">
                    Grade: <span className="font-semibold text-white">{report.overallGrade}</span>/10
                    {typeof report.overallGradeRaw === "number" ? (
                      <span className="text-white/60"> · avg {report.overallGradeRaw.toFixed(2)}</span>
                    ) : null}
                    {report.suggestedProjectionLabel ? <span className="text-white/60"> · {report.suggestedProjectionLabel}</span> : null}
                  </div>
                ) : null}
              </div>

              {report ? (
                <div className="mt-3 grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/60">
                    <div>Created: {fmtDate(report.createdAt)}</div>
                    <div>Submitted by: {evaluatorLabel(data?.evaluator)}</div>
                  </div>

                  {data?.rubricBreakdown?.length ? (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <div className="text-xs uppercase tracking-wide text-white/60">Rubric summary (by category)</div>
                      <div className="mt-3 grid gap-2">
                        {data.rubricBreakdown.map((c) => (
                          <div key={c.key} className="flex items-center justify-between gap-3 text-sm">
                            <div className="text-white/90">
                              <span className="font-semibold text-white">{c.label}</span>{" "}
                              <span className="text-white/60">({c.weight}%)</span>
                            </div>
                            <div className="text-white/80">
                              {c.average == null ? "—" : `${c.average.toFixed(2)}/10`}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {data?.form?.categories?.length ? (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <div className="text-xs uppercase tracking-wide text-white/60">Rubric scores (by trait)</div>
                      <div className="mt-1 text-xs text-white/60">Form: {data.form.title}</div>
                      <div className="mt-4 grid gap-4">
                        {data.form.categories.map((cat) => (
                          <div key={cat.key} className="rounded-xl border border-white/10 bg-white/5 p-4">
                            <div className="flex items-baseline justify-between gap-3">
                              <div className="font-semibold text-white">{cat.label}</div>
                              <div className="text-xs text-white/60">Weight: {cat.weight}%</div>
                            </div>
                            <div className="mt-3 grid gap-2">
                              {cat.traits
                                .filter((t) => !isProjectionTraitKey(t.key))
                                .map((t) => {
                                  const v = rubricValue(report, t.key);
                                  let display = "—";
                                  if (t.type === "select") {
                                    const optVal = v?.kind === "select" ? String(v.value ?? "") : "";
                                    const opt = (t.options ?? []).find((o) => o.value === optVal);
                                    display = opt ? `${opt.label}${typeof opt.score === "number" ? ` (${opt.score})` : ""}` : optVal || "—";
                                  } else {
                                    const n = v?.kind === "slider" ? Number(v.value) : NaN;
                                    display = Number.isFinite(n) ? `${n}/10` : "—";
                                  }
                                  return (
                                    <div key={t.key} className="flex flex-wrap items-start justify-between gap-3">
                                      <div className="text-sm text-white/90">
                                        {t.label} {t.required === false ? <span className="text-white/60">(optional)</span> : null}
                                        {t.description ? <div className="mt-1 text-xs text-white/60">{t.description}</div> : null}
                                      </div>
                                      <div className="text-sm font-semibold text-white">{display}</div>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-white/70">
                      Rubric details unavailable (missing form definition).
                    </div>
                  )}

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
                  No evaluation report exists yet for this submission.
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {!report ? (
                <Button
                  type="button"
                  className="border border-white/15 bg-white/5 text-white hover:bg-white/10"
                  onClick={() => setShowForm((p) => !p)}
                >
                  {showForm ? "Hide evaluation form" : "Open evaluation form (create report)"}
                </Button>
              ) : (
                <Button
                  type="button"
                  className="border border-white/15 bg-white/5 text-white hover:bg-white/10"
                  onClick={() => setShowForm((p) => !p)}
                >
                  {showForm ? "Hide evaluation form" : "Open evaluation form (edit/resubmit)"}
                </Button>
              )}
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


