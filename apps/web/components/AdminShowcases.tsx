"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button, Card, Input, Label } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";
import { FormErrorSummary, FieldError } from "@/components/FormErrors";
import { parseApiError, type FieldErrors } from "@/lib/formErrors";

type ShowcaseRow = {
  id: string;
  slug: string;
  title: string;
  startDateTime: string | null;
  endDateTime: string | null;
  city: string;
  state: string;
  locationName: string;
  costCents: number;
  currency: string;
  capacity?: number;
  spotsRemaining?: number;
  registrationOpen: boolean;
  status?: "draft" | "published" | "archived";
  stripePriceId?: string;
  sportCategories: string[];
};

const SPORTS = ["basketball", "football", "volleyball", "baseball", "soccer", "other"] as const;
const STATUSES = ["draft", "published", "archived"] as const;

function slugify(title: string) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function isoToLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(v: string) {
  if (!v) return undefined;
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) return undefined;
  return d.toISOString();
}

function fmtMoney(cents: number, currency: string) {
  const amount = (cents ?? 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: (currency || "usd").toUpperCase() }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export function AdminShowcases() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ShowcaseRow[]>([]);

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sportFilter, setSportFilter] = useState<string>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [editing, setEditing] = useState<ShowcaseRow | null>(null);
  const [mode, setMode] = useState<"create" | "edit">("create");

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [refundPolicy, setRefundPolicy] = useState("Refund policy: refunds are subject to GoEducate policies (MVP placeholder).");
  const [sports, setSports] = useState<string[]>(["football"]);
  const [startDateTime, setStartDateTime] = useState("");
  const [endDateTime, setEndDateTime] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [locationName, setLocationName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [costUsd, setCostUsd] = useState("0");
  const [capacity, setCapacity] = useState<string>("");
  const [spotsRemaining, setSpotsRemaining] = useState<string>("");
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [registrationOpenAt, setRegistrationOpenAt] = useState("");
  const [registrationCloseAt, setRegistrationCloseAt] = useState("");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("draft");
  const [stripePriceId, setStripePriceId] = useState("");

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors | undefined>(undefined);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (statusFilter) p.set("status", statusFilter);
    if (sportFilter) p.set("sport", sportFilter);
    if (from) p.set("from", new Date(from).toISOString());
    if (to) p.set("to", new Date(to).toISOString());
    return p.toString();
  }, [statusFilter, sportFilter, from, to]);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "admin") throw new Error("Insufficient permissions.");
      const res = await apiFetch<{ results: ShowcaseRow[] }>(`/admin/showcases?${query}`, { token });
      setResults(res.results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load showcases");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function resetForm() {
    setEditing(null);
    setMode("create");
    setTitle("");
    setSlug("");
    setDescription("");
    setRefundPolicy("Refund policy: refunds are subject to GoEducate policies (MVP placeholder).");
    setSports(["football"]);
    setStartDateTime("");
    setEndDateTime("");
    setTimezone("America/New_York");
    setLocationName("");
    setAddressLine1("");
    setAddressLine2("");
    setCity("");
    setState("");
    setZip("");
    setCostUsd("0");
    setCapacity("");
    setSpotsRemaining("");
    setRegistrationOpen(false);
    setRegistrationOpenAt("");
    setRegistrationCloseAt("");
    setStatus("draft");
    setStripePriceId("");
    setFormError(null);
    setFieldErrors(undefined);
  }

  function beginEdit(row: ShowcaseRow) {
    setMode("edit");
    setEditing(row);
    setTitle(row.title ?? "");
    setSlug(row.slug ?? "");
    setDescription((row as any).description ?? "");
    setRefundPolicy((row as any).refundPolicy ?? "Refund policy: refunds are subject to GoEducate policies (MVP placeholder).");
    setSports(row.sportCategories?.length ? row.sportCategories : ["football"]);
    setStartDateTime(isoToLocalInput(row.startDateTime));
    setEndDateTime(isoToLocalInput(row.endDateTime));
    setTimezone((row as any).timezone ?? "America/New_York");
    setLocationName(row.locationName ?? "");
    setAddressLine1((row as any).addressLine1 ?? "");
    setAddressLine2((row as any).addressLine2 ?? "");
    setCity(row.city ?? "");
    setState(row.state ?? "");
    setZip((row as any).zip ?? "");
    setCostUsd(String(((row.costCents ?? 0) / 100).toFixed(2)));
    setCapacity(typeof row.capacity === "number" ? String(row.capacity) : "");
    setSpotsRemaining(typeof row.spotsRemaining === "number" ? String(row.spotsRemaining) : "");
    setRegistrationOpen(Boolean((row as any).registrationOpen));
    setRegistrationOpenAt(isoToLocalInput((row as any).registrationOpenAt));
    setRegistrationCloseAt(isoToLocalInput((row as any).registrationCloseAt));
    setStatus(((row as any).status ?? "draft") as any);
    setStripePriceId(row.stripePriceId ?? "");
    setFormError(null);
    setFieldErrors(undefined);
  }

  async function save() {
    setFormError(null);
    setFieldErrors(undefined);
    setSaving(true);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "admin") throw new Error("Insufficient permissions.");

      const fe: FieldErrors = {};
      if (!title.trim()) fe.title = ["Title is required."];
      if (!slug.trim()) fe.slug = ["Slug is required."];
      if (!startDateTime) fe.startDateTime = ["Start date/time is required."];
      if (!endDateTime) fe.endDateTime = ["End date/time is required."];
      if (!locationName.trim()) fe.locationName = ["Venue is required."];
      if (!addressLine1.trim()) fe.addressLine1 = ["Address line 1 is required."];
      if (!city.trim()) fe.city = ["City is required."];
      if (!state.trim()) fe.state = ["State is required."];
      if (!sports.length) fe.sportCategories = ["Select at least one sport."];
      if (Object.keys(fe).length > 0) {
        setFieldErrors(fe);
        return;
      }

      const costCents = Math.round(Number(costUsd || "0") * 100);
      const payload: any = {
        title: title.trim(),
        slug: slug.trim(),
        description,
        refundPolicy,
        sportCategories: sports,
        startDateTime: localInputToIso(startDateTime),
        endDateTime: localInputToIso(endDateTime),
        timezone: timezone.trim() || "America/New_York",
        locationName: locationName.trim(),
        addressLine1: addressLine1.trim(),
        addressLine2: addressLine2.trim() || undefined,
        city: city.trim(),
        state: state.trim(),
        zip: zip.trim() || undefined,
        costCents: Number.isFinite(costCents) ? costCents : 0,
        currency: "usd",
        capacity: capacity.trim() ? Number(capacity) : undefined,
        spotsRemaining: spotsRemaining.trim() ? Number(spotsRemaining) : undefined,
        registrationOpen,
        registrationOpenAt: registrationOpenAt ? localInputToIso(registrationOpenAt) : undefined,
        registrationCloseAt: registrationCloseAt ? localInputToIso(registrationCloseAt) : undefined,
        status,
        stripePriceId: stripePriceId.trim() || undefined
      };

      if (mode === "create") {
        await apiFetch("/admin/showcases", { method: "POST", token, body: JSON.stringify(payload) });
        resetForm();
        await load();
      } else if (editing) {
        await apiFetch(`/admin/showcases/${editing.id}`, { method: "PUT", token, body: JSON.stringify(payload) });
        await load();
      }
    } catch (err) {
      const parsed = parseApiError(err);
      setFormError(parsed.formError ?? "Failed to save showcase");
      setFieldErrors(parsed.fieldErrors);
    } finally {
      setSaving(false);
    }
  }

  async function archive(row: ShowcaseRow) {
    if (!confirm(`Archive "${row.title}"?`)) return;
    setError(null);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "admin") throw new Error("Insufficient permissions.");
      await apiFetch(`/admin/showcases/${row.id}`, { method: "DELETE", token });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive");
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Showcases</h2>
            <p className="mt-1 text-sm text-white/80">Create and manage the showcases catalog.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" className="border border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={resetForm}>
              New
            </Button>
            <Button type="button" onClick={load} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          <div className="grid gap-2">
            <Label htmlFor="showcaseStatusFilter">Status</Label>
            <select
              id="showcaseStatusFilter"
              className="w-full rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary-600)]"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="showcaseSportFilter">Sport</Label>
            <select
              id="showcaseSportFilter"
              className="w-full rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary-600)]"
              value={sportFilter}
              onChange={(e) => setSportFilter(e.target.value)}
            >
              <option value="">All</option>
              {SPORTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="showcaseFrom">From</Label>
            <Input id="showcaseFrom" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="showcaseTo">To</Label>
            <Input id="showcaseTo" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-[color:var(--border)] bg-[var(--surface)]">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="border-b border-[color:var(--border)] text-[color:var(--muted-2)]">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Start</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Cost</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Reg open</th>
                <th className="px-4 py-3 font-medium">Cap/Remaining</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id} className="border-b border-[color:var(--border)] last:border-0">
                  <td className="px-4 py-3 text-[color:var(--foreground)]">
                    <div className="font-semibold">{r.title}</div>
                    <div className="text-xs text-[color:var(--muted-2)]">{r.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-[color:var(--muted)]">{r.startDateTime ? new Date(r.startDateTime).toLocaleString() : "—"}</td>
                  <td className="px-4 py-3 text-[color:var(--muted)]">
                    {r.city}, {r.state}
                  </td>
                  <td className="px-4 py-3 text-[color:var(--muted)]">{fmtMoney(r.costCents, r.currency)}</td>
                  <td className="px-4 py-3 text-[color:var(--muted)]">{r.status ?? "—"}</td>
                  <td className="px-4 py-3 text-[color:var(--muted)]">{r.registrationOpen ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-[color:var(--muted)]">
                    {typeof r.capacity === "number" ? r.capacity : "—"}/{typeof r.spotsRemaining === "number" ? r.spotsRemaining : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        className="border border-white/15 bg-white/5 text-white hover:bg-white/10"
                        onClick={() => beginEdit(r)}
                      >
                        Edit
                      </Button>
                      <Link className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500" href={`/showcases/${encodeURIComponent(r.slug || r.id)}`}>
                        Preview
                      </Link>
                      <Button
                        type="button"
                        className="border border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                        onClick={() => archive(r)}
                      >
                        Archive
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {results.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-[color:var(--muted)]" colSpan={8}>
                    No showcases found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">{mode === "create" ? "Create showcase" : "Edit showcase"}</h3>
            <p className="mt-1 text-sm text-white/80">
              Option 1 Stripe linking: paste the <span className="font-semibold text-white">stripePriceId</span> to enable registration.
            </p>
          </div>
          {editing ? (
            <div className="text-sm">
              <Link href={`/showcases/${encodeURIComponent(editing.slug || editing.id)}`} className="text-indigo-300 hover:text-indigo-200 hover:underline">
                View public page
              </Link>
            </div>
          ) : null}
        </div>

        <div className="mt-4">
          <FormErrorSummary formError={formError ?? undefined} fieldErrors={fieldErrors} />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="showcaseTitle">Title</Label>
            <Input
              id="showcaseTitle"
              value={title}
              onChange={(e) => {
                const next = e.target.value;
                setTitle(next);
                if (mode === "create") setSlug(slug || slugify(next));
              }}
            />
            <FieldError name="title" fieldErrors={fieldErrors} />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="showcaseSlug">Slug</Label>
            <Input id="showcaseSlug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="summer-showcase-2026" />
            <FieldError name="slug" fieldErrors={fieldErrors} />
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="showcaseDesc">Description</Label>
            <textarea
              id="showcaseDesc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              className="w-full rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary-600)]"
              placeholder="Full description, who should attend, what to bring, refund policy..."
            />
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="showcaseRefundPolicy">Refund policy</Label>
            <textarea
              id="showcaseRefundPolicy"
              value={refundPolicy}
              onChange={(e) => setRefundPolicy(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary-600)]"
              placeholder="Refund policy: refunds are subject to GoEducate policies (MVP placeholder)."
            />
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <div className="text-sm font-medium text-[color:var(--muted)]">Sport categories</div>
            <div className="flex flex-wrap gap-3">
              {SPORTS.map((s) => {
                const checked = sports.includes(s);
                return (
                  <label key={s} className="inline-flex items-center gap-2 text-sm text-white/80">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setSports((prev) => (checked ? prev.filter((x) => x !== s) : [...prev, s]));
                      }}
                    />
                    {s}
                  </label>
                );
              })}
            </div>
            <FieldError name="sportCategories" fieldErrors={fieldErrors} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="showcaseStart">Start</Label>
            <Input id="showcaseStart" type="datetime-local" value={startDateTime} onChange={(e) => setStartDateTime(e.target.value)} />
            <FieldError name="startDateTime" fieldErrors={fieldErrors} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="showcaseEnd">End</Label>
            <Input id="showcaseEnd" type="datetime-local" value={endDateTime} onChange={(e) => setEndDateTime(e.target.value)} />
            <FieldError name="endDateTime" fieldErrors={fieldErrors} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="showcaseTz">Timezone</Label>
            <Input id="showcaseTz" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="showcaseCost">Cost (USD)</Label>
            <Input id="showcaseCost" value={costUsd} onChange={(e) => setCostUsd(e.target.value)} placeholder="99.00" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="showcaseCapacity">Capacity (optional)</Label>
            <Input id="showcaseCapacity" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="200" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="showcaseRemaining">Spots remaining (optional)</Label>
            <Input id="showcaseRemaining" value={spotsRemaining} onChange={(e) => setSpotsRemaining(e.target.value)} placeholder="200" />
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="showcaseVenue">Venue name</Label>
            <Input id="showcaseVenue" value={locationName} onChange={(e) => setLocationName(e.target.value)} />
            <FieldError name="locationName" fieldErrors={fieldErrors} />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="showcaseAddr1">Address line 1</Label>
            <Input id="showcaseAddr1" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} />
            <FieldError name="addressLine1" fieldErrors={fieldErrors} />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="showcaseAddr2">Address line 2</Label>
            <Input id="showcaseAddr2" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="showcaseCity">City</Label>
            <Input id="showcaseCity" value={city} onChange={(e) => setCity(e.target.value)} />
            <FieldError name="city" fieldErrors={fieldErrors} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="showcaseState">State</Label>
            <Input id="showcaseState" value={state} onChange={(e) => setState(e.target.value)} />
            <FieldError name="state" fieldErrors={fieldErrors} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="showcaseZip">Zip</Label>
            <Input id="showcaseZip" value={zip} onChange={(e) => setZip(e.target.value)} />
          </div>

          <div className="grid gap-2">
            <div className="text-sm font-medium text-[color:var(--muted)]">Registration open</div>
            <label className="inline-flex items-center gap-2 text-sm text-white/80">
              <input type="checkbox" checked={registrationOpen} onChange={(e) => setRegistrationOpen(e.target.checked)} /> Open
            </label>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="showcaseStatus">Status</Label>
            <select
              id="showcaseStatus"
              className="w-full rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary-600)]"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="showcaseOpenAt">Open at (optional)</Label>
            <Input id="showcaseOpenAt" type="datetime-local" value={registrationOpenAt} onChange={(e) => setRegistrationOpenAt(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="showcaseCloseAt">Close at (optional)</Label>
            <Input id="showcaseCloseAt" type="datetime-local" value={registrationCloseAt} onChange={(e) => setRegistrationCloseAt(e.target.value)} />
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="showcaseStripePriceId">Stripe Price ID (required to register)</Label>
            <Input id="showcaseStripePriceId" value={stripePriceId} onChange={(e) => setStripePriceId(e.target.value)} placeholder="price_..." />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? "Saving..." : mode === "create" ? "Create showcase" : "Save changes"}
          </Button>
          <Button
            type="button"
            className="border border-white/15 bg-white/5 text-white hover:bg-white/10"
            onClick={() => resetForm()}
          >
            Reset
          </Button>
        </div>
      </Card>
    </div>
  );
}


