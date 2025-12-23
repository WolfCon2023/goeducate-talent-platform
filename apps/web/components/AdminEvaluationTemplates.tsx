"use client";

import { useEffect, useMemo, useState } from "react";

import { Button, Card, Input, Label } from "@/components/ui";
import { useConfirm } from "@/components/ConfirmDialog";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";

type Template = {
  _id: string;
  title: string;
  sport: string;
  position: string;
  strengthsTemplate: string;
  improvementsTemplate: string;
  notesTemplate?: string;
  isActive?: boolean;
  updatedAt?: string;
};

const SPORTS = [
  { value: "any", label: "Any sport" },
  { value: "football", label: "Football" },
  { value: "basketball", label: "Basketball" },
  { value: "volleyball", label: "Volleyball" },
  { value: "soccer", label: "Soccer" },
  { value: "track", label: "Track" },
  { value: "other", label: "Other" }
] as const;

export function AdminEvaluationTemplates() {
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Template[]>([]);

  const [filterSport, setFilterSport] = useState("");
  const [filterPosition, setFilterPosition] = useState("");
  const [filterQ, setFilterQ] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);

  const [title, setTitle] = useState("");
  const [sport, setSport] = useState<string>("football");
  const [position, setPosition] = useState<string>("any");
  const [strengthsTemplate, setStrengthsTemplate] = useState("");
  const [improvementsTemplate, setImprovementsTemplate] = useState("");
  const [notesTemplate, setNotesTemplate] = useState("");

  const canCreate = useMemo(
    () => title.trim() && sport.trim() && position.trim() && strengthsTemplate.trim() && improvementsTemplate.trim(),
    [title, sport, position, strengthsTemplate, improvementsTemplate]
  );

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
      if (filterPosition) params.set("position", filterPosition);
      if (filterQ) params.set("q", filterQ);
      if (activeOnly) params.set("activeOnly", "1");

      const res = await apiFetch<{ results: Template[] }>(`/admin/evaluation-templates?${params.toString()}`, { token });
      setResults(res.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
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

      const created = await apiFetch<Template>("/admin/evaluation-templates", {
        method: "POST",
        token,
        body: JSON.stringify({
          title,
          sport,
          position,
          strengthsTemplate,
          improvementsTemplate,
          notesTemplate: notesTemplate.trim() ? notesTemplate : undefined,
          isActive: true
        })
      });

      setTitle("");
      setSport("football");
      setPosition("any");
      setStrengthsTemplate("");
      setImprovementsTemplate("");
      setNotesTemplate("");

      // Put the newest at top immediately.
      setResults((prev) => [created, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create template");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const ok = await confirm({
      title: "Delete template?",
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

      await apiFetch(`/admin/evaluation-templates/${encodeURIComponent(id)}`, { method: "DELETE", token });
      setResults((prev) => prev.filter((t) => t._id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete template");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Evaluation templates</h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Templates are used by evaluators to prefill strengths/improvements notes. Use <span className="font-semibold">sport=any</span> or{" "}
            <span className="font-semibold">position=any</span> as a fallback.
          </p>
        </div>
        <Button type="button" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

      <div className="mt-6 rounded-2xl border border-[color:var(--border)] bg-[var(--surface-soft)] p-4">
        <div className="text-sm font-semibold text-[color:var(--foreground)]">Create template</div>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="tplTitle">Title</Label>
            <Input id="tplTitle" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Football QB – Core rubric" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tplSport">Sport</Label>
            <select
              id="tplSport"
              className="w-full rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary-600)]"
              value={sport}
              onChange={(e) => setSport(e.target.value)}
            >
              {SPORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tplPosition">Position/Event</Label>
            <Input id="tplPosition" value={position} onChange={(e) => setPosition(e.target.value)} placeholder='Use "any" for wildcard' />
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="grid gap-2 lg:col-span-1">
            <Label htmlFor="tplStrengths">Strengths template</Label>
            <textarea
              id="tplStrengths"
              className="min-h-40 w-full rounded-md border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary-600)]"
              value={strengthsTemplate}
              onChange={(e) => setStrengthsTemplate(e.target.value)}
              placeholder="- Athleticism:\n- Technique:\n- Competitiveness:"
            />
          </div>
          <div className="grid gap-2 lg:col-span-1">
            <Label htmlFor="tplImprovements">Improvements template</Label>
            <textarea
              id="tplImprovements"
              className="min-h-40 w-full rounded-md border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary-600)]"
              value={improvementsTemplate}
              onChange={(e) => setImprovementsTemplate(e.target.value)}
              placeholder="- Footwork:\n- Consistency:\n- Film study:"
            />
          </div>
          <div className="grid gap-2 lg:col-span-1">
            <Label htmlFor="tplNotes">Notes template (optional)</Label>
            <textarea
              id="tplNotes"
              className="min-h-40 w-full rounded-md border border-[color:var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary-600)]"
              value={notesTemplate}
              onChange={(e) => setNotesTemplate(e.target.value)}
              placeholder="Sport: {sport}\nPosition: {position}\n(You can include canned structure here.)"
            />
          </div>
        </div>

        <div className="mt-4">
          <Button type="button" onClick={create} disabled={saving || !canCreate}>
            {saving ? "Creating..." : "Create template"}
          </Button>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-[color:var(--border)] bg-[var(--surface-soft)] p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-[color:var(--foreground)]">Templates</div>
            <p className="mt-1 text-sm text-[color:var(--muted)]">Up to 200 most recently updated.</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-4">
          <div className="grid gap-2">
            <Label htmlFor="tplFilterSport">Sport</Label>
            <Input id="tplFilterSport" value={filterSport} onChange={(e) => setFilterSport(e.target.value)} placeholder="e.g. football / any" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tplFilterPosition">Position</Label>
            <Input id="tplFilterPosition" value={filterPosition} onChange={(e) => setFilterPosition(e.target.value)} placeholder='e.g. Quarterback (QB) / any' />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tplFilterQ">Search</Label>
            <Input id="tplFilterQ" value={filterQ} onChange={(e) => setFilterQ(e.target.value)} placeholder="Title contains…" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tplActiveOnly">Active only</Label>
            <select
              id="tplActiveOnly"
              className="w-full rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary-600)]"
              value={activeOnly ? "1" : "0"}
              onChange={(e) => setActiveOnly(e.target.value === "1")}
            >
              <option value="1">Yes</option>
              <option value="0">No (include inactive)</option>
            </select>
          </div>
        </div>

        <div className="mt-4">
          <Button type="button" onClick={load} disabled={loading}>
            {loading ? "Searching..." : "Apply filters"}
          </Button>
        </div>

        <div className="mt-5 grid gap-3">
          {results.map((t) => (
            <div key={t._id} className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-[color:var(--foreground)]">{t.title}</div>
                  <div className="mt-1 text-sm text-[color:var(--muted)]">
                    sport: <span className="text-[color:var(--foreground)]">{t.sport}</span> · position:{" "}
                    <span className="text-[color:var(--foreground)]">{t.position}</span>
                    {t.isActive === false ? <span className="ml-2 text-red-300">inactive</span> : null}
                  </div>
                </div>
                <Button
                  type="button"
                  className="border border-white/15 bg-white/5 text-white hover:bg-white/10"
                  onClick={() => remove(t._id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
          {results.length === 0 ? <p className="text-sm text-[color:var(--muted)]">No templates yet.</p> : null}
        </div>
      </div>
    </Card>
  );
}


