"use client";

import { useState } from "react";

import { FieldError, FormErrorSummary } from "@/components/FormErrors";
import { Button, Card, Input, Label } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";
import { parseApiError, type FieldErrors } from "@/lib/formErrors";

export function AdminInviteGenerator() {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors | undefined>(undefined);
  const [creatingInvite, setCreatingInvite] = useState(false);

  async function createInvite() {
    setInviteSuccess(null);
    setFormError(null);
    setFieldErrors(undefined);
    setCreatingInvite(true);
    try {
      const fe: FieldErrors = {};
      if (!inviteEmail.trim()) fe.inviteEmail = ["Email is required."];
      if (Object.keys(fe).length > 0) {
        setFieldErrors(fe);
        return;
      }
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "admin") throw new Error("Insufficient permissions.");

      const res = await apiFetch<{ invite: { email: string; token: string; expiresAt: string } }>("/admin/evaluator-invites", {
        method: "POST",
        token,
        body: JSON.stringify({ email: inviteEmail })
      });

      const link = `${window.location.origin}/evaluator/create-account`;
      setInviteSuccess(`Invite created for ${res.invite.email}. Code: ${res.invite.token}. Link: ${link}`);
      setInviteEmail("");
    } catch (err) {
      const parsed = parseApiError(err);
      setFormError(parsed.formError ?? "Failed to create invite");
      setFieldErrors(parsed.fieldErrors);
    } finally {
      setCreatingInvite(false);
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold">Create evaluator invite</h2>
      <p className="mt-1 text-sm text-white/80">Generates a one-time invite code (expires in 7 days).</p>
      <div className="mt-4">
        <FormErrorSummary formError={formError ?? undefined} fieldErrors={fieldErrors} />
        {inviteSuccess ? <div className="mt-3 text-sm text-white/80">{inviteSuccess}</div> : null}
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="evaluatorInviteEmail">Evaluator email</Label>
          <Input
            id="evaluatorInviteEmail"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            autoComplete="off"
          />
          <FieldError name="inviteEmail" fieldErrors={fieldErrors} />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button type="button" onClick={createInvite} disabled={creatingInvite || !inviteEmail.trim()}>
          {creatingInvite ? "Creating..." : "Create invite"}
        </Button>
      </div>
    </Card>
  );
}


