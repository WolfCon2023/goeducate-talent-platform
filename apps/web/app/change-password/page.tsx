"use client";

import { useState } from "react";

import { RoleGuard } from "@/components/RoleGuard";
import { Card, Button, Input, Label } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { FormErrorSummary, FieldError } from "@/components/FormErrors";
import type { FieldErrors } from "@/lib/formErrors";
import { toast } from "@/components/ToastProvider";

export default function ChangePasswordPage() {
  return (
    <RoleGuard allowed={["player", "coach", "evaluator", "admin"]}>
      <ChangePasswordInner />
    </RoleGuard>
  );
}

function ChangePasswordInner() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors | undefined>(undefined);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors(undefined);
    setSaving(true);
    try {
      const fe: FieldErrors = {};
      if (!currentPassword) fe.currentPassword = ["Current password is required."];
      if (!newPassword || newPassword.length < 8) fe.newPassword = ["New password must be at least 8 characters."];
      if (Object.keys(fe).length) {
        setFieldErrors(fe);
        return;
      }
      const token = getAccessToken();
      if (!token) throw new Error("Please login first.");
      await apiFetch("/auth/change-password", { method: "POST", token, body: JSON.stringify({ currentPassword, newPassword }) });
      setCurrentPassword("");
      setNewPassword("");
      toast({ kind: "success", title: "Saved", message: "Password updated." });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <Card>
        <h1 className="text-xl font-semibold">Change password</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">Update your password for future sign-ins.</p>

        <div className="mt-4">
          <FormErrorSummary formError={formError ?? undefined} fieldErrors={fieldErrors} />
        </div>

        <form onSubmit={submit} className="mt-6 grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
            <FieldError name="currentPassword" fieldErrors={fieldErrors} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="newPassword">New password</Label>
            <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
            <FieldError name="newPassword" fieldErrors={fieldErrors} />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Update password"}
          </Button>
        </form>
      </Card>
    </div>
  );
}


