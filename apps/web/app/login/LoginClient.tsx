"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Card, Input, Label, Button } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { setAccessToken } from "@/lib/auth";
import { FormErrorSummary, FieldError } from "@/components/FormErrors";
import { parseApiError, type FieldErrors } from "@/lib/formErrors";
import { toast } from "@/components/ToastProvider";

export function LoginClient() {
  const router = useRouter();
  const search = useSearchParams();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const reason = search.get("reason");
  const returnTo = search.get("returnTo");
  // Show a friendly message when redirected here by a guard (best-effort).
  useState(() => {
    if (reason === "login_required") toast({ kind: "info", title: "Login required", message: "Please sign in to continue." });
    return null;
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors(undefined);
    setLoading(true);
    try {
      const nextFieldErrors: FieldErrors = {};
      if (!login.trim()) nextFieldErrors.login = ["Email or username is required."];
      if (!password) nextFieldErrors.password = ["Password is required."];
      if (Object.keys(nextFieldErrors).length > 0) {
        setFieldErrors(nextFieldErrors);
        return;
      }
      const res = await apiFetch<{ token: string; user: { role: string } }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ login, password })
      });
      setAccessToken(res.token);
      const fallback =
        res.user.role === "player"
          ? "/player"
          : res.user.role === "coach"
            ? "/coach"
            : res.user.role === "evaluator"
              ? "/evaluator"
              : res.user.role === "admin"
                ? "/admin"
                : "/";
      router.push(returnTo ? String(returnTo) : fallback);
      toast({ kind: "success", title: "Signed in", message: "Welcome back." });
    } catch (err) {
      const parsed = parseApiError(err);
      setFormError(parsed.formError ?? "Login failed");
      setFieldErrors(parsed.fieldErrors);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[color:var(--surface)] shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_18px_60px_rgba(0,0,0,0.45)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_circle_at_30%_10%,rgba(99,102,241,0.25),transparent_55%),radial-gradient(700px_circle_at_80%_70%,rgba(16,185,129,0.18),transparent_55%)]"
        />

        <div className="relative grid gap-0 md:grid-cols-2">
          <div className="border-b border-white/10 p-8 md:border-b-0 md:border-r md:p-10">
            <div className="flex items-center gap-3">
              <Image src="/logo.png" alt="GoEducate Talent" width={36} height={36} className="h-9 w-9" priority />
              <div>
                <div className="text-lg font-semibold leading-tight">GoEducate Talent</div>
                <div className="text-sm text-white/70">Athlete evaluation platform</div>
              </div>
            </div>

            <h1 className="mt-8 text-2xl font-semibold tracking-tight">Sign in</h1>
            <p className="mt-2 text-sm text-white/80">
              Coaches discover talent, players submit film, and evaluators deliver detailed reports — all in one place.
            </p>

            <div className="mt-6 grid gap-3 text-sm text-white/80">
              <div className="flex gap-3">
                <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-xs">✓</span>
                <span>Fast access to submissions, watchlists, and evaluation reports.</span>
              </div>
              <div className="flex gap-3">
                <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-xs">✓</span>
                <span>Role-based dashboards for Players, Coaches, Evaluators, and Admin.</span>
              </div>
              <div className="flex gap-3">
                <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-xs">✓</span>
                <span>Secure, invite-only access for coaches and evaluators.</span>
              </div>
            </div>

            <div className="mt-8 text-sm text-white/80">
              Need access?{" "}
              <Link href="/request-access" className="text-indigo-300 hover:text-indigo-200 hover:underline">
                Request access
              </Link>
              <span className="text-white/50"> · </span>
              <Link href="/contact" className="text-indigo-300 hover:text-indigo-200 hover:underline">
                Contact support
              </Link>
              <span className="text-white/50"> · </span>
              <a
                href="https://www.goeducateinc.org"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-300 hover:text-indigo-200 hover:underline"
              >
                Visit GoEducateInc.org
              </a>
            </div>

            <div className="mt-6 text-xs text-white/55">
              By signing in, you agree to our{" "}
              <Link href="/legal/terms" className="text-indigo-300 hover:text-indigo-200 hover:underline">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/legal/privacy" className="text-indigo-300 hover:text-indigo-200 hover:underline">
                Privacy Policy
              </Link>
              .
            </div>
          </div>

          <div className="p-8 md:p-10">
            <Card className="border-white/10 bg-black/10">
              <div className="flex items-baseline justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold">Account login</div>
                  <div className="mt-1 text-sm text-white/80">Use your email or username and password.</div>
                </div>
              </div>

              <form onSubmit={onSubmit} className="mt-6 grid gap-4">
                <FormErrorSummary formError={formError ?? undefined} fieldErrors={fieldErrors} />
                <div className="grid gap-2">
                  <Label htmlFor="login">Email or username</Label>
                  <Input id="login" value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" />
                  <FieldError name="login" fieldErrors={fieldErrors} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  <FieldError name="password" fieldErrors={fieldErrors} />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <Link href="/forgot-username" className="text-indigo-300 hover:text-indigo-200 hover:underline">
                    Forgot username?
                  </Link>
                  <Link href="/forgot-password" className="text-indigo-300 hover:text-indigo-200 hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <Button type="submit" disabled={loading}>
                  {loading ? "Signing in..." : "Sign in"}
                </Button>
              </form>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}


