"use client";

import { useState } from "react";

import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";
import { Button, Card, RefreshIconButton } from "@/components/ui";
import { useAutoRevalidate } from "@/lib/useAutoRevalidate";

type EmailConfig = {
  configured: boolean;
  from: string | null;
  host: string | null;
  port: number | null;
  secure: boolean | null;
  authMethod: string | null;
  webAppUrl: string | null;
};

type EmailAuditRow = {
  _id: string;
  type: string;
  status: string;
  to: string;
  subject: string;
  messageId?: string;
  createdAt: string;
  error?: any;
  meta?: any;
};

export function AdminEmailDiagnostics() {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [resending, setResending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [rows, setRows] = useState<EmailAuditRow[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(0);
  const pageSize = 25;
  const [toEmail, setToEmail] = useState("");
  const [lastMessageId, setLastMessageId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterTo, setFilterTo] = useState<string>("");

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "admin") throw new Error("Insufficient permissions.");

      const qs = new URLSearchParams({
        limit: String(pageSize),
        skip: String(page * pageSize)
      });
      if (filterStatus.trim()) qs.set("status", filterStatus.trim());
      if (filterType.trim()) qs.set("type", filterType.trim());
      if (filterTo.trim()) qs.set("to", filterTo.trim().toLowerCase());

      const [cfg, audit] = await Promise.all([
        apiFetch<EmailConfig>("/admin/email/config", { token }),
        apiFetch<{ total: number; results: EmailAuditRow[]; skip: number; limit: number }>(
          `/admin/email/audit?${qs.toString()}`,
          { token }
        )
      ]);
      setConfig(cfg);
      setRows(audit.results ?? []);
      setTotal(audit.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load email diagnostics");
    } finally {
      setLoading(false);
    }
  }

  async function sendTest() {
    setError(null);
    setLastMessageId(null);
    setSending(true);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "admin") throw new Error("Insufficient permissions.");

      const to = toEmail.trim();
      if (!to) throw new Error("Enter a recipient email.");

      const res = await apiFetch<{ ok: true; messageId: string | null }>("/admin/email/test", {
        token,
        method: "POST",
        body: JSON.stringify({ to })
      });
      setLastMessageId(res.messageId ?? null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send test email");
    } finally {
      setSending(false);
    }
  }

  async function resendInvite(row: EmailAuditRow) {
    setError(null);
    setResending(row._id);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "admin") throw new Error("Insufficient permissions.");

      const inviteRole = String(row?.meta?.role ?? "").trim();
      if (!inviteRole) throw new Error("Missing invite role metadata on this row.");

      await apiFetch("/admin/email/resend-invite", {
        token,
        method: "POST",
        body: JSON.stringify({ email: row.to, role: inviteRole })
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend invite");
    } finally {
      setResending(null);
    }
  }

  async function resendFromAudit(row: EmailAuditRow) {
    setError(null);
    setResending(row._id);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "admin") throw new Error("Insufficient permissions.");

      await apiFetch("/admin/email/resend", {
        token,
        method: "POST",
        body: JSON.stringify({ id: row._id })
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend email");
    } finally {
      setResending(null);
    }
  }

  useAutoRevalidate(load, { deps: [page], intervalMs: 30_000 });

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Email diagnostics</h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">Verify SMTP configuration and inspect recent sends/failures.</p>
        </div>
        <RefreshIconButton onClick={load} loading={loading} />
      </div>

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] p-4">
          <div className="text-sm font-semibold text-[color:var(--foreground)]">SMTP config</div>
          <div className="mt-3 grid gap-2 text-sm text-[color:var(--muted)]">
            <div>
              Status:{" "}
              <span className={config?.configured ? "text-emerald-300" : "text-red-300"}>
                {config?.configured ? "Configured" : "Not configured"}
              </span>
            </div>
            <div>From: <span className="text-[color:var(--foreground)]">{config?.from ?? "—"}</span></div>
            <div>Host: <span className="text-[color:var(--foreground)]">{config?.host ?? "—"}</span></div>
            <div>Port: <span className="text-[color:var(--foreground)]">{config?.port ?? "—"}</span></div>
            <div>Secure: <span className="text-[color:var(--foreground)]">{typeof config?.secure === "boolean" ? String(config.secure) : "—"}</span></div>
            <div>Auth method: <span className="text-[color:var(--foreground)]">{config?.authMethod ?? "—"}</span></div>
            <div>WEB_APP_URL: <span className="text-[color:var(--foreground)]">{config?.webAppUrl ?? "—"}</span></div>
          </div>
        </div>

        <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] p-4">
          <div className="text-sm font-semibold text-[color:var(--foreground)]">Send test email</div>
          <div className="mt-3 grid gap-2">
            <label className="text-xs uppercase tracking-wide text-[color:var(--muted-2)]">Recipient</label>
            <input
              className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <div className="mt-2 flex items-center gap-3">
              <Button type="button" onClick={sendTest} disabled={sending || !config?.configured}>
                {sending ? "Sending..." : "Send test"}
              </Button>
              {lastMessageId ? <div className="text-sm text-emerald-300">Sent (messageId: {lastMessageId})</div> : null}
            </div>
            {!config?.configured ? <div className="text-sm text-[color:var(--muted)]">SMTP is not configured on the API service.</div> : null}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] p-4">
        <div className="text-sm font-semibold text-[color:var(--foreground)]">Recent email audit log</div>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <div>
            <label className="text-xs uppercase tracking-wide text-[color:var(--muted-2)]">Status</label>
            <select
              className="mt-1 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400"
              value={filterStatus}
              onChange={(e) => {
                setPage(0);
                setFilterStatus(e.target.value);
              }}
            >
              <option value="">All</option>
              <option value="sent">sent</option>
              <option value="failed">failed</option>
              <option value="skipped">skipped</option>
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-[color:var(--muted-2)]">Type</label>
            <input
              className="mt-1 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400"
              value={filterType}
              onChange={(e) => {
                setPage(0);
                setFilterType(e.target.value);
              }}
              placeholder='e.g. "invite" or "notification"'
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-[color:var(--muted-2)]">To</label>
            <input
              className="mt-1 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400"
              value={filterTo}
              onChange={(e) => {
                setPage(0);
                setFilterTo(e.target.value);
              }}
              placeholder="recipient@example.com"
            />
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 text-sm text-[color:var(--muted)]">
          <div>
            Showing <span className="text-[color:var(--foreground)] font-semibold">{rows.length}</span> of{" "}
            <span className="text-[color:var(--foreground)] font-semibold">{total}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/90 hover:bg-white/10 disabled:opacity-50"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
            >
              Prev
            </button>
            <button
              type="button"
              className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/90 hover:bg-white/10 disabled:opacity-50"
              onClick={() => setPage((p) => (p + 1) * pageSize < total ? p + 1 : p)}
              disabled={(page + 1) * pageSize >= total || loading}
            >
              Next
            </button>
          </div>
        </div>
        <div className="mt-3 max-h-[420px] overflow-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-[var(--surface)] text-xs uppercase tracking-wide text-[color:var(--muted-2)]">
              <tr>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">To</th>
                <th className="px-3 py-2">Subject</th>
                <th className="px-3 py-2">Actions</th>
                <th className="px-3 py-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id} className="border-t border-white/10">
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-2">{r.type}</td>
                  <td className="px-3 py-2">
                    <span className={r.status === "sent" ? "text-emerald-300" : r.status === "failed" ? "text-red-300" : "text-[color:var(--muted)]"}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">{r.to}</td>
                  <td className="px-3 py-2">{r.subject}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/90 hover:bg-white/10 disabled:opacity-50"
                      onClick={() => (r.type === "invite" ? resendInvite(r) : resendFromAudit(r))}
                      disabled={Boolean(resending) || !config?.configured}
                      title={r.type === "invite" ? "Resend (creates a fresh invite token)" : "Resend (best-effort; depends on email type/metadata)"}
                    >
                      {resending === r._id ? "Resending..." : "Resend"}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-xs text-[color:var(--muted)]">
                    {r.error ? (typeof r.error === "string" ? r.error : JSON.stringify(r.error)) : "—"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-[color:var(--muted)]" colSpan={7}>
                    No email audit logs found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}


