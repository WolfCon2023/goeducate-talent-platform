"use client";

import { useCallback, useEffect, useState } from "react";

import { Card, Button, Input, Label, RefreshIconButton } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";

type Status = "pending" | "approved" | "rejected";

type AccessRequest = {
  _id: string;
  createdAt: string;
  status: Status;
  fullName: string;
  email: string;
  requestedRole: string;
  sport: string;
  sportOther?: string;
  answers: Record<string, string | string[]>;
  adminNotes?: string;
  reviewedAt?: string;
};

export function AdminAccessRequests() {
  const [filter, setFilter] = useState<Status | "all">("pending");
  const [items, setItems] = useState<AccessRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<AccessRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const loadList = useCallback(async (nextFilter: typeof filter) => {
    setStatus(null);
    setLoading(true);
    try {
      const t = getAccessToken();
      const role = getTokenRole(t);
      if (!t) throw new Error("Please login first.");
      if (role !== "admin") throw new Error("Insufficient permissions.");
      const qs = nextFilter === "all" ? "" : `?status=${encodeURIComponent(nextFilter)}`;
      const res = await apiFetch<{ items: AccessRequest[] }>(`/admin/access-requests${qs}`, { token: t });
      setItems(res.items ?? []);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to load access requests");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setStatus(null);
    setSelectedId(id);
    setSelected(null);
    setAdminNotes("");
    try {
      const t = getAccessToken();
      const role = getTokenRole(t);
      if (!t) throw new Error("Please login first.");
      if (role !== "admin") throw new Error("Insufficient permissions.");
      const res = await apiFetch<{ item: AccessRequest }>(`/admin/access-requests/${id}`, { token: t });
      setSelected(res.item);
      setAdminNotes(res.item.adminNotes ?? "");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to load request");
    }
  }, []);

  useEffect(() => {
    void loadList(filter);
  }, [filter, loadList]);

  const review = useCallback(async (action: "approve" | "reject") => {
    if (!selectedId) return;
    setSaving(true);
    setStatus(null);
    try {
      const t = getAccessToken();
      const role = getTokenRole(t);
      if (!t) throw new Error("Please login first.");
      if (role !== "admin") throw new Error("Insufficient permissions.");
      await apiFetch(`/admin/access-requests/${selectedId}`, {
        method: "PATCH",
        token: t,
        body: JSON.stringify({ action, adminNotes: adminNotes.trim() || undefined })
      });
      setStatus(action === "approve" ? "Approved and invite email sent (if configured)." : "Rejected and applicant notified (if configured).");
      setSelectedId(null);
      setSelected(null);
      setAdminNotes("");
      await loadList(filter);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to update request");
    } finally {
      setSaving(false);
    }
  }, [adminNotes, filter, loadList, selectedId]);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Access requests</h2>
          <p className="mt-1 text-sm text-white/80">Review invite-only access requests. Approving sends an invite link automatically.</p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="arFilter">Filter</Label>
          <select
            id="arFilter"
            className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </select>
          <RefreshIconButton onClick={() => void loadList(filter)} loading={loading} title="Refresh access requests" />
        </div>
      </div>

      {status ? <div className="mt-4 text-sm text-white/80">{status}</div> : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <div className="text-xs text-white/60">Requests</div>
          <div className="mt-2 grid gap-2">
            {items.length === 0 ? <div className="text-sm text-white/70">No results.</div> : null}
            {items.map((r) => {
              const active = selectedId === String(r._id);
              const sport = r.sportOther ? `${r.sport} (${r.sportOther})` : r.sport;
              return (
                <button
                  key={String(r._id)}
                  type="button"
                  onClick={() => void loadDetail(String(r._id))}
                  className={`w-full rounded-xl border px-3 py-2 text-left ${
                    active ? "border-indigo-400/40 bg-white/10" : "border-white/10 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-white">{r.fullName}</div>
                    <div className="text-[11px] text-white/60">{new Date(r.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div className="mt-1 text-xs text-white/70">{r.email}</div>
                  <div className="mt-1 text-xs text-white/70">
                    {r.requestedRole} · {sport} · <span className="text-white/80">{r.status}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="text-xs text-white/60">Detail</div>
          {selected ? (
            <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-white">{selected.fullName}</div>
                  <div className="mt-1 text-sm text-white/80">{selected.email}</div>
                  <div className="mt-1 text-sm text-white/80">
                    Role: <span className="text-white">{selected.requestedRole}</span> · Sport:{" "}
                    <span className="text-white">{selected.sportOther ? `${selected.sport} (${selected.sportOther})` : selected.sport}</span>
                  </div>
                  <div className="mt-1 text-sm text-white/70">
                    Status: <span className="text-white">{selected.status}</span>
                    {selected.reviewedAt ? ` · Reviewed: ${new Date(selected.reviewedAt).toLocaleString()}` : ""}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <div className="text-sm font-semibold text-white">Answers</div>
                <div className="mt-2 grid gap-2">
                  {Object.entries(selected.answers ?? {}).map(([k, v]) => (
                    <div key={k} className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="text-xs text-white/60">{k}</div>
                      <div className="mt-1 text-sm text-white/90">{Array.isArray(v) ? v.join(", ") : v}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-2">
                <Label htmlFor="adminNotes">Admin notes (internal)</Label>
                <Input
                  id="adminNotes"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Optional notes (not sent to applicant)"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button type="button" onClick={() => void review("approve")} disabled={saving}>
                    {saving ? "Saving..." : "Approve + send invite"}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void review("reject")}
                    disabled={saving}
                    className="border border-white/15 bg-white/5 hover:bg-white/10"
                  >
                    Reject
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-2 text-sm text-white/70">Select a request to view details.</div>
          )}
        </div>
      </div>
    </Card>
  );
}


