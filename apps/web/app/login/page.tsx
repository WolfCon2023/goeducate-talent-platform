"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Card, Input, Label, Button } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { setAccessToken } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
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
      setError(err instanceof Error ? err.message : "Login failed");
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
              autoComplete="current-password"
            />
          </div>
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          <Button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </Card>
    </div>
  );
}


