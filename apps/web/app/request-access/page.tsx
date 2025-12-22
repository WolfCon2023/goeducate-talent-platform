"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Button, Card, Input, Label } from "@/components/ui";
import { apiFetch } from "@/lib/api";

import surveyJson from "@/src/config/screeningSurvey.json";

type RequestedRole = "player" | "coach" | "evaluator";
type Sport = "Basketball" | "Football" | "Volleyball" | "Baseball" | "Soccer" | "Other";

type Question = {
  id: string;
  label: string;
  type: "single_select" | "multi_select" | "text";
  required?: boolean;
  options?: string[];
  minLength?: number;
  maxLength?: number;
};

function isEmailLike(email: string) {
  const e = email.trim();
  return e.length >= 5 && e.includes("@") && e.includes(".");
}

export default function RequestAccessPage() {
  const survey = (surveyJson as any).screeningSurvey as {
    version: string;
    roles: RequestedRole[];
    sports: { options: Sport[]; otherSportTextFieldKey: string };
    questionsByRole: Record<RequestedRole, Question[]>;
  };

  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [requestedRole, setRequestedRole] = useState<RequestedRole>("player");
  const [sport, setSport] = useState<Sport>("Football");
  const [sportOther, setSportOther] = useState("");
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const roleQuestions = useMemo(() => survey.questionsByRole[requestedRole] ?? [], [requestedRole, survey.questionsByRole]);

  function setAnswer(q: Question, value: string | string[]) {
    setAnswers((prev) => ({ ...prev, [q.id]: value }));
  }

  function toggleMulti(q: Question, opt: string) {
    const cur = answers[q.id];
    const arr = Array.isArray(cur) ? cur : [];
    if (arr.includes(opt)) setAnswer(q, arr.filter((x) => x !== opt));
    else setAnswer(q, [...arr, opt]);
  }

  function validateStep(idx: number): string | null {
    if (idx === 0) {
      if (!fullName.trim()) return "Full name is required.";
      if (!isEmailLike(email)) return "Please enter a valid email.";
      return null;
    }
    if (idx === 1) {
      if (!requestedRole) return "Requested role is required.";
      if (!sport) return "Sport is required.";
      if (sport === "Other" && sportOther.trim().length < 2) return "Please enter your sport.";
      return null;
    }
    if (idx === 2) {
      for (const q of roleQuestions) {
        if (!q.required) continue;
        const v = answers[q.id];
        if (q.type === "multi_select") {
          if (!Array.isArray(v) || v.length === 0) return `Please answer: ${q.label}`;
        } else {
          if (!v || (typeof v === "string" && !v.trim())) return `Please answer: ${q.label}`;
        }
      }
      return null;
    }
    return null;
  }

  async function submit() {
    setStatus(null);
    const err0 = validateStep(0) ?? validateStep(1) ?? validateStep(2);
    if (err0) {
      setStatus(err0);
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch("/api/access-requests", {
        method: "POST",
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          requestedRole,
          sport,
          sportOther: sport === "Other" ? sportOther.trim() : undefined,
          answers
        })
      });
      setStatus("Request submitted. If approved, you will receive an email with next steps.");
      setStep(3);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Request access</h1>
            <p className="mt-1 text-sm text-white/80">
              GoEducate Talent is invite-only. Submit this request and we’ll email you with next steps.
            </p>
          </div>
          <div className="text-xs text-white/60">Survey v{survey.version}</div>
        </div>

        <div className="mt-6 flex items-center gap-2 text-xs text-white/70">
          <div className={`rounded-full px-2 py-1 ${step >= 0 ? "bg-white/10" : "bg-white/5"}`}>About</div>
          <div className="h-px w-6 bg-white/10" />
          <div className={`rounded-full px-2 py-1 ${step >= 1 ? "bg-white/10" : "bg-white/5"}`}>Role & sport</div>
          <div className="h-px w-6 bg-white/10" />
          <div className={`rounded-full px-2 py-1 ${step >= 2 ? "bg-white/10" : "bg-white/5"}`}>Screening</div>
          <div className="h-px w-6 bg-white/10" />
          <div className={`rounded-full px-2 py-1 ${step >= 3 ? "bg-white/10" : "bg-white/5"}`}>Done</div>
        </div>

        {step === 0 ? (
          <div className="mt-6 grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="mt-6 grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="requestedRole">Requested role</Label>
              <select
                id="requestedRole"
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                value={requestedRole}
                onChange={(e) => {
                  const next = e.target.value as RequestedRole;
                  setRequestedRole(next);
                  setAnswers({});
                }}
              >
                {survey.roles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="sport">Primary sport</Label>
              <select
                id="sport"
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                value={sport}
                onChange={(e) => setSport(e.target.value as Sport)}
              >
                {survey.sports.options.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {sport === "Other" ? (
              <div className="grid gap-2">
                <Label htmlFor="sportOther">Other sport</Label>
                <Input id="sportOther" value={sportOther} onChange={(e) => setSportOther(e.target.value)} placeholder="Enter sport name" />
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="mt-6 grid gap-5">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-semibold">Requested role: {requestedRole}</div>
              <div className="mt-1 text-sm text-white/80">
                Sport: {sport}
                {sport === "Other" && sportOther.trim() ? ` (${sportOther.trim()})` : ""}
              </div>
            </div>

            {roleQuestions.map((q) => (
              <div key={q.id} className="grid gap-2">
                <Label htmlFor={q.id}>
                  {q.label}
                  {q.required ? " *" : ""}
                </Label>

                {q.type === "text" ? (
                  <Input
                    id={q.id}
                    value={typeof answers[q.id] === "string" ? (answers[q.id] as string) : ""}
                    onChange={(e) => setAnswer(q, e.target.value)}
                  />
                ) : null}

                {q.type === "single_select" ? (
                  <select
                    id={q.id}
                    className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                    value={typeof answers[q.id] === "string" ? (answers[q.id] as string) : ""}
                    onChange={(e) => setAnswer(q, e.target.value)}
                  >
                    <option value="" disabled>
                      Select…
                    </option>
                    {(q.options ?? []).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : null}

                {q.type === "multi_select" ? (
                  <div className="grid gap-2">
                    {(q.options ?? []).map((opt) => {
                      const cur = answers[q.id];
                      const checked = Array.isArray(cur) ? cur.includes(opt) : false;
                      return (
                        <label key={opt} className="flex items-center gap-2 text-sm text-white/90">
                          <input type="checkbox" checked={checked} onChange={() => toggleMulti(q, opt)} />
                          <span>{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="mt-6 grid gap-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-semibold">Submitted</div>
              <p className="mt-1 text-sm text-white/80">
                Thanks — we received your request. If approved, you’ll receive an email with an invite link.
              </p>
            </div>
            <Link href="/login" className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
              Return to login
            </Link>
          </div>
        ) : null}

        {status ? <div className="mt-6 text-sm text-white/80">{status}</div> : null}

        {step < 3 ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {step > 0 ? (
                <Button
                  type="button"
                  className="border border-white/15 bg-white/5 hover:bg-white/10"
                  onClick={() => {
                    setStatus(null);
                    setStep((s) => Math.max(0, s - 1));
                  }}
                >
                  Back
                </Button>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {step < 2 ? (
                <Button
                  type="button"
                  onClick={() => {
                    const err = validateStep(step);
                    if (err) {
                      setStatus(err);
                      return;
                    }
                    setStatus(null);
                    setStep((s) => s + 1);
                  }}
                >
                  Continue
                </Button>
              ) : (
                <Button type="button" onClick={submit} disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit request"}
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}


