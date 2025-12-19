"use client";

import { useState } from "react";

import { Button, Card, Input, Label } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";

export function AdminInviteGenerator() {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [creatingInvite, setCreatingInvite] = useState(false);

  async function createInvite() {
    setInviteStatus(null);
    setCreatingInvite(true);
    try {
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
      setInviteStatus(`Invite created for ${res.invite.email}. Code: ${res.invite.token}. Link: ${link}`);
      setInviteEmail("");
    } catch (err) {
      setInviteStatus(err instanceof Error ? err.message : "Failed to create invite");
    } finally {
      setCreatingInvite(false);
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold">Create evaluator invite</h2>
      <p className="mt-1 text-sm text-white/80">Generates a one-time invite code (expires in 7 days).</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="inviteEmail">Evaluator email</Label>
          <Input id="inviteEmail" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} autoComplete="off" />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button type="button" onClick={createInvite} disabled={creatingInvite || !inviteEmail.trim()}>
          {creatingInvite ? "Creating..." : "Create invite"}
        </Button>
        {inviteStatus ? <p className="text-sm text-white/80">{inviteStatus}</p> : null}
      </div>
    </Card>
  );
}


