"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Card, Button, Input, Label } from "@/components/ui";
import { toast } from "@/components/ToastProvider";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";

type Sport = "football" | "basketball" | "volleyball" | "soccer" | "track" | "other";

type EvaluationFormDef = {
  _id: string;
  title: string;
  sport: Sport;
  strengthsPrompt: string;
  improvementsPrompt: string;
  notesHelp?: string;
  categories: Array<{
    key: "physical" | "athletic" | "technical" | "mental" | "intangibles";
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

type Draft = {
  version: 1;
  sport: Sport;
  formId?: string;
  filmSubmissionId?: string;
  playerUserId?: string;
  rubric: Record<string, { n?: number; o?: string; note?: string }>;
  strengths: string;
  improvements: string;
  notes: string;
  updatedAt: string;
};

function draftKey(opts: { sport: Sport; filmSubmissionId?: string | null }) {
  const id = opts.filmSubmissionId ? `film:${opts.filmSubmissionId}` : `sport:${opts.sport}`;
  return `goeducate.evalNotesDraft:v1:${id}`;
}

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function buildRubricPayload(formDef: EvaluationFormDef | null, rubric: Draft["rubric"]) {
  if (!formDef) return null;
  return {
    formId: formDef._id,
    categories: formDef.categories.map((c) => ({
      key: c.key,
      traits: c.traits.map((t) => {
        const v = rubric[t.key] ?? {};
        return {
          key: t.key,
          ...(t.type === "select" ? { valueOption: v.o ?? undefined } : { valueNumber: typeof v.n === "number" ? v.n : undefined })
        };
      })
    }))
  };
}

function buildMarkdown(formDef: EvaluationFormDef | null, draft: Draft) {
  const lines: string[] = [];
  lines.push(`# Evaluator Notes`);
  lines.push(`Sport: ${draft.sport}`);
  if (draft.formId) lines.push(`Form ID: ${draft.formId}`);
  if (draft.filmSubmissionId) lines.push(`FilmSubmissionId: ${draft.filmSubmissionId}`);
  lines.push("");

  if (formDef) {
    for (const c of formDef.categories) {
      lines.push(`## ${c.label}`);
      for (const t of c.traits) {
        const v = draft.rubric[t.key] ?? {};
        const score = t.type === "select" ? (v.o ? `${v.o}` : "") : typeof v.n === "number" ? `${v.n}/10` : "";
        const note = (v.note ?? "").trim();
        lines.push(`- **${t.label}**${score ? `: ${score}` : ""}${note ? ` — ${note}` : ""}`);
      }
      lines.push("");
    }
  }

  lines.push(`## Strengths`);
  lines.push(draft.strengths.trim() ? draft.strengths.trim() : "(none)");
  lines.push("");
  lines.push(`## Improvements`);
  lines.push(draft.improvements.trim() ? draft.improvements.trim() : "(none)");
  lines.push("");
  lines.push(`## Notes`);
  lines.push(draft.notes.trim() ? draft.notes.trim() : "(none)");
  lines.push("");
  return lines.join("\n");
}

export function EvaluatorNotesTool() {
  const search = useSearchParams();
  const filmSubmissionId = search.get("filmSubmissionId");

  const [sport, setSport] = React.useState<Sport>("football");
  const [formDef, setFormDef] = React.useState<EvaluationFormDef | null>(null);
  const [loadingForm, setLoadingForm] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [rubric, setRubric] = React.useState<Draft["rubric"]>({});
  const [strengths, setStrengths] = React.useState("");
  const [improvements, setImprovements] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [cloudStatus, setCloudStatus] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [cloudSavedAt, setCloudSavedAt] = React.useState<string | null>(null);

  const key = React.useMemo(() => draftKey({ sport, filmSubmissionId }), [sport, filmSubmissionId]);

  async function loadForm(nextSport: Sport) {
    setError(null);
    setLoadingForm(true);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "evaluator" && role !== "admin") throw new Error("Evaluator only.");
      const res = await apiFetch<EvaluationFormDef>(`/evaluation-forms/active?sport=${encodeURIComponent(nextSport)}`, { token });
      setFormDef(res);
    } catch (err) {
      setFormDef(null);
      setError(err instanceof Error ? err.message : "Failed to load evaluation form");
    } finally {
      setLoadingForm(false);
    }
  }

  // Initial sport from query, if provided.
  React.useEffect(() => {
    const qsSport = (search.get("sport") ?? "").toLowerCase();
    const allowed: Sport[] = ["football", "basketball", "volleyball", "soccer", "track", "other"];
    if (allowed.includes(qsSport as Sport)) setSport(qsSport as Sport);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load form on sport change.
  React.useEffect(() => {
    void loadForm(sport);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sport]);

  // Load draft from localStorage when key changes.
  React.useEffect(() => {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
    const d = safeJsonParse<Draft>(raw);
    if (d && d.version === 1) {
      setRubric(d.rubric ?? {});
      setStrengths(d.strengths ?? "");
      setImprovements(d.improvements ?? "");
      setNotes(d.notes ?? "");
    } else {
      setRubric({});
      setStrengths("");
      setImprovements("");
      setNotes("");
    }
  }, [key]);

  // Load draft from server (per evaluator account) and merge with local (newest wins).
  React.useEffect(() => {
    async function loadRemote() {
      try {
        const token = getAccessToken();
        const role = getTokenRole(token);
        if (!token) return;
        if (role !== "evaluator" && role !== "admin") return;

        const res = await apiFetch<{ items: Array<{ payload: Draft; updatedAt: string }> }>(
          `/evaluator/notes/drafts?key=${encodeURIComponent(key)}&limit=1`,
          { token }
        );
        const item = res.items?.[0];
        if (!item?.payload) return;

        const remoteDraft = item.payload;
        if (!remoteDraft || remoteDraft.version !== 1) return;

        const rawLocal = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
        const localDraft = safeJsonParse<Draft>(rawLocal);
        const localTs = localDraft?.updatedAt ? Date.parse(localDraft.updatedAt) : 0;
        const remoteTs = remoteDraft.updatedAt ? Date.parse(remoteDraft.updatedAt) : 0;

        if (remoteTs > localTs) {
          setRubric(remoteDraft.rubric ?? {});
          setStrengths(remoteDraft.strengths ?? "");
          setImprovements(remoteDraft.improvements ?? "");
          setNotes(remoteDraft.notes ?? "");
          if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(remoteDraft));
        }
        setCloudSavedAt(remoteDraft.updatedAt ?? null);
        setCloudStatus("saved");
      } catch {
        // Non-fatal. Local draft is still available.
      }
    }
    void loadRemote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Autosave draft.
  React.useEffect(() => {
    const handle = setTimeout(() => {
      if (typeof window === "undefined") return;
      const draft: Draft = {
        version: 1,
        sport,
        formId: formDef?._id,
        filmSubmissionId: filmSubmissionId ?? undefined,
        rubric,
        strengths,
        improvements,
        notes,
        updatedAt: new Date().toISOString()
      };
      window.localStorage.setItem(key, JSON.stringify(draft));
    }, 350);
    return () => clearTimeout(handle);
  }, [sport, formDef?._id, filmSubmissionId, rubric, strengths, improvements, notes, key]);

  // Autosave to server (debounced). This enables returning to drafts across devices.
  React.useEffect(() => {
    async function saveRemote(d: Draft) {
      try {
        const token = getAccessToken();
        const role = getTokenRole(token);
        if (!token) return;
        if (role !== "evaluator" && role !== "admin") return;
        setCloudStatus("saving");
        const res = await apiFetch<{ updatedAt: string }>(`/evaluator/notes/drafts`, {
          method: "PUT",
          token,
          body: JSON.stringify({
            key,
            sport,
            filmSubmissionId: filmSubmissionId ?? undefined,
            formId: formDef?._id,
            payload: d
          })
        });
        setCloudSavedAt((res as any).updatedAt ?? new Date().toISOString());
        setCloudStatus("saved");
      } catch {
        setCloudStatus("error");
      }
    }

    const handle = setTimeout(() => {
      const d: Draft = {
        version: 1,
        sport,
        formId: formDef?._id,
        filmSubmissionId: filmSubmissionId ?? undefined,
        rubric,
        strengths,
        improvements,
        notes,
        updatedAt: new Date().toISOString()
      };
      void saveRemote(d);
    }, 1500);

    return () => clearTimeout(handle);
  }, [key, sport, filmSubmissionId, formDef?._id, rubric, strengths, improvements, notes]);

  const requiredMissing = React.useMemo(() => {
    if (!formDef) return [];
    const missing: string[] = [];
    for (const c of formDef.categories) {
      for (const t of c.traits) {
        const req = t.required !== false;
        if (!req) continue;
        const v = rubric[t.key] ?? {};
        const ok = t.type === "select" ? Boolean(v.o) : typeof v.n === "number" && Number.isFinite(v.n);
        if (!ok) missing.push(t.label);
      }
    }
    return missing;
  }, [formDef, rubric]);

  async function copy(text: string, title: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast({ kind: "success", title, message: "Copied to clipboard." });
    } catch {
      toast({ kind: "error", title, message: "Could not copy. Your browser may block clipboard access." });
    }
  }

  async function copyRubricJson() {
    const payload = buildRubricPayload(formDef, rubric);
    if (!payload) return;
    await copy(JSON.stringify(payload, null, 2), "Rubric JSON");
  }

  async function copyFullPayload() {
    const payload = {
      sport,
      rubric: buildRubricPayload(formDef, rubric),
      strengths,
      improvements,
      notes
    };
    await copy(JSON.stringify(payload, null, 2), "Evaluation payload");
  }

  async function copyMarkdownNotes() {
    const d: Draft = {
      version: 1,
      sport,
      formId: formDef?._id,
      filmSubmissionId: filmSubmissionId ?? undefined,
      rubric,
      strengths,
      improvements,
      notes,
      updatedAt: new Date().toISOString()
    };
    await copy(buildMarkdown(formDef, d), "Formatted notes");
  }

  function clearDraft() {
    if (typeof window !== "undefined") window.localStorage.removeItem(key);
    setRubric({});
    setStrengths("");
    setImprovements("");
    setNotes("");
    toast({ kind: "info", title: "Cleared", message: "Draft cleared." });
  }

  return (
    <div className="grid gap-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-white">Notes builder</div>
            <div className="mt-1 text-sm text-white/80">
              Fill out the rubric and add evidence notes. When done, copy the output into the evaluation form.
            </div>
            {filmSubmissionId ? (
              <div className="mt-2 text-xs text-white/60">
                Film submission context: <span className="font-mono">{filmSubmissionId}</span>{" "}
                <span className="text-white/50">·</span>{" "}
                <Link className="text-indigo-300 hover:text-indigo-200 hover:underline" href={`/evaluator/film/${encodeURIComponent(filmSubmissionId)}`}>
                  Open evaluation →
                </Link>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="border border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={copyRubricJson} disabled={!formDef}>
              Copy rubric JSON
            </Button>
            <Button type="button" className="border border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={copyMarkdownNotes}>
              Copy formatted notes
            </Button>
            <Button type="button" onClick={copyFullPayload}>
              Copy full payload
            </Button>
            <Button type="button" className="border border-red-500/30 bg-red-500/10 text-red-100 hover:bg-red-500/20" onClick={clearDraft}>
              Clear
            </Button>
          </div>
        </div>

        <div className="mt-4 text-xs text-white/60">
          Draft status: <span className="text-white/80">Autosaved locally</span>
          {" · "}
          <span className={cloudStatus === "error" ? "text-red-300" : cloudStatus === "saving" ? "text-amber-200" : "text-emerald-200"}>
            {cloudStatus === "saving"
              ? "Saving to your account…"
              : cloudStatus === "saved"
                ? `Saved to your account${cloudSavedAt ? ` (${new Date(cloudSavedAt).toLocaleString()})` : ""}`
                : cloudStatus === "error"
                  ? "Could not save to your account (local draft is safe)."
                  : "Not saved to your account yet."}
          </span>
        </div>

        {error ? <div className="mt-4 text-sm text-red-300">{error}</div> : null}

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="notesSport">Sport</Label>
            <select
              id="notesSport"
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              value={sport}
              onChange={(e) => setSport(e.target.value as Sport)}
            >
              <option value="football">Football</option>
              <option value="basketball">Basketball</option>
              <option value="volleyball">Volleyball</option>
              <option value="soccer">Soccer</option>
              <option value="track">Track</option>
              <option value="other">Other</option>
            </select>
            <div className="text-xs text-white/60">{loadingForm ? "Loading form…" : formDef ? `Form: ${formDef.title}` : "Form not loaded."}</div>
          </div>
          <div className="sm:col-span-2 rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold text-white">Required fields</div>
            <div className="mt-2 text-sm text-white/80">
              {requiredMissing.length === 0 ? (
                <span className="text-emerald-200">All required rubric fields filled.</span>
              ) : (
                <>
                  Missing: <span className="text-white/90">{requiredMissing.slice(0, 6).join(", ")}</span>
                  {requiredMissing.length > 6 ? ` (and ${requiredMissing.length - 6} more)` : ""}
                </>
              )}
            </div>
            <div className="mt-2 text-xs text-white/60">
              Tip: You can leave evidence notes even if you are not ready to choose a score yet.
            </div>
          </div>
        </div>
      </Card>

      {formDef ? (
        <Card>
          <div className="grid gap-6">
            {formDef.categories.map((c) => (
              <div key={c.key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-sm font-semibold text-white">{c.label}</div>
                  <div className="text-xs text-white/60">Weight: {c.weight}%</div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  {c.traits.map((t) => {
                    const v = rubric[t.key] ?? {};
                    return (
                      <div key={t.key} className="rounded-xl border border-white/10 bg-white/5 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-white">
                              {t.label} {t.required === false ? <span className="text-white/60">(optional)</span> : null}
                            </div>
                            {t.description ? <div className="mt-1 text-xs text-white/60">{t.description}</div> : null}
                          </div>
                        </div>

                        <div className="mt-3 grid gap-3">
                          {t.type === "select" ? (
                            <select
                              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                              value={v.o ?? ""}
                              onChange={(e) =>
                                setRubric((prev) => ({
                                  ...prev,
                                  [t.key]: { ...prev[t.key], o: e.target.value || undefined }
                                }))
                              }
                            >
                              <option value="">Select…</option>
                              {(t.options ?? []).map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <div className="grid gap-2">
                              <input
                                type="range"
                                min={t.min ?? 1}
                                max={t.max ?? 10}
                                step={t.step ?? 1}
                                value={typeof v.n === "number" ? v.n : (t.min ?? 1)}
                                onChange={(e) =>
                                  setRubric((prev) => ({
                                    ...prev,
                                    [t.key]: { ...prev[t.key], n: Number(e.target.value) }
                                  }))
                                }
                              />
                              <div className="flex items-center justify-between text-xs text-white/70">
                                <span>{t.min ?? 1}</span>
                                <span className="text-white/90 font-semibold">{typeof v.n === "number" ? `${v.n}/10` : "—"}</span>
                                <span>{t.max ?? 10}</span>
                              </div>
                            </div>
                          )}

                          <textarea
                            className="min-h-20 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 placeholder:text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                            placeholder="Evidence notes, timecodes, observations..."
                            value={v.note ?? ""}
                            onChange={(e) =>
                              setRubric((prev) => ({
                                ...prev,
                                [t.key]: { ...prev[t.key], note: e.target.value }
                              }))
                            }
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card>
        <div className="grid gap-4">
          <div>
            <div className="text-sm font-semibold text-white">Strengths</div>
            {formDef ? <div className="mt-2 text-xs text-white/60 whitespace-pre-wrap">{formDef.strengthsPrompt}</div> : null}
            <textarea
              className="mt-3 min-h-28 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 placeholder:text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
              placeholder="- Strength 1 (evidence)\n- Strength 2 (evidence)"
            />
          </div>

          <div>
            <div className="text-sm font-semibold text-white">Improvements</div>
            {formDef ? <div className="mt-2 text-xs text-white/60 whitespace-pre-wrap">{formDef.improvementsPrompt}</div> : null}
            <textarea
              className="mt-3 min-h-28 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 placeholder:text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              value={improvements}
              onChange={(e) => setImprovements(e.target.value)}
              placeholder="- Improvement 1 (how to improve)\n- Improvement 2 (how to improve)"
            />
          </div>

          <div>
            <div className="text-sm font-semibold text-white">Notes</div>
            {formDef?.notesHelp ? <div className="mt-2 text-xs text-white/60 whitespace-pre-wrap">{formDef.notesHelp}</div> : null}
            <textarea
              className="mt-3 min-h-24 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 placeholder:text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional additional context, caveats, or timecodes..."
            />
          </div>
        </div>
      </Card>
    </div>
  );
}


