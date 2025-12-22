"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Card, Button, Input, Label } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";

type ShowcaseMini = {
  id: string;
  slug?: string;
  title?: string;
  startDateTime?: string | null;
  city?: string;
  state?: string;
};

type RegistrationRow = {
  id: string;
  paymentStatus: string;
  createdAt: string;
  fullName: string;
  email: string;
  role?: string;
  sport?: string;
  stripeCheckoutSessionId?: string;
  stripePaymentIntentId?: string;
  showcase?: ShowcaseMini;
};

function fmtDateTime(iso?: string | null) {
  if (!iso) return "TBD";
  return new Date(iso).toLocaleString();
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(v: unknown) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

export function AdminShowcaseRegistrations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<RegistrationRow[]>([]);

  const [status, setStatus] = useState("");
  const [email, setEmail] = useState("");
  const [showcaseId, setShowcaseId] = useState("");

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
    if (email.trim()) p.set("email", email.trim().toLowerCase());
    if (showcaseId.trim()) p.set("showcaseId", showcaseId.trim());
    return p.toString();
  }, [status, email, showcaseId]);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "admin") throw new Error("Insufficient permissions.");

      const res = await apiFetch<{ results: RegistrationRow[] }>(`/admin/showcase-registrations?${query}`, { token });
      setResults(res.results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load registrations");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  function exportCsv() {
    const header = [
      "createdAt",
      "paymentStatus",
      "fullName",
      "email",
      "role",
      "sport",
      "showcaseTitle",
      "showcaseStart",
      "showcaseCity",
      "showcaseState",
      "stripeCheckoutSessionId",
      "stripePaymentIntentId"
    ];
    const rows = results.map((r) => [
      r.createdAt,
      r.paymentStatus,
      r.fullName,
      r.email,
      r.role ?? "",
      r.sport ?? "",
      r.showcase?.title ?? "",
      r.showcase?.startDateTime ?? "",
      r.showcase?.city ?? "",
      r.showcase?.state ?? "",
      r.stripeCheckoutSessionId ?? "",
      r.stripePaymentIntentId ?? ""
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
    downloadText(`showcase-registrations-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Showcase registrations</h2>
          <p className="mt-1 text-sm text-white/80">Search and export registration records.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
          <Button type="button" className="border border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={exportCsv} disabled={!results.length}>
            Export CSV
          </Button>
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="srStatus">Payment status</Label>
          <select
            id="srStatus"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary-600)]"
          >
            <option value="">All</option>
            <option value="paid">paid</option>
            <option value="pending">pending</option>
            <option value="failed">failed</option>
            <option value="refunded">refunded</option>
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="srEmail">Registrant email</Label>
          <Input id="srEmail" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="srShowcaseId">Showcase ID</Label>
          <Input id="srShowcaseId" value={showcaseId} onChange={(e) => setShowcaseId(e.target.value)} placeholder="Mongo ObjectId" />
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[color:var(--border)] text-[color:var(--muted-2)]">
              <th className="py-2 pr-4">Created</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Showcase</th>
              <th className="py-2 pr-4">Start</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.id} className="border-b border-[color:var(--border)]">
                <td className="py-2 pr-4 text-white/80">{fmtDateTime(r.createdAt)}</td>
                <td className="py-2 pr-4 text-white/80">{r.paymentStatus}</td>
                <td className="py-2 pr-4 text-white/80">{r.fullName}</td>
                <td className="py-2 pr-4 text-white/80">{r.email}</td>
                <td className="py-2 pr-4 text-white/80">{r.showcase?.title ?? "—"}</td>
                <td className="py-2 pr-4 text-white/80">{fmtDateTime(r.showcase?.startDateTime ?? null)}</td>
              </tr>
            ))}
            {results.length === 0 ? (
              <tr>
                <td className="py-4 text-[color:var(--muted)]" colSpan={6}>
                  {loading ? "Loading..." : "No registrations found."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Card>
  );
}


