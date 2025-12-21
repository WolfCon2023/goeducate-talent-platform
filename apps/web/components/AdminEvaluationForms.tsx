"use client";

import { useEffect, useMemo, useState } from "react";

import { Button, Card, Input, Label } from "@/components/ui";
import { useConfirm } from "@/components/ConfirmDialog";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";

type Sport = "football" | "basketball" | "volleyball" | "soccer" | "track" | "other";
type CategoryKey = "physical" | "athletic" | "technical" | "mental" | "intangibles";

type TraitDef = {
  key: string;
  label: string;
  type: "slider" | "select";
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ value: string; label: string; score?: number }>;
};

type CategoryDef = {
  key: CategoryKey;
  label: string;
  weight: number;
  traits: TraitDef[];
};

type FormDef = {
  _id: string;
  title: string;
  sport: Sport;
  isActive: boolean;
  version: number;
  strengthsPrompt: string;
  improvementsPrompt: string;
  notesHelp?: string;
  categories: CategoryDef[];
  updatedAt?: string;
};

function defaultBuilderForm(sport: Sport): Omit<FormDef, "_id"> {
  const categories: CategoryDef[] = [
    { key: "physical", label: "Physical", weight: 20, traits: [] },
    { key: "athletic", label: "Athletic", weight: 20, traits: [] },
    { key: "technical", label: "Technical", weight: 25, traits: [] },
    { key: "mental", label: "Mental", weight: 20, traits: [] },
    { key: "intangibles", label: "Intangibles", weight: 15, traits: [] }
  ];

  // Minimal starter traits (admins can customize)
  const starter: Record<CategoryKey, TraitDef[]> = {
    physical: [
      { key: "size_frame", label: "Size / frame", type: "slider" },
      { key: "strength", label: "Functional strength", type: "slider" }
    ],
    athletic: [
      { key: "speed", label: "Speed", type: "slider" },
      { key: "agility", label: "Agility / change of direction", type: "slider" }
    ],
    technical: [
      { key: "technique", label: "Technique fundamentals", type: "slider" },
      { key: "consistency", label: "Consistency (rep-to-rep)", type: "slider" }
    ],
    mental: [
      { key: "processing", label: "Processing / speed of play", type: "slider" },
      { key: "decision_making", label: "Decision-making", type: "slider" }
    ],
    intangibles: [
      { key: "motor", label: "Motor / effort", type: "slider" },
      {
        key: "projection",
        label: "Projection",
        type: "slider",
        required: false,
        min: 1,
        max: 10,
        step: 1
      }
    ]
  };

  for (const c of categories) c.traits = starter[c.key];

  return {
    title: `Evaluation form – ${sport}`,
    sport,
    isActive: true,
    version: 1,
    strengthsPrompt:
      "Provide 2–4 strengths with specific evidence (what you saw and where). Use bullet points.\n- Strength 1 (evidence)\n- Strength 2 (evidence)",
    improvementsPrompt:
      "Provide 2–4 improvements with actionable coaching points. Use bullet points.\n- Improvement 1 (how to improve)\n- Improvement 2 (how to improve)",
    notesHelp: "Optional: leave any additional context, caveats, or timecodes.",
    categories
  };
}

