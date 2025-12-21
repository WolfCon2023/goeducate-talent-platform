"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button, Card, Input, Label } from "@/components/ui";
import { useConfirm } from "@/components/ConfirmDialog";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";

type Sport = "football" | "basketball" | "volleyball" | "soccer" | "track" | "other";

const POSITIONS_BY_SPORT: Record<Exclude<Sport, "other">, string[]> = {
  football: [
    "Quarterback (QB)",
    "Running Back (RB)",
    "Fullback (FB)",
    "Wide Receiver (WR)",
    "Tight End (TE)",
    "Center (C)",
    "Guard (G)",
    "Tackle (T)",
    "Defensive Tackle (DT)",
    "Defensive End (DE)",
    "Linebacker (LB)",
    "Inside Linebacker (ILB)",
    "Outside Linebacker (OLB)",
    "Cornerback (CB)",
    "Free Safety (FS)",
    "Strong Safety (SS)",
    "Kicker (K)",
    "Punter (P)",
    "Long Snapper (LS)",
    "Return Specialist (KR/PR)"
  ],
  basketball: ["Point Guard (PG)", "Shooting Guard (SG)", "Small Forward (SF)", "Power Forward (PF)", "Center (C)", "Combo Guard", "Wing", "Forward"],
  volleyball: ["Outside Hitter", "Opposite Hitter", "Middle Blocker", "Setter", "Libero", "Defensive Specialist"],
  soccer: [
    "Goalkeeper",
    "Center Back",
    "Left Back",
    "Right Back",
    "Wing Back",
    "Defensive Midfielder",
    "Central Midfielder",
    "Attacking Midfielder",
    "Winger",
    "Forward",
    "Striker"
  ],
  track: [
    "100m",
    "200m",
    "400m",
    "800m",
    "1500m",
    "Mile",
    "3000m",
    "5000m",
    "10000m",
    "110m Hurdles",
    "100m Hurdles",
    "400m Hurdles",
    "4x100m Relay",
    "4x400m Relay",
    "Long Jump",
    "Triple Jump",
    "High Jump",
    "Pole Vault",
    "Shot Put",
    "Discus",
    "Javelin",
    "Hammer Throw",
    "Decathlon",
    "Heptathlon"
  ]
};

function sportLabel(s: Sport) {
  if (s === "football") return "Football";
  if (s === "basketball") return "Basketball";
  if (s === "volleyball") return "Volleyball";
  if (s === "soccer") return "Soccer";
  if (s === "track") return "Track";
  return "Other";
}

