"use client";

import * as React from "react";

import { Card, Input, Label, Button } from "@/components/ui";
import { apiFetch, ApiFetchError } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { toast } from "@/components/ToastProvider";
import { ProfileCompletionMeter } from "./ProfileCompletionMeter";

type CoachProfile = {
  firstName?: string;
  lastName?: string;
  title?: string;
  institutionName?: string;
  programLevel?: string;
  institutionLocation?: string;
  positionsOfInterest?: string[];
  gradYears?: number[];
  regions?: string[];
  isProfilePublic?: boolean;
};

type ProfileMeResponse = {
  profile: CoachProfile;
  profileCompletion: { score: number; missing: string[] };
};

function parseCsv(text: string) {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function CoachSelfProfileForm() {
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<ProfileMeResponse | null>(null);
  const [form, setForm] = React.useState({
    firstName: "",
    lastName: "",
    title: "",
    institutionName: "",
    programLevel: "",
    institutionLocation: "",
    positionsOfInterest: "",
    gradYears: "",
    regions: ""
  });

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Please login first.");
      const res = await apiFetch<ProfileMeResponse>("/profiles/me", { token });
      setData(res);
      setForm({
        firstName: res.profile.firstName ?? "",
        lastName: res.profile.lastName ?? "",
        title: res.profile.title ?? "",
        institutionName: res.profile.institutionName ?? "",
        programLevel: res.profile.programLevel ?? "",
        institutionLocation: res.profile.institutionLocation ?? "",
        positionsOfInterest: (res.profile.positionsOfInterest ?? []).join(", "),
        gradYears: (res.profile.gradYears ?? []).join(", "),
        regions: (res.profile.regions ?? []).join(", ")
      });
    } catch (err) {
      if (err instanceof ApiFetchError && err.status === 404) {
        setData(null);
      } else {
        setError(err instanceof Error ? err.message : "Failed to load profile");
      }
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Please login first.");
      const payload: CoachProfile = {
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || undefined,
        title: form.title.trim() || undefined,
        institutionName: form.institutionName.trim() || undefined,
        programLevel: form.programLevel.trim() || undefined,
        institutionLocation: form.institutionLocation.trim() || undefined,
        positionsOfInterest: parseCsv(form.positionsOfInterest),
        gradYears: parseCsv(form.gradYears).map((v) => Number(v)).filter((n) => Number.isFinite(n)) as number[],
        regions: parseCsv(form.regions)
      };
      const res = await apiFetch<ProfileMeResponse>("/profiles/me", { method: "PUT", token, body: JSON.stringify(payload) });
      setData(res);
      toast({ kind: "success", title: "Saved", message: "Coach profile updated." });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Coach profile</h2>
          <p className="mt-1 text-sm text-white/80">This information can be shown on your public coach page if you enable visibility.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" className="border border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={load} disabled={loading || saving}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {data?.profileCompletion ? (
        <div className="mt-6">
          <ProfileCompletionMeter score={data.profileCompletion.score} missing={data.profileCompletion.missing} />
        </div>
      ) : null}

      {error ? <div className="mt-4 text-sm text-red-300">{error}</div> : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="coachFirstName">First name</Label>
          <Input id="coachFirstName" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="coachLastName">Last name</Label>
          <Input id="coachLastName" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="coachTitle">Title</Label>
          <Input id="coachTitle" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="coachInstitution">Institution name</Label>
          <Input id="coachInstitution" value={form.institutionName} onChange={(e) => setForm((f) => ({ ...f, institutionName: e.target.value }))} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="coachProgramLevel">Program level</Label>
          <Input id="coachProgramLevel" value={form.programLevel} onChange={(e) => setForm((f) => ({ ...f, programLevel: e.target.value }))} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="coachLocation">Institution location</Label>
          <Input id="coachLocation" value={form.institutionLocation} onChange={(e) => setForm((f) => ({ ...f, institutionLocation: e.target.value }))} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="coachPositions">Positions of interest (comma-separated)</Label>
          <Input id="coachPositions" value={form.positionsOfInterest} onChange={(e) => setForm((f) => ({ ...f, positionsOfInterest: e.target.value }))} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="coachGradYears">Grad years (comma-separated)</Label>
          <Input id="coachGradYears" value={form.gradYears} onChange={(e) => setForm((f) => ({ ...f, gradYears: e.target.value }))} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="coachRegions">Regions (comma-separated)</Label>
          <Input id="coachRegions" value={form.regions} onChange={(e) => setForm((f) => ({ ...f, regions: e.target.value }))} />
        </div>
      </div>
    </Card>
  );
}