export function AdminEvaluationForms() {
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<FormDef[]>([]);

  const [filterSport, setFilterSport] = useState<string>("");
  const [activeOnly, setActiveOnly] = useState(true);

  const [builderSport, setBuilderSport] = useState<Sport>("football");
  const [builder, setBuilder] = useState<Omit<FormDef, "_id">>(() => defaultBuilderForm("football"));

  const weightSum = useMemo(() => builder.categories.reduce((a, c) => a + (Number(c.weight) || 0), 0), [builder.categories]);
  const canCreate = useMemo(() => builder.title.trim() && builder.sport && builder.categories.length === 5, [builder]);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "admin") throw new Error("Insufficient permissions.");

      const params = new URLSearchParams();
      if (filterSport) params.set("sport", filterSport);
      if (activeOnly) params.set("activeOnly", "1");

      const res = await apiFetch<{ results: FormDef[] }>(`/admin/evaluation-forms?${params.toString()}`, { token });
      setResults(res.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load evaluation forms");
    } finally {
      setLoading(false);
    }
  }

  async function create() {
    setError(null);
    setSaving(true);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "admin") throw new Error("Insufficient permissions.");

      const created = await apiFetch<FormDef>("/admin/evaluation-forms", {
        method: "POST",
        token,
        body: JSON.stringify(builder)
      });
      setResults((prev) => [created, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create evaluation form");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const ok = await confirm({
      title: "Delete evaluation form?",
      message: "This cannot be undone.",
      confirmText: "Delete",
      destructive: true
    });
    if (!ok) return;

    setError(null);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "admin") throw new Error("Insufficient permissions.");

      await apiFetch(`/admin/evaluation-forms/${encodeURIComponent(id)}`, { method: "DELETE", token });
      setResults((prev) => prev.filter((f) => f._id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete evaluation form");
    }
  }

  function updateCategory(key: CategoryKey, patch: Partial<CategoryDef>) {
    setBuilder((prev) => ({
      ...prev,
      categories: prev.categories.map((c) => (c.key === key ? { ...c, ...patch } : c))
    }));
  }

  function addTrait(catKey: CategoryKey) {
    updateCategory(catKey, {
      traits: [
        ...builder.categories.find((c) => c.key === catKey)!.traits,
        { key: `${catKey}_trait_${Date.now()}`, label: "New trait", type: "slider", min: 1, max: 10, step: 1 }
      ]
    });
  }

  function updateTrait(catKey: CategoryKey, traitKey: string, patch: Partial<TraitDef>) {
    updateCategory(catKey, {
      traits: builder.categories
        .find((c) => c.key === catKey)!
        .traits.map((t) => (t.key === traitKey ? { ...t, ...patch } : t))
    });
  }

  function removeTrait(catKey: CategoryKey, traitKey: string) {
    updateCategory(catKey, {
      traits: builder.categories.find((c) => c.key === catKey)!.traits.filter((t) => t.key !== traitKey)
    });
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Evaluation forms (universal rubric)</h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">One active form per sport. Evaluators use it to produce consistent reports.</p>
        </div>
        <Button type="button" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

      <div className="mt-6 rounded-2xl border border-[color:var(--border)] bg-[var(--surface-soft)] p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="text-sm font-semibold text-[color:var(--foreground)]">Create new form</div>
          <div className="text-xs text-[color:var(--muted)]">Weights sum: {weightSum}% (recommended: 100%)</div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="formTitle">Title</Label>
            <Input id="formTitle" value={builder.title} onChange={(e) => setBuilder((p) => ({ ...p, title: e.target.value }))} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="formSport">Sport</Label>
            <select
              id="formSport"
              className="w-full rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary-600)]"
              value={builderSport}
              onChange={(e) => {
                const s = e.target.value as Sport;
                setBuilderSport(s);
                setBuilder(defaultBuilderForm(s));
              }}
            >
              <option value="football">Football</option>
              <option value="basketball">Basketball</option>
              <option value="volleyball">Volleyball</option>
              <option value="soccer">Soccer</option>
              <option value="track">Track</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="formActive">Active</Label>
            <select
              id="formActive"
              className="w-full rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary-600)]"
              value={builder.isActive ? "1" : "0"}
              onChange={(e) => setBuilder((p) => ({ ...p, isActive: e.target.value === "1" }))}
            >
              <option value="1">Active (recommended)</option>
              <option value="0">Inactive</option>
            </select>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="strengthsPrompt">Strengths prompt</Label>
            <textarea
              id="strengthsPrompt"
              className="min-h-24 w-full rounded-md border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary-600)]"
              value={builder.strengthsPrompt}
              onChange={(e) => setBuilder((p) => ({ ...p, strengthsPrompt: e.target.value }))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="improvementsPrompt">Improvements prompt</Label>
            <textarea
              id="improvementsPrompt"
              className="min-h-24 w-full rounded-md border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary-600)]"
              value={builder.improvementsPrompt}
              onChange={(e) => setBuilder((p) => ({ ...p, improvementsPrompt: e.target.value }))}
            />
          </div>
        </div>

        <div className="mt-4 grid gap-4">
          {builder.categories.map((c) => (
            <div key={c.key} className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div className="font-semibold text-[color:var(--foreground)]">{c.label}</div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-[color:var(--muted)]">Weight</span>
                  <Input
                    className="max-w-24"
                    value={String(c.weight)}
                    type="number"
                    onChange={(e) => updateCategory(c.key, { weight: Number(e.target.value) })}
                  />
                  <Button type="button" className="border border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={() => addTrait(c.key)}>
                    Add trait
                  </Button>
                </div>
              </div>

              <div className="mt-3 grid gap-3">
                {c.traits.map((t) => (
                  <div key={t.key} className="rounded-xl border border-[color:var(--border)] bg-[var(--surface-soft)] p-3">
                    <div className="grid gap-3 lg:grid-cols-5">
                      <div className="grid gap-2 lg:col-span-1">
                        <Label htmlFor={`${c.key}-${t.key}-key`}>Key</Label>
                        <Input
                          id={`${c.key}-${t.key}-key`}
                          value={t.key}
                          onChange={(e) => updateTrait(c.key, t.key, { key: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2 lg:col-span-2">
                        <Label htmlFor={`${c.key}-${t.key}-label`}>Label</Label>
                        <Input
                          id={`${c.key}-${t.key}-label`}
                          value={t.label}
                          onChange={(e) => updateTrait(c.key, t.key, { label: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2 lg:col-span-1">
                        <Label htmlFor={`${c.key}-${t.key}-type`}>Type</Label>
                        <select
                          id={`${c.key}-${t.key}-type`}
                          className="w-full rounded-md border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary-600)]"
                          value={t.type}
                          onChange={(e) => updateTrait(c.key, t.key, { type: e.target.value as any })}
                        >
                          <option value="slider">Slider (1–10)</option>
                          <option value="select">Dropdown</option>
                        </select>
                      </div>
                      <div className="flex items-end justify-end lg:col-span-1">
                        <Button
                          type="button"
                          className="border border-white/15 bg-white/5 text-white hover:bg-white/10"
                          onClick={() => removeTrait(c.key, t.key)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>

                    {t.type === "select" ? (
                      <div className="mt-3 grid gap-2">
                        <Label htmlFor={`${c.key}-${t.key}-options`}>Options (comma-separated &quot;value:label:score&quot;)</Label>
                        <Input
                          id={`${c.key}-${t.key}-options`}
                          value={(t.options ?? [])
                            .map((o) => `${o.value}:${o.label}:${typeof o.score === "number" ? o.score : ""}`)
                            .join(",")}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const options = raw
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean)
                              .map((s) => {
                                const [value, label, score] = s.split(":");
                                return {
                                  value: (value ?? "").trim(),
                                  label: (label ?? value ?? "").trim(),
                                  score: score ? Number(score) : undefined
                                };
                              })
                              .filter((o) => o.value && o.label);
                            updateTrait(c.key, t.key, { options });
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                ))}
                {c.traits.length === 0 ? <div className="text-sm text-[color:var(--muted)]">No traits yet.</div> : null}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <Button type="button" onClick={create} disabled={saving || !canCreate}>
            {saving ? "Creating..." : "Create evaluation form"}
          </Button>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-[color:var(--border)] bg-[var(--surface-soft)] p-4">
        <div className="text-sm font-semibold text-[color:var(--foreground)]">Existing forms</div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="filterSport">Sport</Label>
            <Input id="filterSport" value={filterSport} onChange={(e) => setFilterSport(e.target.value)} placeholder="e.g. football" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="activeOnly">Active only</Label>
            <select
              id="activeOnly"
              className="w-full rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary-600)]"
              value={activeOnly ? "1" : "0"}
              onChange={(e) => setActiveOnly(e.target.value === "1")}
            >
              <option value="1">Yes</option>
              <option value="0">No</option>
            </select>
          </div>
        </div>
        <div className="mt-4">
          <Button type="button" onClick={load} disabled={loading}>
            {loading ? "Loading..." : "Apply filters"}
          </Button>
        </div>

        <div className="mt-5 grid gap-3">
          {results.map((f) => (
            <div key={f._id} className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-[color:var(--foreground)]">{f.title}</div>
                  <div className="mt-1 text-sm text-[color:var(--muted)]">
                    sport: <span className="text-[color:var(--foreground)]">{f.sport}</span> · version: {f.version} ·{" "}
                    {f.isActive ? <span className="text-emerald-300">active</span> : <span>inactive</span>}
                    {f.updatedAt ? ` · updated ${new Date(f.updatedAt).toLocaleString()}` : ""}
                  </div>
                </div>
                <Button type="button" className="border border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={() => remove(f._id)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
          {results.length === 0 ? <p className="text-sm text-[color:var(--muted)]">No forms found.</p> : null}
        </div>
      </div>
    </Card>
  );
}


