"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Card, Input, Label, Button } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { setAccessToken } from "@/lib/auth";

type Role = "player" | "coach" | "evaluator" | "admin";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("player");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<{ token: string; user: { role: string } }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, role })
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
        <p className="mt-1 text-sm text-slate-300">Start as a player or coach. (Evaluator/Admin are internal.)</p>

        <form onSubmit={onSubmit} className="mt-6 grid gap-4">
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
              className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              <option value="player">Player</option>
              <option value="coach">Coach</option>
              <option value="evaluator">Evaluator (internal)</option>
              <option value="admin">Admin (internal)</option>
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


