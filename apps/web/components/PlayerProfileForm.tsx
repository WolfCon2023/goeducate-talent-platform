"use client";

import { useEffect, useState } from "react";

import { Card, Input, Label, Button } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";
import { ProfilePhotoUploader } from "@/components/ProfilePhotoUploader";
import { FieldError, FormErrorSummary } from "@/components/FormErrors";
import { parseApiError, type FieldErrors } from "@/lib/formErrors";

type Sport = "football" | "basketball" | "volleyball" | "soccer" | "track" | "other";

const POSITIONS_BY_SPORT: Record<Exclude<Sport, "other">, string[]> = {
  football: [
    "Quarterback (QB)",
    "Running Back (RB)",
    "Fullback (FB)",
    "Wide Receiver (WR)",
    "Tight End (TE)",
    "Center (C)",
    "Guard (G)",
    "Tackle (T)",
    "Defensive Tackle (DT)",
    "Defensive End (DE)",
    "Linebacker (LB)",
    "Inside Linebacker (ILB)",
    "Outside Linebacker (OLB)",
    "Cornerback (CB)",
    "Free Safety (FS)",
    "Strong Safety (SS)",
    "Kicker (K)",
    "Punter (P)",
    "Long Snapper (LS)",
    "Return Specialist (KR/PR)"
  ],
  basketball: ["Point Guard (PG)", "Shooting Guard (SG)", "Small Forward (SF)", "Power Forward (PF)", "Center (C)", "Combo Guard", "Wing", "Forward"],
  volleyball: ["Outside Hitter", "Opposite Hitter", "Middle Blocker", "Setter", "Libero", "Defensive Specialist"],
  soccer: [
    "Goalkeeper",
    "Center Back",
    "Left Back",
    "Right Back",
    "Wing Back",
    "Defensive Midfielder",
    "Central Midfielder",
    "Attacking Midfielder",
    "Winger",
    "Forward",
    "Striker"
  ],
  track: [
    "100m",
    "200m",
    "400m",
    "800m",
    "1500m",
    "Mile",
    "3000m",
    "5000m",
    "10000m",
    "110m Hurdles",
    "100m Hurdles",
    "400m Hurdles",
    "4x100m Relay",
    "4x400m Relay",
    "Long Jump",
    "Triple Jump",
    "High Jump",
    "Pole Vault",
    "Shot Put",
    "Discus",
    "Javelin",
    "Hammer Throw",
    "Decathlon",
    "Heptathlon"
  ]
};

function inferSportFromPosition(pos: string): Sport | null {
  const trimmed = (pos ?? "").trim();
  if (!trimmed) return null;
  for (const sport of Object.keys(POSITIONS_BY_SPORT) as Array<Exclude<Sport, "other">>) {
    if (POSITIONS_BY_SPORT[sport].includes(trimmed)) return sport;
  }
  return null;
}

