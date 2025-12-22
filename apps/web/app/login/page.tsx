"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Card, Input, Label, Button } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { setAccessToken } from "@/lib/auth";
import Link from "next/link";
import { FormErrorSummary, FieldError } from "@/components/FormErrors";
import { parseApiError, type FieldErrors } from "@/lib/formErrors";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors(undefined);
    setLoading(true);
    try {
      const nextFieldErrors: FieldErrors = {};
      if (!email.trim()) nextFieldErrors.email = ["Email is required."];
      if (!password) nextFieldErrors.password = ["Password is required."];
      if (Object.keys(nextFieldErrors).length > 0) {
        setFieldErrors(nextFieldErrors);
        return;
      }
      const res = await apiFetch<{ token: string; user: { role: string } }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      setAccessToken(res.token);
      if (res.user.role === "player") router.push("/player");
      else if (res.user.role === "coach") router.push("/coach");
      else if (res.user.role === "evaluator") router.push("/evaluator");
      else if (res.user.role === "admin") router.push("/admin");
      else router.push("/");
    } catch (err) {
      const parsed = parseApiError(err);
      setFormError(parsed.formError ?? "Login failed");
      setFieldErrors(parsed.fieldErrors);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <h1 className="text-xl font-semibold">Login</h1>
        <p className="mt-1 text-sm text-white/80">Sign in to your account.</p>

        <form onSubmit={onSubmit} className="mt-6 grid gap-4">
          <FormErrorSummary formError={formError ?? undefined} fieldErrors={fieldErrors} />
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            <FieldError name="email" fieldErrors={fieldErrors} />
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
          <Button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <div className="mt-6 text-sm text-white/80">
          Need access?{" "}
          <Link href="/request-access" className="text-indigo-300 hover:text-indigo-200 hover:underline">
            Request access
          </Link>
        </div>
      </Card>
    </div>
  );
}


