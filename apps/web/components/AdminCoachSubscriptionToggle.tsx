"use client";

import { useState } from "react";

import { Button, Card, Input, Label } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";

export function AdminCoachSubscriptionToggle() {
  const [coachUserId, setCoachUserId] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function update() {
    setMsg(null);
    setSaving(true);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "admin") throw new Error("Insufficient permissions.");

      const res = await apiFetch<{ user: { id: string; email: string; subscriptionStatus?: string } }>(
        `/admin/coaches/${encodeURIComponent(coachUserId)}/subscription`,
        {
          method: "PATCH",
          token,
          body: JSON.stringify({ status })
        }
      );
      setMsg(`Updated ${res.user.email} subscriptionStatus=${res.user.subscriptionStatus}`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed to update subscription");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold">Coach subscription (scaffold)</h2>
      <p className="mt-1 text-sm text-slate-300">Temporary admin toggle until Stripe is implemented.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="coachUserId">Coach userId or email</Label>
          <Input id="coachUserId" value={coachUserId} onChange={(e) => setCoachUserId(e.target.value)} autoComplete="off" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            className="w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50"
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
          >
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button type="button" onClick={update} disabled={saving || !coachUserId.trim()}>
          {saving ? "Updating..." : "Update"}
        </Button>
        {msg ? <p className="text-sm text-slate-300">{msg}</p> : null}
      </div>
    </Card>
  );
}