type Profile = {
  firstName: string;
  lastName: string;
  sport?: Sport;
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
    sport: props.initial?.sport,
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
  const [positionChoice, setPositionChoice] = useState<string>(() => {
    const pos = props.initial?.position ?? "";
    const inferred = inferSportFromPosition(pos);
    if (inferred) return pos;
    return "Other";
  });
  const [positionOther, setPositionOther] = useState<string>(() => {
    const pos = props.initial?.position ?? "";
    const inferred = inferSportFromPosition(pos);
    return inferred ? "" : pos;
  });
  const [heightFt, setHeightFt] = useState<number | undefined>(() =>
    typeof props.initial?.heightIn === "number" ? Math.floor(props.initial.heightIn / 12) : undefined
  );
  const [heightInPart, setHeightInPart] = useState<number | undefined>(() =>
    typeof props.initial?.heightIn === "number" ? props.initial.heightIn % 12 : undefined
  );
  const [status, setStatus] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) return;
      if (role && role !== "player") {
        setFormError("This page is only available to player accounts.");
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
          sport: (res as any).sport,
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
        const inferred = inferSportFromPosition(res.position ?? "");
        const nextSport = ((res as any).sport as Sport | undefined) ?? inferred ?? undefined;
        setForm((p) => ({ ...p, sport: nextSport }));
        if (nextSport && nextSport !== "other") {
          const list = POSITIONS_BY_SPORT[nextSport];
          if (list.includes(res.position ?? "")) {
            setPositionChoice(res.position ?? "");
            setPositionOther("");
          } else {
            setPositionChoice("Other");
            setPositionOther(res.position ?? "");
          }
        } else {
          setPositionChoice("Other");
          setPositionOther(res.position ?? "");
        }
        setHeightFt(typeof res.heightIn === "number" ? Math.floor(res.heightIn / 12) : undefined);
        setHeightInPart(typeof res.heightIn === "number" ? res.heightIn % 12 : undefined);
      } catch (err) {
        // Ignore "no profile yet" case
        const msg = err instanceof Error ? err.message : "";
        if (msg !== "Profile not found") setFormError(msg || "Failed to load profile");
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
    setFormError(null);
    setFieldErrors(undefined);
    setSaving(true);
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Please login first.");
      const role = getTokenRole(token);
      if (role && role !== "player") throw new Error("This page is only available to player accounts.");

      const heightIn = computeHeightIn(heightFt, heightInPart);
      const finalPosition = positionChoice === "Other" ? positionOther.trim() : positionChoice;
      const fe: FieldErrors = {};
      if (!form.firstName.trim()) fe.firstName = ["First name is required."];
      if (!form.lastName.trim()) fe.lastName = ["Last name is required."];
      if (!form.city.trim()) fe.city = ["City is required."];
      if (!form.state.trim()) fe.state = ["State is required."];
      if (!Number.isFinite(Number(form.gradYear))) fe.gradYear = ["Graduation year is required."];
      if (!finalPosition) fe.position = ["Position / Event is required."];
      if (Object.keys(fe).length > 0) {
        setFieldErrors(fe);
        return;
      }
      await apiFetch("/player-profiles/me", {
        method: "PUT",
        token,
        body: JSON.stringify({
          ...form,
          position: finalPosition,
          gradYear: Number(form.gradYear),
          heightIn,
          weightLb: form.weightLb ? Number(form.weightLb) : undefined
        })
      });
      setStatus("Saved.");
    } catch (err) {
      const parsed = parseApiError(err);
      setFormError(parsed.formError ?? "Save failed");
      setFieldErrors(parsed.fieldErrors);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4">
      <ProfilePhotoUploader title="Player profile photo" />
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
      <div className="mt-4">
        <FormErrorSummary formError={formError ?? undefined} fieldErrors={fieldErrors} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="firstName">First name</Label>
          <Input id="firstName" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
          <FieldError name="firstName" fieldErrors={fieldErrors} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="lastName">Last name</Label>
          <Input id="lastName" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
          <FieldError name="lastName" fieldErrors={fieldErrors} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="sport">Sport</Label>
          <select
            id="sport"
            className="w-full rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary-600)]"
            value={form.sport ?? "football"}
            onChange={(e) => {
              const next = e.target.value as Sport;
              set("sport", next);
              setPositionChoice("Other");
              setPositionOther("");
            }}
          >
            <option value="football">Football</option>
            <option value="basketball">Basketball</option>
            <option value="volleyball">Volleyball</option>
            <option value="soccer">Soccer</option>
            <option value="track">Track</option>
            <option value="other">Other (enter manually)</option>
          </select>
          <FieldError name="sport" fieldErrors={fieldErrors} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="position">Position / Event</Label>
          {form.sport === "other" ? (
            <Input
              id="position"
              value={positionOther}
              onChange={(e) => setPositionOther(e.target.value)}
              placeholder="Other (enter manually)"
            />
          ) : (
            <select
              id="position"
              className="w-full rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary-600)]"
              value={positionChoice}
              onChange={(e) => {
                setPositionChoice(e.target.value);
                if (e.target.value !== "Other") setPositionOther("");
              }}
            >
              {(POSITIONS_BY_SPORT[(form.sport ?? "football") as Exclude<Sport, "other">] ?? []).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
              <option value="Other">Other (enter manually)</option>
            </select>
          )}
          {form.sport !== "other" && positionChoice === "Other" ? (
            <Input
              id="positionOther"
              value={positionOther}
              onChange={(e) => setPositionOther(e.target.value)}
              placeholder="Other (enter manually)"
            />
          ) : null}
          <FieldError name="position" fieldErrors={fieldErrors} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="gradYear">Graduation year</Label>
          <Input
            id="gradYear"
            type="number"
            value={form.gradYear}
            onChange={(e) => set("gradYear", Number(e.target.value))}
          />
          <FieldError name="gradYear" fieldErrors={fieldErrors} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" value={form.city} onChange={(e) => set("city", e.target.value)} />
          <FieldError name="city" fieldErrors={fieldErrors} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="state">State</Label>
          <Input id="state" value={form.state} onChange={(e) => set("state", e.target.value)} />
          <FieldError name="state" fieldErrors={fieldErrors} />
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
          <FieldError name="contactEmail" fieldErrors={fieldErrors} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="contactPhone">Contact phone (coach gated)</Label>
          <Input
            id="contactPhone"
            value={form.contactPhone ?? ""}
            onChange={(e) => set("contactPhone", e.target.value || undefined)}
            placeholder="(555) 555-5555"
          />
          <FieldError name="contactPhone" fieldErrors={fieldErrors} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="hudlLink">HUDL link (later)</Label>
          <Input id="hudlLink" value={form.hudlLink ?? ""} onChange={(e) => set("hudlLink", e.target.value)} />
        </div>
      </div>

      {status ? <p className="mt-4 text-sm text-white/80">{status}</p> : null}
      </Card>
    </div>
  );
}


