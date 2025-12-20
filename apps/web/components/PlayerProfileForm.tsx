"use client";

import { useEffect, useState } from "react";

import { Card, Input, Label, Button } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";

type Profile = {
  firstName: string;
  lastName: string;
  position: string;
  gradYear: number;
  state: string;
  city: string;
  heightIn?: number;
  weightLb?: number;
  contactEmail?: string;
  contactPhone?: string;
  hudlLink?: string;
};

export function PlayerProfileForm(props: { initial?: Partial<Profile> }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Profile>({
    firstName: props.initial?.firstName ?? "",
    lastName: props.initial?.lastName ?? "",
    position: props.initial?.position ?? "",
    gradYear: props.initial?.gradYear ?? new Date().getFullYear(),
    state: props.initial?.state ?? "",
    city: props.initial?.city ?? "",
    heightIn: props.initial?.heightIn,
    weightLb: props.initial?.weightLb,
    contactEmail: props.initial?.contactEmail,
    contactPhone: props.initial?.contactPhone,
    hudlLink: props.initial?.hudlLink
  });
  const [heightFt, setHeightFt] = useState<number | undefined>(() =>
    typeof props.initial?.heightIn === "number" ? Math.floor(props.initial.heightIn / 12) : undefined
  );
  const [heightInPart, setHeightInPart] = useState<number | undefined>(() =>
    typeof props.initial?.heightIn === "number" ? props.initial.heightIn % 12 : undefined
  );
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) return;
      if (role && role !== "player") {
        setStatus("This page is only available to player accounts.");
        return;
      }
      setLoading(true);
      try {
        const res = await apiFetch<Profile & { _id?: string }>("/player-profiles/me", { token });
        if (cancelled) return;
        setForm((p) => ({
          ...p,
          firstName: res.firstName ?? "",
          lastName: res.lastName ?? "",
          position: res.position ?? "",
          gradYear: res.gradYear ?? p.gradYear,
          state: res.state ?? "",
          city: res.city ?? "",
          heightIn: res.heightIn,
          weightLb: res.weightLb,
          contactEmail: res.contactEmail,
          contactPhone: res.contactPhone,
          hudlLink: res.hudlLink
        }));
        setHeightFt(typeof res.heightIn === "number" ? Math.floor(res.heightIn / 12) : undefined);
        setHeightInPart(typeof res.heightIn === "number" ? res.heightIn % 12 : undefined);
      } catch (err) {
        // Ignore "no profile yet" case
        const msg = err instanceof Error ? err.message : "";
        if (msg !== "Profile not found") setStatus(msg || "Failed to load profile");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  function computeHeightIn(ft?: number, inch?: number) {
    if (typeof ft !== "number" && typeof inch !== "number") return undefined;
    const safeFt = typeof ft === "number" ? ft : 0;
    const safeIn = typeof inch === "number" ? inch : 0;
    if (safeFt < 0 || safeIn < 0) return undefined;
    const total = safeFt * 12 + safeIn;
    return Number.isFinite(total) ? total : undefined;
  }

  async function save() {
    setStatus(null);
    setSaving(true);
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Please login first.");
      const role = getTokenRole(token);
      if (role && role !== "player") throw new Error("This page is only available to player accounts.");
      const heightIn = computeHeightIn(heightFt, heightInPart);
      await apiFetch("/player-profiles/me", {
        method: "PUT",
        token,
        body: JSON.stringify({
          ...form,
          gradYear: Number(form.gradYear),
          heightIn,
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
          <p className="mt-1 text-sm text-white/80">This powers coach search and evaluation workflows.</p>
        </div>
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      {loading ? <p className="mt-4 text-sm text-white/80">Loading your saved profile...</p> : null}

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
          <div className="text-sm font-medium text-[color:var(--muted)]">Height</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <div className="text-xs text-white/70">Ft</div>
              <Input
                id="heightFt"
                type="number"
                min={4}
                max={7}
                value={heightFt ?? ""}
                onChange={(e) => {
                  const next = e.target.value ? Number(e.target.value) : undefined;
                  setHeightFt(Number.isFinite(next as number) ? next : undefined);
                }}
              />
            </div>
            <div className="grid gap-2">
              <div className="text-xs text-white/70">In</div>
              <Input
                id="heightInPart"
                type="number"
                min={0}
                max={11}
                value={heightInPart ?? ""}
                onChange={(e) => {
                  const next = e.target.value ? Number(e.target.value) : undefined;
                  setHeightInPart(Number.isFinite(next as number) ? next : undefined);
                }}
              />
            </div>
          </div>
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
          <Label htmlFor="contactEmail">Contact email (coach gated)</Label>
          <Input
            id="contactEmail"
            type="email"
            value={form.contactEmail ?? ""}
            onChange={(e) => set("contactEmail", e.target.value || undefined)}
            placeholder="you@example.com"
          />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="contactPhone">Contact phone (coach gated)</Label>
          <Input
            id="contactPhone"
            value={form.contactPhone ?? ""}
            onChange={(e) => set("contactPhone", e.target.value || undefined)}
            placeholder="(555) 555-5555"
          />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="hudlLink">HUDL link (later)</Label>
          <Input id="hudlLink" value={form.hudlLink ?? ""} onChange={(e) => set("hudlLink", e.target.value)} />
        </div>
      </div>

      {status ? <p className="mt-4 text-sm text-white/80">{status}</p> : null}
    </Card>
  );
}


