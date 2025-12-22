"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Card, Input, Label, Button } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { setAccessToken } from "@/lib/auth";

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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (role === "coach" && (!firstName.trim() || !lastName.trim())) {
        throw new Error("Coach first and last name are required.");
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
      setError(err instanceof Error ? err.message : "Registration failed");
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
          {role === "coach" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
              </div>
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
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
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          <Button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create account"}
          </Button>
        </form>
      </Card>
    </div>
  );
}


