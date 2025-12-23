"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";
import { Card, RefreshIconButton } from "@/components/ui";

import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import usTopo from "us-atlas/states-10m.json";

type PlayerByState = { code: string; name: string; count: number };
type PlayerByStateResponse = { byState: PlayerByState[]; unknownCount: number };

type PlayerRow = {
  userId: string;
  firstName: string;
  lastName: string;
  sport?: string | null;
  position?: string | null;
  city?: string | null;
  state?: string | null;
  latestOverallGrade?: number | null;
  user?: { id?: string; email?: string | null } | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
};

type PlayersInStateResponse = {
  state: { code: string; name: string };
  total: number;
  players: PlayerRow[];
};

type Tooltip = { x: number; y: number; text: string } | null;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function colorForCount(count: number, max: number) {
  if (!max || max <= 0 || count <= 0) return "rgba(255,255,255,0.06)";
  const t = clamp(count / max, 0, 1);
  // Indigo base (#4f46e5) with alpha scale.
  const alpha = 0.18 + t * 0.72;
  return `rgba(79,70,229,${alpha.toFixed(3)})`;
}

const US_STATE_NAME_TO_CODE: Record<string, string> = {
  Alabama: "AL",
  Alaska: "AK",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  Delaware: "DE",
  "District of Columbia": "DC",
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
  Wyoming: "WY"
};

