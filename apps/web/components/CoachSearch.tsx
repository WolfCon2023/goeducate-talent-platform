"use client";

import { useState } from "react";

import { Card, Input, Label, Button } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";

type Sport = "" | "football" | "basketball" | "volleyball" | "soccer" | "track" | "other";

const POSITIONS_BY_SPORT: Record<Exclude<Sport, "" | "other">, string[]> = {
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

type PlayerProfile = {
  _id: string;
  userId: string;
  firstName: string;
  lastName: string;
  sport?: string;
  position: string;
  gradYear: number;
  state: string;
  city: string;
  heightIn?: number;
  weightLb?: number;
};

export function CoachSearch() {
  const [sport, setSport] = useState<Sport>("");
  const [positionChoice, setPositionChoice] = useState<string>("");
  const [positionOther, setPositionOther] = useState<string>("");
  const [gradYearMin, setGradYearMin] = useState("");
  const [gradYearMax, setGradYearMax] = useState("");
  const [heightMinFt, setHeightMinFt] = useState("");
  const [heightMinIn, setHeightMinIn] = useState("");
  const [heightMaxFt, setHeightMaxFt] = useState("");
  const [heightMaxIn, setHeightMaxIn] = useState("");
  const [weightMin, setWeightMin] = useState("");
  const [weightMax, setWeightMax] = useState("");
  const [state, setState] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"updated_desc" | "gradYear_asc" | "gradYear_desc" | "lastName_asc">("updated_desc");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<PlayerProfile[]>([]);
  const [watchlisted, setWatchlisted] = useState<Record<string, boolean>>({});

  function toHeightIn(ft: string, inch: string) {
    const f = ft ? Number(ft) : NaN;
    const i = inch ? Number(inch) : NaN;
    if (!Number.isFinite(f) && !Number.isFinite(i)) return "";
    const safeF = Number.isFinite(f) ? f : 0;
    const safeI = Number.isFinite(i) ? i : 0;
    return String(safeF * 12 + safeI);
  }

  async function search() {
    setError(null);
    setLoading(true);
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Please login as a coach first.");

      const params = new URLSearchParams();
      if (sport) params.set("sport", sport);
      const finalPosition = sport
        ? sport === "other"
          ? positionOther.trim()
          : positionChoice === "Other"
            ? positionOther.trim()
            : positionChoice.trim()
        : "";
      if (finalPosition) params.set("position", finalPosition);
      if (gradYearMin) params.set("gradYearMin", gradYearMin);
      if (gradYearMax) params.set("gradYearMax", gradYearMax);
      const hMin = toHeightIn(heightMinFt, heightMinIn);
      const hMax = toHeightIn(heightMaxFt, heightMaxIn);
      if (hMin) params.set("heightInMin", hMin);
      if (hMax) params.set("heightInMax", hMax);
      if (weightMin) params.set("weightLbMin", weightMin);
      if (weightMax) params.set("weightLbMax", weightMax);
      if (state) params.set("state", state);
      if (q) params.set("q", q);
      if (sort) params.set("sort", sort);

      const res = await apiFetch<{ results: PlayerProfile[] }>(`/player-profiles?${params.toString()}`, { token });
      setResults(res.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  async function addToWatchlist(playerUserId: string) {
    setError(null);
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Please login as a coach first.");
      await apiFetch(`/watchlists/${playerUserId}`, { method: "POST", token });
      setWatchlisted((p) => ({ ...p, [playerUserId]: true }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add to watchlist");
    }
  }

  async function removeFromWatchlist(playerUserId: string) {
    setError(null);
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Please login as a coach first.");
      await apiFetch(`/watchlists/${playerUserId}`, { method: "DELETE", token });
      setWatchlisted((p) => ({ ...p, [playerUserId]: false }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove from watchlist");
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <h2 className="text-lg font-semibold">Player search</h2>
        <p className="mt-1 text-sm text-white/80">
          Subscription enforcement is later. RBAC is enforced by the API.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          <div className="grid gap-2">
            <Label htmlFor="sport">Sport</Label>
            <select
              id="sport"
              className="w-full rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary-600)]"
              value={sport}
              onChange={(e) => {
                const next = e.target.value as Sport;
                setSport(next);
                setPositionChoice("");
                setPositionOther("");
              }}
            >
              <option value="">Any</option>
              <option value="football">Football</option>
              <option value="basketball">Basketball</option>
              <option value="volleyball">Volleyball</option>
              <option value="soccer">Soccer</option>
              <option value="track">Track</option>
              <option value="other">Other (enter manually)</option>
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="position">Position / Event</Label>
            {sport === "other" ? (
              <Input id="position" value={positionOther} onChange={(e) => setPositionOther(e.target.value)} placeholder="Other (enter manually)" />
            ) : (
              <select
                id="position"
                className="w-full rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary-600)]"
                value={positionChoice}
                onChange={(e) => {
                  setPositionChoice(e.target.value);
                  if (e.target.value !== "Other") setPositionOther("");
                }}
                disabled={!sport}
              >
                <option value="">{sport ? "Any" : "Select sport first"}</option>
                {sport
                  ? POSITIONS_BY_SPORT[sport as Exclude<Sport, "" | "other">].map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))
                  : null}
                {sport ? <option value="Other">Other (enter manually)</option> : null}
              </select>
            )}
            {sport && positionChoice === "Other" ? (
              <Input id="positionOther" value={positionOther} onChange={(e) => setPositionOther(e.target.value)} placeholder="Other (enter manually)" />
            ) : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="gradYearMin">Grad year (min)</Label>
            <Input id="gradYearMin" type="number" value={gradYearMin} onChange={(e) => setGradYearMin(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="gradYearMax">Grad year (max)</Label>
            <Input id="gradYearMax" type="number" value={gradYearMax} onChange={(e) => setGradYearMax(e.target.value)} />
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          <div className="grid gap-2">
            <Label htmlFor="heightMinFt">Height min</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input id="heightMinFt" type="number" placeholder="ft" value={heightMinFt} onChange={(e) => setHeightMinFt(e.target.value)} />
              <Input id="heightMinIn" type="number" placeholder="in" value={heightMinIn} onChange={(e) => setHeightMinIn(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="heightMaxFt">Height max</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input id="heightMaxFt" type="number" placeholder="ft" value={heightMaxFt} onChange={(e) => setHeightMaxFt(e.target.value)} />
              <Input id="heightMaxIn" type="number" placeholder="in" value={heightMaxIn} onChange={(e) => setHeightMaxIn(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="weightMin">Weight min (lb)</Label>
            <Input id="weightMin" type="number" value={weightMin} onChange={(e) => setWeightMin(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="weightMax">Weight max (lb)</Label>
            <Input id="weightMax" type="number" value={weightMax} onChange={(e) => setWeightMax(e.target.value)} />
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="state">State</Label>
            <Input id="state" value={state} onChange={(e) => setState(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="q">Name</Label>
            <Input id="q" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sort">Sort</Label>
            <select
              id="sort"
              className="w-full rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary-600)]"
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
            >
              <option value="updated_desc">Recently updated</option>
              <option value="lastName_asc">Last name (A–Z)</option>
              <option value="gradYear_asc">Grad year (low→high)</option>
              <option value="gradYear_desc">Grad year (high→low)</option>
            </select>
          </div>
        </div>

        <div className="mt-4">
          <Button type="button" onClick={search} disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </Button>
        </div>

        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
      </Card>

      <div className="grid gap-3">
        {results.map((p) => (
          <div key={p._id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="text-base font-semibold">
                <a className="text-indigo-300 hover:text-indigo-200 hover:underline" href={`/coach/player/${p.userId}`}>
                  {p.firstName} {p.lastName}
                </a>
              </div>
              <div className="text-sm text-white/80">
                {(p.sport ? `${p.sport} · ` : "") + `${p.position} · ${p.gradYear} · ${p.city}, ${p.state}`}
                {typeof p.heightIn === "number" ? ` · ${p.heightIn} in` : ""}
                {typeof p.weightLb === "number" ? ` · ${p.weightLb} lb` : ""}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {watchlisted[p.userId] ? (
                <Button type="button" className="border border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={() => removeFromWatchlist(p.userId)}>
                  Remove from watchlist
                </Button>
              ) : (
                <Button type="button" onClick={() => addToWatchlist(p.userId)}>
                  Add to watchlist
                </Button>
              )}
            </div>
          </div>
        ))}
        {results.length === 0 ? <p className="text-sm text-white/70">No results yet.</p> : null}
      </div>
    </div>
  );
}



