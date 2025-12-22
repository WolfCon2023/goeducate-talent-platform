"use client";

import { useState } from "react";

import { FieldError, FormErrorSummary } from "@/components/FormErrors";
import { Button, Card, Input, Label } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";
import { parseApiError, type FieldErrors } from "@/lib/formErrors";

type Role = "evaluator" | "admin";

export function AdminCreateUser() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("evaluator");
  const [success, setSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  async function create() {
    setSuccess(null);
    setFormError(null);
    setFieldErrors(undefined);
    setSaving(true);
    try {
      const fe: FieldErrors = {};
      if (!email.trim()) fe.email = ["Email is required."];
      if (!password || password.length < 8) fe.password = ["Password must be at least 8 characters."];
      if (Object.keys(fe).length > 0) {
        setFieldErrors(fe);
        return;
      }
      const token = getAccessToken();
      const tokenRole = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (tokenRole !== "admin") throw new Error("Insufficient permissions.");

      const res = await apiFetch<{ user: { id: string; email: string; role: string } }>("/admin/users", {
        method: "POST",
        token,
        body: JSON.stringify({ email, password, role })
      });
      setSuccess(`Created ${res.user.role}: ${res.user.email}`);
      setEmail("");
      setPassword("");
      setRole("evaluator");
    } catch (err) {
      const parsed = parseApiError(err);
      setFormError(parsed.formError ?? "Failed to create user");
      setFieldErrors(parsed.fieldErrors);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold">Create internal user</h2>
      <p className="mt-1 text-sm text-white/80">Admins can create evaluator/admin accounts.</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <div className="mt-4">
          <FormErrorSummary formError={formError ?? undefined} fieldErrors={fieldErrors} />
          {success ? <div className="mt-3 text-sm text-white/80">{success}</div> : null}
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="createUserEmail">Email</Label>
            <Input id="createUserEmail" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
            <FieldError name="email" fieldErrors={fieldErrors} />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="createUserPassword">Password</Label>
            <Input
              id="createUserPassword"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="off"
            />
            <FieldError name="password" fieldErrors={fieldErrors} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="createUserRole">Role</Label>
            <select
              id="createUserRole"
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
          <Button type="submit" disabled={saving || !email.trim() || password.length < 8}>
            {saving ? "Creating..." : "Create user"}
          </Button>
        </div>
      </form>
    </Card>
  );
}



