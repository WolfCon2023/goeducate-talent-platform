"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Card, Input, Label } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { setAccessToken } from "@/lib/auth";

export default function EvaluatorCreateAccountPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<{ token: string; user: { role: string } }>("/auth/accept-invite", {
        method: "POST",
        body: JSON.stringify({
          token,
          firstName,
          lastName,
          password
        })
      });
      setAccessToken(res.token);
      router.push(res.user.role === "admin" ? "/admin" : "/evaluator");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <h1 className="text-xl font-semibold">Evaluator create account</h1>
        <p className="mt-1 text-sm text-slate-300">Use the invite code provided by an admin.</p>

        <form onSubmit={onSubmit} className="mt-6 grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="token">Invite code</Label>
            <Input id="token" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" />
          </div>
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
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </div>
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          <Button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create evaluator account"}
          </Button>
        </form>
      </Card>
    </div>
  );
}


