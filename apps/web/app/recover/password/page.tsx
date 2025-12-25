"use client";

import { useState } from "react";
import Link from "next/link";

import { Card, Button, Input, Label } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { FormErrorSummary, FieldError } from "@/components/FormErrors";
import type { FieldErrors } from "@/lib/formErrors";

const QUESTION_BANK: Array<{ id: string; label: string }> = [
  { id: "pet_name", label: "What was the name of your first pet?" },
  { id: "childhood_street", label: "What street did you grow up on?" },
  { id: "first_school", label: "What was the name of your first school?" },
  { id: "childhood_city", label: "In what city were you raised?" },
  { id: "favorite_coach", label: "What is the last name of a coach who influenced you?" },
  { id: "favorite_team", label: "What was your favorite sports team as a kid?" },
  { id: "mother_maiden", label: "What is your mother’s maiden name?" }
];

export default function RecoverPasswordByQuestionsPage() {
  const [login, setLogin] = useState("");
  const [q1, setQ1] = useState(QUESTION_BANK[0]?.id ?? "");
  const [a1, setA1] = useState("");
  const [q2, setQ2] = useState(QUESTION_BANK[1]?.id ?? "");
  const [a2, setA2] = useState("");
  const [q3, setQ3] = useState(QUESTION_BANK[2]?.id ?? "");
  const [a3, setA3] = useState("");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors | undefined>(undefined);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(null);
    setFormError(null);
    setFieldErrors(undefined);
    setSending(true);
    try {
      const fe: FieldErrors = {};
      if (!login.trim()) fe.login = ["Email or username is required."];
      if (new Set([q1, q2, q3]).size !== 3) fe.questions = ["Questions must be unique."];
      if (!a1.trim() || !a2.trim() || !a3.trim()) fe.answers = ["All answers are required."];
      if (Object.keys(fe).length) {
        setFieldErrors(fe);
        return;
      }

      await apiFetch("/auth/recover/password", {
        method: "POST",
        body: JSON.stringify({
          login,
          answers: [
            { questionId: q1, answer: a1 },
            { questionId: q2, answer: a2 },
            { questionId: q3, answer: a3 }
          ]
        })
      });

      setSuccess("If your answers match an account, we’ll email a password reset link shortly.");
      setLogin("");
      setA1("");
      setA2("");
      setA3("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <Card>
        <h1 className="text-xl font-semibold">Recover password</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">Answer your security questions to request a password reset email.</p>

        <div className="mt-4">
          <FormErrorSummary formError={formError ?? undefined} fieldErrors={fieldErrors} />
          {success ? <div className="mt-3 text-sm text-[color:var(--muted)]">{success}</div> : null}
        </div>

        <form onSubmit={submit} className="mt-6 grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="login">Email or username</Label>
            <Input id="login" value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" />
            <FieldError name="login" fieldErrors={fieldErrors} />
          </div>

          <FieldError name="questions" fieldErrors={fieldErrors} />
          <FieldError name="answers" fieldErrors={fieldErrors} />

          <QuestionSelect idx={1} q={q1} setQ={setQ1} a={a1} setA={setA1} />
          <QuestionSelect idx={2} q={q2} setQ={setQ2} a={a2} setA={setA2} />
          <QuestionSelect idx={3} q={q3} setQ={setQ3} a={a3} setA={setA3} />

          <Button type="submit" disabled={sending}>
            {sending ? "Submitting…" : "Submit answers"}
          </Button>
          <div className="text-sm text-[color:var(--muted)]">
            <Link href="/forgot-password" className="text-indigo-300 hover:text-indigo-200 hover:underline">
              Back
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}

function QuestionSelect(props: { idx: number; q: string; setQ: (v: string) => void; a: string; setA: (v: string) => void }) {
  return (
    <div className="grid gap-2 rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs uppercase tracking-wide text-[color:var(--muted-2)]">Question {props.idx}</div>
      <select
        className="w-full rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary-600)]"
        value={props.q}
        onChange={(e) => props.setQ(e.target.value)}
      >
        {QUESTION_BANK.map((q) => (
          <option key={q.id} value={q.id}>
            {q.label}
          </option>
        ))}
      </select>
      <div className="grid gap-2">
        <Label htmlFor={`a${props.idx}`}>Answer</Label>
        <Input id={`a${props.idx}`} value={props.a} onChange={(e) => props.setA(e.target.value)} autoComplete="off" />
      </div>
    </div>
  );
}


