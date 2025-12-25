"use client";

import { useState } from "react";
import Link from "next/link";

import { Card, Button, Input, Label } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { FormErrorSummary, FieldError } from "@/components/FormErrors";
import type { FieldErrors } from "@/lib/formErrors";

export default function ForgotPasswordPage() {
  const [login, setLogin] = useState("");
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
      if (Object.keys(fe).length) {
        setFieldErrors(fe);
        return;
      }
      await apiFetch("/auth/forgot-password", { method: "POST", body: JSON.stringify({ login }) });
      setSuccess("If an account exists, we’ll email a password reset link shortly.");
      setLogin("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <Card>
        <h1 className="text-xl font-semibold">Forgot password</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">Enter your email or username and we’ll email a reset link if we find an account.</p>

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
          <Button type="submit" disabled={sending}>
            {sending ? "Sending…" : "Send reset link"}
          </Button>
          <div className="text-sm text-[color:var(--muted)]">
            Prefer security questions?{" "}
            <Link href="/recover/password" className="text-indigo-300 hover:text-indigo-200 hover:underline">
              Recover via questions
            </Link>
          </div>
          <div className="text-sm text-[color:var(--muted)]">
            <Link href="/login" className="text-indigo-300 hover:text-indigo-200 hover:underline">
              Back to login
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}


