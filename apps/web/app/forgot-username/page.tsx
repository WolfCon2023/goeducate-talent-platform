"use client";

import { useState } from "react";
import Link from "next/link";

import { Card, Button, Input, Label } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { FormErrorSummary, FieldError } from "@/components/FormErrors";
import type { FieldErrors } from "@/lib/formErrors";

export default function ForgotUsernamePage() {
  const [email, setEmail] = useState("");
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
      if (!email.trim()) fe.email = ["Email is required."];
      if (Object.keys(fe).length) {
        setFieldErrors(fe);
        return;
      }
      await apiFetch("/auth/forgot-username", { method: "POST", body: JSON.stringify({ email }) });
      setSuccess("If an account exists for that email, we’ll send your username shortly.");
      setEmail("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <Card>
        <h1 className="text-xl font-semibold">Forgot username</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">Enter your email and we’ll send your username if we find an account.</p>

        <div className="mt-4">
          <FormErrorSummary formError={formError ?? undefined} fieldErrors={fieldErrors} />
          {success ? <div className="mt-3 text-sm text-[color:var(--muted)]">{success}</div> : null}
        </div>

        <form onSubmit={submit} className="mt-6 grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            <FieldError name="email" fieldErrors={fieldErrors} />
          </div>
          <Button type="submit" disabled={sending}>
            {sending ? "Sending…" : "Send username"}
          </Button>
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


