"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";
import { Card, Button } from "@/components/ui";

import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import usTopo from "us-atlas/states-10m.json";

type PlayerByState = { code: string; name: string; count: number };
type PlayerByStateResponse = { byState: PlayerByState[]; unknownCount: number };

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

export function AdminPlayerMap() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PlayerByStateResponse | null>(null);
  const [selected, setSelected] = useState<PlayerByState | null>(null);
  const [tooltip, setTooltip] = useState<Tooltip>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    void load();
  }, []);

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
        <Button type="button" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
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
          </div>
        </div>
      </div>
    </Card>
  );
}