export function AdminPlayerMap() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PlayerByStateResponse | null>(null);
  const [selected, setSelected] = useState<PlayerByState | null>(null);
  const [tooltip, setTooltip] = useState<Tooltip>(null);

  const [playersLoading, setPlayersLoading] = useState(false);
  const [playersError, setPlayersError] = useState<string | null>(null);
  const [playersData, setPlayersData] = useState<PlayersInStateResponse | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const playersAbortRef = useRef<AbortController | null>(null);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "admin") throw new Error("Insufficient permissions.");
      const res = await apiFetch<PlayerByStateResponse>("/admin/players/by-state", { token });
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load player locations");
    } finally {
      setLoading(false);
    }
  }

  async function loadPlayersFor(s: PlayerByState | null) {
    setPlayersError(null);
    setPlayersData(null);
    playersAbortRef.current?.abort();

    if (!s) return;

    const maybeCode = String(s.code ?? "").trim();
    const code = maybeCode || US_STATE_NAME_TO_CODE[String(s.name ?? "").trim()] || "";
    if (!code) {
      setPlayersError("Missing state code for selected state.");
      return;
    }

    setPlayersLoading(true);
    const controller = new AbortController();
    playersAbortRef.current = controller;
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "admin") throw new Error("Insufficient permissions.");

      const res = await apiFetch<PlayersInStateResponse>(`/admin/players/by-state/${encodeURIComponent(code)}?limit=500`, {
        token,
        signal: controller.signal
      });
      setPlayersData(res);
    } catch (err) {
      if (err instanceof Error && /aborted/i.test(err.message)) return;
      setPlayersError(err instanceof Error ? err.message : "Failed to load players for state");
    } finally {
      setPlayersLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    void loadPlayersFor(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.code, selected?.name]);

  const byName = useMemo(() => {
    const m = new Map<string, PlayerByState>();
    for (const s of data?.byState ?? []) m.set(s.name, s);
    return m;
  }, [data]);

  const max = useMemo(() => Math.max(0, ...(data?.byState ?? []).map((x) => x.count)), [data]);
  const totalKnown = useMemo(() => (data?.byState ?? []).reduce((a, b) => a + b.count, 0), [data]);

  const states = useMemo(() => {
    const topo: any = usTopo as any;
    const fc = feature(topo, topo.objects.states) as any;
    return fc.features as Array<any>;
  }, []);

  const svg = useMemo(() => {
    const width = 975;
    const height = 610;
    const projection = geoAlbersUsa();
    // Fit projection to the states features.
    projection.fitSize([width, height], { type: "FeatureCollection", features: states } as any);
    const path = geoPath(projection);

    return { width, height, path };
  }, [states]);

  function onMove(e: React.MouseEvent, text: string) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({ x: e.clientX - rect.left + 12, y: e.clientY - rect.top + 12, text });
  }

  function onLeave() {
    setTooltip(null);
  }

  const topStates = (data?.byState ?? []).slice(0, 8);

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Player map</h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">Where players are located across the U.S. (by state).</p>
        </div>
        <RefreshIconButton onClick={load} loading={loading} />
      </div>

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div
          ref={containerRef}
          className="relative overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[var(--surface-soft)] p-3"
          onMouseLeave={onLeave}
        >
          <svg viewBox={`0 0 ${svg.width} ${svg.height}`} className="h-auto w-full">
            <g>
              {states.map((f) => {
                const name = String(f.properties?.name ?? "");
                const entry = byName.get(name);
                const count = entry?.count ?? 0;
                const fill = colorForCount(count, max);
                const isSelected = selected?.name === name;
                return (
                  <path
                    key={String(f.id ?? name)}
                    d={svg.path(f) ?? ""}
                    fill={fill}
                    stroke="rgba(255,255,255,0.18)"
                    strokeWidth={isSelected ? 1.5 : 0.75}
                    className="cursor-pointer transition-opacity hover:opacity-95"
                    onMouseMove={(e) => onMove(e, `${name}: ${count}`)}
                    onClick={() => setSelected(entry ?? { code: "", name, count })}
                  />
                );
              })}
            </g>
          </svg>

          {tooltip ? (
            <div
              className="pointer-events-none absolute z-10 rounded-lg border border-white/10 bg-black/80 px-2 py-1 text-xs text-white shadow"
              style={{ left: tooltip.x, top: tooltip.y }}
            >
              {tooltip.text}
            </div>
          ) : null}
        </div>

        <div className="grid gap-4">
          <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] p-4">
            <div className="text-xs uppercase tracking-wide text-[color:var(--muted-2)]">Coverage</div>
            <div className="mt-2 text-sm text-[color:var(--muted)]">
              Known state: <span className="text-[color:var(--foreground)] font-semibold">{totalKnown}</span>
              {typeof data?.unknownCount === "number" ? (
                <>
                  {" "}
                  · Unknown/invalid: <span className="text-[color:var(--foreground)] font-semibold">{data.unknownCount}</span>
                </>
              ) : null}
            </div>
            <div className="mt-3 text-xs text-[color:var(--muted-2)]">
              Darker indigo = more players in that state.
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/5">
              <div className="h-full w-full bg-gradient-to-r from-white/5 via-[rgba(79,70,229,0.55)] to-[rgba(79,70,229,0.95)]" />
            </div>
          </div>

          <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] p-4">
            <div className="text-sm font-semibold text-[color:var(--foreground)]">Top states</div>
            <div className="mt-3 grid gap-1 text-sm text-[color:var(--muted)]">
              {topStates.map((s) => (
                <button
                  key={s.code}
                  type="button"
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-1 text-left hover:bg-white/5"
                  onClick={() => setSelected(s)}
                >
                  <div className="text-[color:var(--foreground)]">{s.name}</div>
                  <div>{s.count}</div>
                </button>
              ))}
              {topStates.length === 0 ? <div>—</div> : null}
            </div>
          </div>

          <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] p-4">
            <div className="text-sm font-semibold text-[color:var(--foreground)]">Selected</div>
            <div className="mt-2 text-sm text-[color:var(--muted)]">
              {selected ? (
                <>
                  <div className="text-[color:var(--foreground)] font-semibold">{selected.name}</div>
                  <div className="mt-1">Players: {selected.count}</div>
                </>
              ) : (
                <div>Click a state to pin details.</div>
              )}
            </div>

            {selected ? (
              <div className="mt-4">
                <div className="text-xs uppercase tracking-wide text-[color:var(--muted-2)]">
                  Registered players in state
                </div>

                {playersLoading ? (
                  <div className="mt-2 text-sm text-[color:var(--muted)]">Loading…</div>
                ) : null}
                {playersError ? <div className="mt-2 text-sm text-red-300">{playersError}</div> : null}

                {playersData ? (
                  <div className="mt-3">
                    <div className="mb-2 text-xs text-[color:var(--muted-2)]">
                      Showing {playersData.players.length} of {playersData.total}
                    </div>
                    <div className="max-h-[360px] overflow-auto rounded-xl border border-white/10">
                      <table className="w-full text-left text-sm">
                        <thead className="sticky top-0 bg-[var(--surface)] text-xs uppercase tracking-wide text-[color:var(--muted-2)]">
                          <tr>
                            <th className="px-3 py-2">Name</th>
                            <th className="px-3 py-2">Sport</th>
                            <th className="px-3 py-2">Position</th>
                            <th className="px-3 py-2">Rating</th>
                            <th className="px-3 py-2">Contact</th>
                          </tr>
                        </thead>
                        <tbody>
                          {playersData.players.map((p) => {
                            const name = `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || "—";
                            const rating =
                              typeof p.latestOverallGrade === "number" && Number.isFinite(p.latestOverallGrade)
                                ? p.latestOverallGrade
                                : null;
                            const email = p.user?.email ?? null;
                            const contactEmail = p.contactEmail ?? null;
                            const contactPhone = p.contactPhone ?? null;
                            return (
                              <tr key={p.userId} className="border-t border-white/10">
                                <td className="px-3 py-2 text-[color:var(--foreground)]">{name}</td>
                                <td className="px-3 py-2">{p.sport || "—"}</td>
                                <td className="px-3 py-2">{p.position || "—"}</td>
                                <td className="px-3 py-2">{rating ?? "—"}</td>
                                <td className="px-3 py-2">
                                  <div className="grid gap-1">
                                    {email ? (
                                      <a className="text-indigo-300 hover:underline" href={`mailto:${email}`}>
                                        {email}
                                      </a>
                                    ) : (
                                      <span>—</span>
                                    )}
                                    {contactEmail && contactEmail !== email ? (
                                      <a className="text-indigo-300 hover:underline" href={`mailto:${contactEmail}`}>
                                        {contactEmail}
                                      </a>
                                    ) : null}
                                    {contactPhone ? (
                                      <a className="text-indigo-300 hover:underline" href={`tel:${contactPhone}`}>
                                        {contactPhone}
                                      </a>
                                    ) : null}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                          {playersData.players.length === 0 ? (
                            <tr>
                              <td className="px-3 py-3 text-[color:var(--muted)]" colSpan={5}>
                                No players found.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
}


