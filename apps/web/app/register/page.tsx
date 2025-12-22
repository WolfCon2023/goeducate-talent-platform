"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { FieldError, FormErrorSummary } from "@/components/FormErrors";
import { Card, Input, Label, Button } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { setAccessToken } from "@/lib/auth";
import { parseApiError, type FieldErrors } from "@/lib/formErrors";

type Role = "player" | "coach";

export default function RegisterPage() {
  const router = useRouter();
  // Invite-only: redirect to request-access flow.
  // /register is kept for backward compatibility but is no longer the primary CTA.
  useEffect(() => {
    router.replace("/request-access");
  }, [router]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("player");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors(undefined);
    setLoading(true);
    try {
      const fe: FieldErrors = {};
      if (!email.trim()) fe.email = ["Email is required."];
      if (!password || password.length < 8) fe.password = ["Password must be at least 8 characters."];
      if (role === "coach" && !firstName.trim()) fe.firstName = ["First name is required for coaches."];
      if (role === "coach" && !lastName.trim()) fe.lastName = ["Last name is required for coaches."];
      if (Object.keys(fe).length > 0) {
        setFieldErrors(fe);
        return;
      }
      const res = await apiFetch<{ token: string; user: { role: string } }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          role,
          ...(role === "coach" ? { firstName: firstName.trim(), lastName: lastName.trim() } : {})
        })
      });
      setAccessToken(res.token);
      router.push(role === "coach" ? "/coach" : "/player");
    } catch (err) {
      const parsed = parseApiError(err);
      setFormError(parsed.formError ?? "Registration failed");
      setFieldErrors(parsed.fieldErrors);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <h1 className="text-xl font-semibold">Create account</h1>
        <p className="mt-1 text-sm text-white/80">
          Registration is invite-only. You’ll be redirected to{" "}
          <Link href="/request-access" className="text-indigo-300 hover:text-indigo-200 hover:underline">
            Request access
          </Link>
          .
        </p>

        <form onSubmit={onSubmit} className="mt-6 grid gap-4">
          <FormErrorSummary formError={formError ?? undefined} fieldErrors={fieldErrors} />
          {role === "coach" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
                <FieldError name="firstName" fieldErrors={fieldErrors} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
                <FieldError name="lastName" fieldErrors={fieldErrors} />
              </div>
            </div>
          ) : null}

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
              autoComplete="new-password"
            />
            <FieldError name="password" fieldErrors={fieldErrors} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="role">Role</Label>
            <select
              id="role"
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              <option value="player">Player</option>
              <option value="coach">Coach</option>
            </select>
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create account"}
          </Button>
        </form>
      </Card>
    </div>
  );
}


