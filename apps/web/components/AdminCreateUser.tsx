"use client";

import { useState } from "react";

import { Button, Card, Input, Label } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";

type Role = "evaluator" | "admin";

export function AdminCreateUser() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("evaluator");
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function create() {
    setStatus(null);
    setSaving(true);
    try {
      const token = getAccessToken();
      const tokenRole = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (tokenRole !== "admin") throw new Error("Insufficient permissions.");

      const res = await apiFetch<{ user: { id: string; email: string; role: string } }>("/admin/users", {
        method: "POST",
        token,
        body: JSON.stringify({ email, password, role })
      });
      setStatus(`Created ${res.user.role}: ${res.user.email}`);
      setEmail("");
      setPassword("");
      setRole("evaluator");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold">Create internal user</h2>
      <p className="mt-1 text-sm text-white/80">Admins can create evaluator/admin accounts.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="off"
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
            <option value="evaluator">Evaluator</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button type="button" onClick={create} disabled={saving || !email.trim() || password.length < 8}>
          {saving ? "Creating..." : "Create user"}
        </Button>
        {status ? <p className="text-sm text-white/80">{status}</p> : null}
      </div>
    </Card>
  );
}



