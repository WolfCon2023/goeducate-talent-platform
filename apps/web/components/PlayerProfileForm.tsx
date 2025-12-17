"use client";

import { useState } from "react";

import { Card, Input, Label, Button } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";

type Profile = {
  firstName: string;
  lastName: string;
  position: string;
  gradYear: number;
  state: string;
  city: string;
  heightIn?: number;
  weightLb?: number;
  hudlLink?: string;
};

export function PlayerProfileForm(props: { initial?: Partial<Profile> }) {
  const [form, setForm] = useState<Profile>({
    firstName: props.initial?.firstName ?? "",
    lastName: props.initial?.lastName ?? "",
    position: props.initial?.position ?? "",
    gradYear: props.initial?.gradYear ?? new Date().getFullYear(),
    state: props.initial?.state ?? "",
    city: props.initial?.city ?? "",
    heightIn: props.initial?.heightIn,
    weightLb: props.initial?.weightLb,
    hudlLink: props.initial?.hudlLink
  });
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  async function save() {
    setStatus(null);
    setSaving(true);
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Please login first.");
      await apiFetch("/player-profiles/me", {
        method: "PUT",
        token,
        body: JSON.stringify({
          ...form,
          gradYear: Number(form.gradYear),
          heightIn: form.heightIn ? Number(form.heightIn) : undefined,
          weightLb: form.weightLb ? Number(form.weightLb) : undefined
        })
      });
      setStatus("Saved.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Athlete profile</h2>
          <p className="mt-1 text-sm text-slate-300">This powers coach search and evaluation workflows.</p>
        </div>
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="firstName">First name</Label>
          <Input id="firstName" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="lastName">Last name</Label>
          <Input id="lastName" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="position">Position</Label>
          <Input id="position" value={form.position} onChange={(e) => set("position", e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="gradYear">Graduation year</Label>
          <Input
            id="gradYear"
            type="number"
            value={form.gradYear}
            onChange={(e) => set("gradYear", Number(e.target.value))}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" value={form.city} onChange={(e) => set("city", e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="state">State</Label>
          <Input id="state" value={form.state} onChange={(e) => set("state", e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="heightIn">Height (inches)</Label>
          <Input
            id="heightIn"
            type="number"
            value={form.heightIn ?? ""}
            onChange={(e) => set("heightIn", e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="weightLb">Weight (lbs)</Label>
          <Input
            id="weightLb"
            type="number"
            value={form.weightLb ?? ""}
            onChange={(e) => set("weightLb", e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="hudlLink">HUDL link (later)</Label>
          <Input id="hudlLink" value={form.hudlLink ?? ""} onChange={(e) => set("hudlLink", e.target.value)} />
        </div>
      </div>

      {status ? <p className="mt-4 text-sm text-slate-300">{status}</p> : null}
    </Card>
  );
}