function templateFor(sport: Sport, position: string, positionOther: string) {
  const pos = position === "Other" || sport === "other" ? positionOther || "Other" : position;

  const strengthsBase = [
    `- Athleticism / movement quality:`,
    `- Competitiveness / motor:`,
    `- Coachability indicators (effort, response to adversity):`,
    `- Play recognition / decision-making (where applicable):`
  ].join("\n");

  const improvementsBase = [
    `- Technique fundamentals to improve:`,
    `- Consistency (rep-to-rep execution):`,
    `- Physical development (strength, speed, mobility) goals:`,
    `- Film study focus / situational awareness:`
  ].join("\n");

  // Sport-specific guidance (kept concise but high-signal).
  const sportNotes: Record<Sport, { s: string; i: string }> = {
    football: {
      s: `- Football-specific: pad level, leverage, hand placement, contact balance, play speed.`,
      i: `- Football-specific: footwork, block/strike timing, route/coverage discipline, tackling/ball skills.`
    },
    basketball: {
      s: `- Basketball-specific: handle under pressure, spacing, off-ball movement, finishing/shot profile.`,
      i: `- Basketball-specific: shot mechanics consistency, defensive stance/closeouts, decision speed.`
    },
    volleyball: {
      s: `- Volleyball-specific: approach timing, verticality, arm swing, serve/receive fundamentals.`,
      i: `- Volleyball-specific: footwork patterns, reading hitters/blocks, serve pressure, transition speed.`
    },
    soccer: {
      s: `- Soccer-specific: first touch, scanning, passing weight, defensive positioning, transition speed.`,
      i: `- Soccer-specific: weak-foot development, decision speed, pressing angles, endurance/pace management.`
    },
    track: {
      s: `- Track-specific: mechanics (posture, knee drive), rhythm, acceleration, competitive execution.`,
      i: `- Track-specific: technical cues, starts/turns/hurdles (as applicable), strength & mobility plan.`
    },
    other: { s: `- Sport-specific strengths:`, i: `- Sport-specific improvements:` }
  };

  const posHints: Record<string, { s: string; i: string }> = {
    "Quarterback (QB)": {
      s: `- QB: pocket movement, progression speed, accuracy layers, decision-making under pressure.`,
      i: `- QB: footwork timing, release consistency, pre/post-snap reads, anticipation throws.`
    },
    "Wide Receiver (WR)": {
      s: `- WR: releases, separation, hands, body control, yards-after-catch.`,
      i: `- WR: route tempo, leverage, finishing through contact, blocking effort.`
    },
    "Running Back (RB)": {
      s: `- RB: vision, burst, contact balance, pass pro willingness, receiving.`,
      i: `- RB: pad level, cut efficiency, blitz pickup technique, ball security.`
    },
    "Linebacker (LB)": {
      s: `- LB: keys/read, downhill trigger, tackling, pursuit angles, communication.`,
      i: `- LB: coverage drops, block shedding, leverage in run fits, play-action discipline.`
    },
    "Point Guard (PG)": {
      s: `- PG: pace control, passing vision, handle, POA defense, leadership.`,
      i: `- PG: decision speed vs pressure, finishing package, pull-up consistency.`
    },
    "Center (C)": {
      s: `- C: rim protection/rebounding, screens, paint presence, interior finishing.`,
      i: `- C: footwork on defense, hands, free throws, conditioning/mobility.`
    },
    Goalkeeper: {
      s: `- GK: positioning, shot-stopping, command of box, distribution.`,
      i: `- GK: footwork, decision speed on crosses, communication, angles.`
    },
    "100m": {
      s: `- Sprint: start reaction, acceleration posture, top-end mechanics.`,
      i: `- Sprint: block setup, shin angles, relaxation at speed, strength plan.`
    }
  };

  const hint = posHints[pos] ?? { s: "", i: "" };

  return {
    strengths: [strengthsBase, sportNotes[sport].s, hint.s].filter(Boolean).join("\n"),
    improvements: [improvementsBase, sportNotes[sport].i, hint.i].filter(Boolean).join("\n"),
    notes: `Sport: ${sportLabel(sport)}\nPosition/Event: ${pos}`.trim()
  };
}

type FilmSubmission = {
  _id: string;
  userId: string;
  title: string;
  opponent?: string;
  gameDate?: string;
  status: string;
};

type PlayerProfile = {
  firstName: string;
  lastName: string;
  position: string;
  gradYear: number;
  city: string;
  state: string;
};

type RecommendedTemplateResponse = {
  match: string;
  template: {
    _id: string;
    title: string;
    sport: string;
    position: string;
    strengthsTemplate: string;
    improvementsTemplate: string;
    notesTemplate?: string;
  };
};

function projectionLabelFromNumber(n: number) {
  if (n >= 9) return "Elite Upside";
  if (n >= 7) return "High Upside";
  if (n >= 5) return "Solid";
  return "Developmental";
}

function suggestedProjectionFromAverage(avg: number) {
  if (avg >= 9) return { label: "Elite Upside", blurb: "Rare ceiling. Impact potential with strong translatable traits." };
  if (avg >= 7.5) return { label: "High Upside", blurb: "Strong ceiling. Multiple high-end traits; development unlocks next level." };
  if (avg >= 6) return { label: "Solid", blurb: "Reliable projection. Clear role with room for targeted growth." };
  return { label: "Developmental", blurb: "Needs growth. Focus on 2–3 priority traits to raise the ceiling." };
}

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

