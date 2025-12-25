"use client";

import { useEffect, useMemo, useState } from "react";

import { RoleGuard } from "@/components/RoleGuard";
import { Card, Button, Input, Label } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { FormErrorSummary, FieldError } from "@/components/FormErrors";
import type { FieldErrors } from "@/lib/formErrors";
import { toast } from "@/components/ToastProvider";

const QUESTION_BANK: Array<{ id: string; label: string }> = [
  { id: "pet_name", label: "What was the name of your first pet?" },
  { id: "childhood_street", label: "What street did you grow up on?" },
  { id: "first_school", label: "What was the name of your first school?" },
  { id: "childhood_city", label: "In what city were you raised?" },
  { id: "favorite_coach", label: "What is the last name of a coach who influenced you?" },
  { id: "favorite_team", label: "What was your favorite sports team as a kid?" },
  { id: "mother_maiden", label: "What is your mother’s maiden name?" }
];

export default function AccountSecurityPage() {
  return (
    <RoleGuard allowed={["player", "coach", "evaluator", "admin"]}>
      <AccountSecurityInner />
    </RoleGuard>
  );
}

function AccountSecurityInner() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors | undefined>(undefined);
  const [configured, setConfigured] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [q1, setQ1] = useState(QUESTION_BANK[0]?.id ?? "");
  const [a1, setA1] = useState("");
  const [q2, setQ2] = useState(QUESTION_BANK[1]?.id ?? "");
  const [a2, setA2] = useState("");
  const [q3, setQ3] = useState(QUESTION_BANK[2]?.id ?? "");
  const [a3, setA3] = useState("");

  const questions = useMemo(() => new Map(QUESTION_BANK.map((q) => [q.id, q.label])), []);

  async function load() {
    setFormError(null);
    setLoading(true);
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Please login first.");
      const res = await apiFetch<{ configured: boolean; questions: Array<{ questionId: string; question: string }> }>("/auth/recovery-questions/me", { token });
      setConfigured(Boolean(res.configured));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors(undefined);
    setSaving(true);
    try {
      const fe: FieldErrors = {};
      if (!currentPassword) fe.currentPassword = ["Current password is required."];
      if (!q1 || !q2 || !q3) fe.questions = ["Select 3 questions."];
      if (new Set([q1, q2, q3]).size !== 3) fe.questions = ["Questions must be unique."];
      if (!a1.trim()) fe.a1 = ["Answer is required."];
      if (!a2.trim()) fe.a2 = ["Answer is required."];
      if (!a3.trim()) fe.a3 = ["Answer is required."];
      if (Object.keys(fe).length) {
        setFieldErrors(fe);
        return;
      }

      const token = getAccessToken();
      if (!token) throw new Error("Please login first.");
      await apiFetch("/auth/recovery-questions/me", {
        method: "PUT",
        token,
        body: JSON.stringify({
          currentPassword,
          questions: [
            { questionId: q1, question: questions.get(q1) ?? q1, answer: a1 },
            { questionId: q2, question: questions.get(q2) ?? q2, answer: a2 },
            { questionId: q3, question: questions.get(q3) ?? q3, answer: a3 }
          ]
        })
      });
      setCurrentPassword("");
      setA1("");
      setA2("");
      setA3("");
      setConfigured(true);
      toast({ kind: "success", title: "Saved", message: "Security questions updated." });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <h1 className="text-xl font-semibold">Account security</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Set security questions to help recover your account if you forget your username or password.
        </p>

        <div className="mt-4">
          <FormErrorSummary formError={formError ?? undefined} fieldErrors={fieldErrors} />
          <div className="mt-3 text-sm text-[color:var(--muted)]">
            Status:{" "}
            <span className="text-white/90 font-semibold">{loading ? "Checking…" : configured ? "Configured" : "Not configured"}</span>
          </div>
        </div>

        <form onSubmit={save} className="mt-6 grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="currentPassword">Confirm your current password</Label>
            <Input id="currentPassword" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
            <FieldError name="currentPassword" fieldErrors={fieldErrors} />
          </div>

          <div className="grid gap-3">
            <div className="text-sm font-semibold">Security questions</div>
            <FieldError name="questions" fieldErrors={fieldErrors} />

            <QuestionRow idx={1} questionId={q1} setQuestionId={setQ1} answer={a1} setAnswer={setA1} fieldErrors={fieldErrors} bank={QUESTION_BANK} />
            <QuestionRow idx={2} questionId={q2} setQuestionId={setQ2} answer={a2} setAnswer={setA2} fieldErrors={fieldErrors} bank={QUESTION_BANK} />
            <QuestionRow idx={3} questionId={q3} setQuestionId={setQ3} answer={a3} setAnswer={setA3} fieldErrors={fieldErrors} bank={QUESTION_BANK} />
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save security questions"}
            </Button>
            <Button type="button" className="border border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={load} disabled={loading || saving}>
              {loading ? "Refreshing…" : "Refresh"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function QuestionRow(props: {
  idx: number;
  questionId: string;
  setQuestionId: (v: string) => void;
  answer: string;
  setAnswer: (v: string) => void;
  fieldErrors?: FieldErrors;
  bank: Array<{ id: string; label: string }>;
}) {
  return (
    <div className="grid gap-2 rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs uppercase tracking-wide text-[color:var(--muted-2)]">Question {props.idx}</div>
      <select
        className="w-full rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary-600)]"
        value={props.questionId}
        onChange={(e) => props.setQuestionId(e.target.value)}
      >
        {props.bank.map((q) => (
          <option key={q.id} value={q.id}>
            {q.label}
          </option>
        ))}
      </select>
      <div className="grid gap-2">
        <Label htmlFor={`a${props.idx}`}>Answer</Label>
        <Input id={`a${props.idx}`} value={props.answer} onChange={(e) => props.setAnswer(e.target.value)} autoComplete="off" />
        <FieldError name={`a${props.idx}`} fieldErrors={props.fieldErrors} />
      </div>
    </div>
  );
}


