"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

import { Card, Button, Input, Label } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { FormErrorSummary, FieldError } from "@/components/FormErrors";
import type { FieldErrors } from "@/lib/formErrors";

export function ResetPasswordClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const token = sp.get("token") || "";

  const [validating, setValidating] = useState(false);
  const [valid, setValid] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors | undefined>(undefined);

  const tokenPresent = useMemo(() => Boolean(token && token.length >= 10), [token]);

  useEffect(() => {
    if (!tokenPresent) {
      setValid(false);
      return;
    }
    let cancelled = false;
    setValidating(true);
    void (async () => {
      try {
        const qs = new URLSearchParams({ token });
        const res = await apiFetch<{ valid: boolean }>(`/auth/reset-password/validate?${qs.toString()}`, { retries: 2, retryOn404: true });
        if (!cancelled) setValid(Boolean(res.valid));
      } catch {
        if (!cancelled) setValid(false);
      } finally {
        if (!cancelled) setValidating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, tokenPresent]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(null);
    setFormError(null);
    setFieldErrors(undefined);
    setSending(true);
    try {
      const fe: FieldErrors = {};
      if (!tokenPresent) fe.token = ["Reset token is missing."];
      if (!password || password.length < 8) fe.password = ["Password must be at least 8 characters."];
      if (Object.keys(fe).length) {
        setFieldErrors(fe);
        return;
      }
      await apiFetch("/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) });
      setSuccess("Password updated. Redirecting to login…");
      setPassword("");
      setTimeout(() => router.push("/login"), 900);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <Card>
        <h1 className="text-xl font-semibold">Reset password</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">Choose a new password for your account.</p>

        <div className="mt-4">
          <FormErrorSummary formError={formError ?? undefined} fieldErrors={fieldErrors} />
          {success ? <div className="mt-3 text-sm text-[color:var(--muted)]">{success}</div> : null}
          {validating ? <div className="mt-3 text-sm text-[color:var(--muted)]">Validating link…</div> : null}
          {valid === false ? (
            <div className="mt-3 text-sm text-red-300">
              This reset link is invalid or expired. Please request a new one on{" "}
              <Link href="/forgot-password" className="text-indigo-300 hover:text-indigo-200 hover:underline">
                Forgot password
              </Link>
              .
            </div>
          ) : null}
        </div>

        <form onSubmit={submit} className="mt-6 grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="password">New password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            <FieldError name="password" fieldErrors={fieldErrors} />
          </div>
          <Button type="submit" disabled={sending || valid === false || !tokenPresent}>
            {sending ? "Updating…" : "Update password"}
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


