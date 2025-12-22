"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Card, Input, Label } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { setAccessToken } from "@/lib/auth";
import { FormErrorSummary, FieldError } from "@/components/FormErrors";
import { parseApiError, type FieldErrors } from "@/lib/formErrors";

export default function InviteSignupPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
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
      if (!token.trim()) nextFieldErrors.token = ["Invite code is required."];
      if (!password || password.length < 8) nextFieldErrors.password = ["Password must be at least 8 characters."];
      if (Object.keys(nextFieldErrors).length > 0) {
        setFieldErrors(nextFieldErrors);
        return;
      }
      const res = await apiFetch<{ token: string; user: { role: string } }>("/auth/accept-invite", {
        method: "POST",
        body: JSON.stringify({
          token,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          password
        })
      });
      setAccessToken(res.token);
      if (res.user.role === "player") router.push("/player");
      else if (res.user.role === "coach") router.push("/coach");
      else if (res.user.role === "evaluator") router.push("/evaluator");
      else if (res.user.role === "admin") router.push("/admin");
      else router.push("/");
    } catch (err) {
      const parsed = parseApiError(err);
      setFormError(parsed.formError ?? "Failed to accept invite");
      setFieldErrors(parsed.fieldErrors);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <h1 className="text-xl font-semibold">Create account (Invite)</h1>
        <p className="mt-1 text-sm text-white/80">Use the invite code provided by an admin.</p>

        <form onSubmit={onSubmit} className="mt-6 grid gap-4">
          <FormErrorSummary formError={formError ?? undefined} fieldErrors={fieldErrors} />
          <div className="grid gap-2">
            <Label htmlFor="token">Invite code</Label>
            <Input id="token" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" />
            <FieldError name="token" fieldErrors={fieldErrors} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="firstName">First name (required for coach/admin/evaluator)</Label>
              <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lastName">Last name (required for coach/admin/evaluator)</Label>
              <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            <FieldError name="password" fieldErrors={fieldErrors} />
          </div>
          <Button type="submit" disabled={loading || !token.trim() || password.length < 8}>
            {loading ? "Creating..." : "Create account"}
          </Button>
        </form>
      </Card>
    </div>
  );
}


