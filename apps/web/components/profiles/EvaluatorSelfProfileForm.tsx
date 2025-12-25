"use client";

import * as React from "react";

import { Card, Input, Label, Button } from "@/components/ui";
import { apiFetch, ApiFetchError } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { toast } from "@/components/ToastProvider";
import { ProfileCompletionMeter } from "./ProfileCompletionMeter";

type EvaluatorProfile = {
  firstName?: string;
  lastName?: string;
  title?: string;
  location?: string;
  city?: string;
  state?: string;
  bio?: string;
  experienceYears?: number;
  credentials?: string[];
  specialties?: string[];
  isProfilePublic?: boolean;
};

type ProfileMeResponse = {
  profile: EvaluatorProfile;
  profileCompletion: { score: number; missing: string[] };
};

function parseCsv(text: string) {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function EvaluatorSelfProfileForm() {
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<ProfileMeResponse | null>(null);
  const [form, setForm] = React.useState({
    firstName: "",
    lastName: "",
    title: "",
    location: "",
    city: "",
    state: "",
    bio: "",
    experienceYears: "",
    credentials: "",
    specialties: ""
  });

  const lastAutoRef = React.useRef<{ loc: string; city: string; state: string } | null>(null);

  function normalizeStateCodeOrName(input: string): string | null {
    const s = String(input ?? "").trim();
    if (!s) return null;
    const up = s.toUpperCase();
    if (/^[A-Z]{2}$/.test(up)) return up;
    const map: Record<string, string> = {
      Alabama: "AL",
      Alaska: "AK",
      Arizona: "AZ",
      Arkansas: "AR",
      California: "CA",
      Colorado: "CO",
      Connecticut: "CT",
      Delaware: "DE",
      Florida: "FL",
      Georgia: "GA",
      Hawaii: "HI",
      Idaho: "ID",
      Illinois: "IL",
      Indiana: "IN",
      Iowa: "IA",
      Kansas: "KS",
      Kentucky: "KY",
      Louisiana: "LA",
      Maine: "ME",
      Maryland: "MD",
      Massachusetts: "MA",
      Michigan: "MI",
      Minnesota: "MN",
      Mississippi: "MS",
      Missouri: "MO",
      Montana: "MT",
      Nebraska: "NE",
      Nevada: "NV",
      "New Hampshire": "NH",
      "New Jersey": "NJ",
      "New Mexico": "NM",
      "New York": "NY",
      "North Carolina": "NC",
      "North Dakota": "ND",
      Ohio: "OH",
      Oklahoma: "OK",
      Oregon: "OR",
      Pennsylvania: "PA",
      "Rhode Island": "RI",
      "South Carolina": "SC",
      "South Dakota": "SD",
      Tennessee: "TN",
      Texas: "TX",
      Utah: "UT",
      Vermont: "VT",
      Virginia: "VA",
      Washington: "WA",
      "West Virginia": "WV",
      Wisconsin: "WI",
      Wyoming: "WY",
      "District of Columbia": "DC"
    };
    const key = Object.keys(map).find((k) => k.toLowerCase() === s.toLowerCase());
    return key ? map[key] : null;
  }

  React.useEffect(() => {
    const loc = String(form.location ?? "").trim();
    if (!loc) return;
    const parts = loc.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length < 2) return;
    const cityGuess = parts[0];
    const stateGuess = normalizeStateCodeOrName(parts[parts.length - 1]);
    if (!stateGuess) return;

    const last = lastAutoRef.current;
    const allowUpdateCity = !form.city.trim() || (last && last.loc === loc && last.city === form.city);
    const allowUpdateState = !form.state.trim() || (last && last.loc === loc && last.state === form.state);
    if (!allowUpdateCity && !allowUpdateState) return;

    lastAutoRef.current = { loc, city: cityGuess, state: stateGuess };
    setForm((f) => ({
      ...f,
      ...(allowUpdateCity ? { city: cityGuess } : {}),
      ...(allowUpdateState ? { state: stateGuess } : {})
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.location]);

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
        location: res.profile.location ?? "",
        city: res.profile.city ?? "",
        state: res.profile.state ?? "",
        bio: res.profile.bio ?? "",
        experienceYears: typeof res.profile.experienceYears === "number" ? String(res.profile.experienceYears) : "",
        credentials: (res.profile.credentials ?? []).join(", "),
        specialties: (res.profile.specialties ?? []).join(", ")
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
      const payload: EvaluatorProfile = {
        firstName: form.firstName.trim() || undefined,
        lastName: form.lastName.trim() || undefined,
        title: form.title.trim() || undefined,
        location: form.location.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        bio: form.bio.trim() || undefined,
        experienceYears: form.experienceYears ? Number(form.experienceYears) : undefined,
        credentials: parseCsv(form.credentials),
        specialties: parseCsv(form.specialties)
      };
      const res = await apiFetch<ProfileMeResponse>("/profiles/me", { method: "PUT", token, body: JSON.stringify(payload) });
      setData(res);
      toast({ kind: "success", title: "Saved", message: "Evaluator profile updated." });
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
          <h2 className="text-lg font-semibold">Evaluator profile</h2>
          <p className="mt-1 text-sm text-white/80">This information can be shown on your public evaluator page if you enable visibility.</p>
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
          <Label htmlFor="evalFirstName">First name</Label>
          <Input id="evalFirstName" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="evalLastName">Last name</Label>
          <Input id="evalLastName" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="evalTitle">Title</Label>
          <Input id="evalTitle" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="evalLocation">Location</Label>
          <Input
            id="evalLocation"
            value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
            placeholder="e.g. Raleigh, NC"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="evalCity">City</Label>
          <Input id="evalCity" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="evalState">State</Label>
          <Input id="evalState" value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} placeholder="e.g. NC" />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="evalBio">Bio</Label>
          <textarea
            id="evalBio"
            className="min-h-28 w-full rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary-600)]"
            value={form.bio}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            placeholder="Your background and evaluation approach..."
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="evalYears">Experience (years)</Label>
          <Input id="evalYears" value={form.experienceYears} onChange={(e) => setForm((f) => ({ ...f, experienceYears: e.target.value }))} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="evalCredentials">Credentials (comma-separated)</Label>
          <Input id="evalCredentials" value={form.credentials} onChange={(e) => setForm((f) => ({ ...f, credentials: e.target.value }))} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="evalSpecialties">Specialties (comma-separated)</Label>
          <Input id="evalSpecialties" value={form.specialties} onChange={(e) => setForm((f) => ({ ...f, specialties: e.target.value }))} />
        </div>
      </div>
    </Card>
  );
}