export function EvaluatorEvaluationForm(props: { filmSubmissionId: string }) {
  const confirm = useConfirm();
  const [overallGrade, setOverallGrade] = useState(7);
  const [overallAvg, setOverallAvg] = useState<number>(7);
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");
  const [notes, setNotes] = useState("");
  const [sport, setSport] = useState<Sport>("football");
  const [position, setPosition] = useState<string>("Other");
  const [positionOther, setPositionOther] = useState<string>("");
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [film, setFilm] = useState<FilmSubmission | null>(null);
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);

  const [formDef, setFormDef] = useState<EvaluationFormDef | null>(null);
  const [loadingForm, setLoadingForm] = useState(false);
  const [rubric, setRubric] = useState<Record<string, { n?: number; o?: string }>>({});

  function countBullets(text: string) {
    return text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("-") || l.startsWith("•")).length;
  }

  const strengthsOk = useMemo(() => strengths.trim().length >= 50 && countBullets(strengths) >= 2, [strengths]);
  const improvementsOk = useMemo(() => improvements.trim().length >= 50 && countBullets(improvements) >= 2, [improvements]);

  const rubricOk = useMemo(() => {
    if (!formDef) return false;
    for (const c of formDef.categories) {
      for (const t of c.traits) {
        const req = t.required !== false;
        if (!req) continue;
        const v = rubric[t.key];
        if (!v) return false;
        if (t.type === "select") {
          if (!v.o) return false;
        } else {
          if (typeof v.n !== "number" || !Number.isFinite(v.n)) return false;
        }
      }
    }
    return true;
  }, [formDef, rubric]);

  const canSubmit = useMemo(
    () => !!film?.userId && Boolean(formDef) && rubricOk && strengthsOk && improvementsOk,
    [film, formDef, rubricOk, strengthsOk, improvementsOk]
  );
  const positions = useMemo(() => (sport === "other" ? [] : POSITIONS_BY_SPORT[sport]), [sport]);

  function computeScoreLocal(def: EvaluationFormDef, values: Record<string, { n?: number; o?: string }>) {
    const categories = def.categories;
    const weightSum = categories.reduce((a, c) => a + (Number(c.weight) || 0), 0) || 100;

    let total = 0;
    let totalWeight = 0;

    for (const c of categories) {
      const scores: number[] = [];
      for (const t of c.traits) {
        const v = values[t.key];
        if (!v) continue;
        if (t.type === "select") {
          const optVal = v.o;
          const opt = (t.options ?? []).find((o) => o.value === optVal);
          if (typeof opt?.score === "number") scores.push(opt.score);
        } else if (typeof v.n === "number") {
          scores.push(v.n);
        }
      }
      if (scores.length === 0) continue;
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      total += avg * ((Number(c.weight) || 0) / weightSum);
      totalWeight += (Number(c.weight) || 0) / weightSum;
    }

    const raw = totalWeight > 0 ? total / totalWeight : 7;
    const bounded = Math.max(1, Math.min(10, raw));
    const rounded = Math.max(1, Math.min(10, Math.round(bounded)));
    return { avg: bounded, grade: rounded };
  }

  const loadForm = useCallback(async (nextSport: Sport) => {
    setLoadingForm(true);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "evaluator" && role !== "admin") throw new Error("Insufficient permissions.");

      const res = await apiFetch<EvaluationFormDef>(`/evaluation-forms/active?sport=${encodeURIComponent(nextSport)}`, { token });
      setFormDef(res);

      // Initialize defaults for sliders only (selects remain empty until chosen).
      const init: Record<string, { n?: number; o?: string }> = {};
      for (const c of res.categories) {
        for (const t of c.traits) {
          if (t.type === "slider") {
            init[t.key] = { n: 5 };
          }
        }
      }
      setRubric(init);
      const sc = computeScoreLocal(res, init);
      setOverallAvg(sc.avg);
      setOverallGrade(sc.grade);
    } catch (err) {
      setFormDef(null);
      setStatus(err instanceof Error ? err.message : "Failed to load evaluation form");
    } finally {
      setLoadingForm(false);
    }
  }, []);

  useEffect(() => {
    // Ensure the active sport form is available immediately (no need to toggle sport first).
    void loadForm(sport);
  }, [loadForm, sport]);

  async function applyTemplate() {
    setStatus(null);
    let allowReplace = true;
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "evaluator" && role !== "admin") throw new Error("Insufficient permissions.");

      const hasExisting = Boolean(strengths.trim() || improvements.trim() || notes.trim());
      allowReplace = !hasExisting;
      if (hasExisting) {
        const ok = await confirm({
          title: "Apply template?",
          message: "This will replace your current text in Strengths, Improvements, and Notes.",
          confirmText: "Apply",
          destructive: true
        });
        if (!ok) return;
        allowReplace = true;
      }

      const params = new URLSearchParams();
      params.set("sport", sport);
      params.set("position", sport === "other" ? "Other" : position);
      if (positionOther.trim()) params.set("positionOther", positionOther.trim());

      const rec = await apiFetch<RecommendedTemplateResponse>(`/evaluation-templates/recommend?${params.toString()}`, { token });

      if (allowReplace || !strengths.trim()) setStrengths(rec.template.strengthsTemplate);
      if (allowReplace || !improvements.trim()) setImprovements(rec.template.improvementsTemplate);
      if (allowReplace || !notes.trim()) setNotes(rec.template.notesTemplate ?? `Template: ${rec.template.title}`);
      setStatus(`Template applied (${rec.match}).`);
    } catch (err) {
      // Fallback to the built-in starter if the API has no templates yet.
      const t = templateFor(sport, position, positionOther);
      if (allowReplace || !strengths.trim()) setStrengths(t.strengths);
      if (allowReplace || !improvements.trim()) setImprovements(t.improvements);
      if (allowReplace || !notes.trim()) setNotes((p) => (p.trim() ? p : t.notes));
      setStatus("Template applied (built-in).");
    }
  }

  async function loadMeta() {
    setStatus(null);
    setLoadingMeta(true);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "evaluator" && role !== "admin") throw new Error("Insufficient permissions.");

      const filmRes = await apiFetch<FilmSubmission>(`/film-submissions/${props.filmSubmissionId}`, { token });
      setFilm(filmRes);

      const profileRes = await apiFetch<PlayerProfile>(`/player-profiles/player/${filmRes.userId}`, { token });
      setPlayer(profileRes);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to load film metadata");
    } finally {
      setLoadingMeta(false);
    }
  }

  async function submit() {
    setStatus(null);
    setSaving(true);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "evaluator" && role !== "admin") throw new Error("Insufficient permissions.");
      if (!film?.userId) throw new Error("Missing film metadata. Click 'Load details' first.");
      if (!formDef) throw new Error("Missing evaluation form. Select sport to load.");

      await apiFetch("/evaluations", {
        method: "POST",
        token,
        body: JSON.stringify({
          filmSubmissionId: props.filmSubmissionId,
          sport,
          position: sport === "other" ? "Other" : position,
          positionOther: sport === "other" || position === "Other" ? (positionOther || undefined) : undefined,
          rubric: {
            formId: formDef._id,
            categories: formDef.categories.map((c) => ({
              key: c.key,
              traits: c.traits.map((t) => ({
                key: t.key,
                ...(t.type === "select" ? { valueOption: rubric[t.key]?.o } : { valueNumber: rubric[t.key]?.n })
              }))
            }))
          },
          strengths,
          improvements,
          notes: notes || undefined
        })
      });

      setStatus("Evaluation submitted.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to submit evaluation");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="grid gap-2">
        <div className="text-sm text-white/80">
          Film:{" "}
          <span className="text-white">
            {film ? `${film.title}${film.opponent ? ` vs ${film.opponent}` : ""}` : "(not loaded)"}
          </span>
        </div>
        <div className="text-sm text-white/80">
          Player:{" "}
          <span className="text-white">
            {player
              ? `${player.firstName} ${player.lastName} · ${player.position} · ${player.gradYear} · ${player.city}, ${player.state}`
              : "(not loaded)"}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <Button type="button" onClick={loadMeta} disabled={loadingMeta}>
            {loadingMeta ? "Loading details..." : film ? "Reload details" : "Load details"}
          </Button>
          <span className="text-xs text-white/60">We fetch this from the API so it stays correct and secure.</span>
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="sport">Sport</Label>
            <select
              id="sport"
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              value={sport}
              onChange={(e) => {
                const next = e.target.value as Sport;
                setSport(next);
                setPosition("Other");
                setPositionOther("");
                void loadForm(next);
              }}
            >
              <option value="football">Football</option>
              <option value="basketball">Basketball</option>
              <option value="volleyball">Volleyball</option>
              <option value="soccer">Soccer</option>
              <option value="track">Track</option>
              <option value="other">Other (enter manually)</option>
            </select>
            <div className="text-xs text-white/60">{loadingForm ? "Loading form..." : formDef ? `Form: ${formDef.title}` : "Form not loaded yet."}</div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="position">Position / Event</Label>
            {sport === "other" ? (
              <Input
                id="position"
                value={positionOther}
                onChange={(e) => setPositionOther(e.target.value)}
                placeholder="Enter position/event..."
              />
            ) : (
              <select
                id="position"
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                value={position}
                onChange={(e) => {
                  setPosition(e.target.value);
                  if (e.target.value !== "Other") setPositionOther("");
                }}
              >
                {positions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
                <option value="Other">Other (enter manually)</option>
              </select>
            )}
            {sport !== "other" && position === "Other" ? (
              <Input
                id="positionOther"
                value={positionOther}
                onChange={(e) => setPositionOther(e.target.value)}
                placeholder="Enter position/event..."
              />
            ) : null}
          </div>
        </div>

        {formDef ? (
          <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="text-sm font-semibold text-white">Rubric (required)</div>
              <div className="text-sm text-white/80">
                Overall grade (auto): <span className="font-semibold text-white">{overallGrade}/10</span>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="text-sm font-semibold text-white">Average score</div>
                <div className="text-sm text-white/80">
                  <span className="font-semibold text-white">{overallAvg.toFixed(1)}</span>/10
                </div>
              </div>
              <div className="mt-2">
                <div className="relative h-3 w-full overflow-hidden rounded-full border border-white/10 bg-white/5">
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(90deg, rgba(239,68,68,.85) 0%, rgba(245,158,11,.85) 35%, rgba(99,102,241,.9) 70%, rgba(16,185,129,.9) 100%)"
                    }}
                  />
                  <div
                    className="absolute top-0 h-full w-1 rounded-full bg-white"
                    style={{ left: `${Math.max(0, Math.min(100, ((overallAvg - 1) / 9) * 100))}%` }}
                    aria-hidden
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-white/60">
                  <span>1</span>
                  <span>4</span>
                  <span>6</span>
                  <span>8</span>
                  <span>10</span>
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
                {(() => {
                  const s = suggestedProjectionFromAverage(overallAvg);
                  return (
                    <div className="text-sm text-white/90">
                      <div className="font-semibold text-white">Suggested projection: {s.label}</div>
                      <div className="mt-1 text-xs text-white/70">{s.blurb}</div>
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="mt-4 grid gap-4">
              {formDef.categories.map((c) => (
                <div key={c.key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="font-semibold text-white">{c.label}</div>
                    <div className="text-xs text-white/60">Weight: {c.weight}%</div>
                  </div>
                  <div className="mt-3 grid gap-3">
                    {c.traits.map((t) => (
                      <div key={t.key} className="grid gap-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm text-white/90">
                            {t.label} {t.required === false ? <span className="text-white/60">(optional)</span> : null}
                          </div>
                          {t.type === "slider" ? (
                            <div className="text-xs text-white/70">
                              Score: {rubric[t.key]?.n ?? "—"}
                              {typeof rubric[t.key]?.n === "number" && t.key.toLowerCase().includes("projection")
                                ? ` · ${projectionLabelFromNumber(rubric[t.key]!.n!)}`
                                : ""}
                            </div>
                          ) : (
                            <div className="text-xs text-white/70">Selected: {rubric[t.key]?.o ?? "—"}</div>
                          )}
                        </div>
                        {t.type === "slider" ? (
                          <select
                            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                            value={String(rubric[t.key]?.n ?? 5)}
                            onChange={(e) => {
                              const n = Number(e.target.value);
                              setRubric((prev) => {
                                const next = { ...prev, [t.key]: { ...(prev[t.key] ?? {}), n } };
                                const sc = computeScoreLocal(formDef, next);
                                setOverallAvg(sc.avg);
                                setOverallGrade(sc.grade);
                                return next;
                              });
                            }}
                          >
                            {Array.from({ length: (t.max ?? 10) - (t.min ?? 1) + 1 }, (_, i) => (t.min ?? 1) + i).map((n) => (
                              <option key={n} value={String(n)}>
                                {n}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <select
                            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                            value={rubric[t.key]?.o ?? ""}
                            onChange={(e) => {
                              const o = e.target.value;
                              setRubric((prev) => {
                                const next = { ...prev, [t.key]: { ...(prev[t.key] ?? {}), o } };
                                const sc = computeScoreLocal(formDef, next);
                                setOverallAvg(sc.avg);
                                setOverallGrade(sc.grade);
                                return next;
                              });
                            }}
                          >
                            <option value="">Select…</option>
                            {(t.options ?? []).map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        )}
                        {t.description ? <div className="text-xs text-white/60">{t.description}</div> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            className="border border-white/15 bg-white/5 text-white hover:bg-white/10"
            onClick={applyTemplate}
          >
            Apply template
          </Button>
          <span className="text-xs text-white/60">Pulls the best admin template for the selected sport/position (fallback included).</span>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="grade">Overall grade (1-10)</Label>
          <Input
            id="grade"
            type="number"
            min={1}
            max={10}
            value={overallGrade}
            disabled
          />
          <div className="text-xs text-white/60">Auto-calculated from rubric scores above.</div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="strengths">Strengths</Label>
          {formDef ? <div className="text-xs text-white/60 whitespace-pre-wrap">{formDef.strengthsPrompt}</div> : null}
          <textarea
            id="strengths"
            className="min-h-28 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 placeholder:text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            value={strengths}
            onChange={(e) => setStrengths(e.target.value)}
            placeholder="- Strength 1 (evidence)\n- Strength 2 (evidence)\n- Strength 3 (optional)"
          />
          {!strengthsOk ? <div className="text-xs text-amber-300">Required: at least 2 bullet points and 50+ characters.</div> : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="improvements">Improvements</Label>
          {formDef ? <div className="text-xs text-white/60 whitespace-pre-wrap">{formDef.improvementsPrompt}</div> : null}
          <textarea
            id="improvements"
            className="min-h-28 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 placeholder:text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            value={improvements}
            onChange={(e) => setImprovements(e.target.value)}
            placeholder="- Improvement 1 (how to improve)\n- Improvement 2 (how to improve)\n- Improvement 3 (optional)"
          />
          {!improvementsOk ? <div className="text-xs text-amber-300">Required: at least 2 bullet points and 50+ characters.</div> : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="notes">Notes (optional)</Label>
          {formDef?.notesHelp ? <div className="text-xs text-white/60 whitespace-pre-wrap">{formDef.notesHelp}</div> : null}
          <textarea
            id="notes"
            className="min-h-28 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 placeholder:text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Button type="button" onClick={submit} disabled={saving || !canSubmit}>
          {saving ? "Submitting..." : "Submit evaluation"}
        </Button>
        {status ? <p className="text-sm text-white/80">{status}</p> : null}
      </div>
    </Card>
  );
}


