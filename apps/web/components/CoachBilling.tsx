"use client";

import { useEffect, useMemo, useState } from "react";

import { Button, Card } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";

type BillingStatus = {
  configured: boolean;
  status: "active" | "inactive";
};

export function CoachBilling() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<"monthly" | "annual">("monthly");

  const isActive = status?.status === "active";
  const configured = status?.configured ?? false;

  const planLabel = useMemo(() => (plan === "annual" ? "Annual" : "Monthly"), [plan]);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login as a coach first.");
      if (role !== "coach" && role !== "admin") throw new Error("Insufficient permissions.");
      const res = await apiFetch<BillingStatus>("/billing/status", { token });
      setStatus(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load billing status");
    } finally {
      setLoading(false);
    }
  }

  async function startCheckout() {
    setError(null);
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Please login as a coach first.");
      const res = await apiFetch<{ url: string }>("/billing/checkout", {
        method: "POST",
        token,
        body: JSON.stringify({ plan })
      });
      window.location.href = res.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start checkout");
    }
  }

  async function openPortal() {
    setError(null);
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Please login as a coach first.");
      const res = await apiFetch<{ url: string }>("/billing/portal", { method: "POST", token });
      window.location.href = res.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open billing portal");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="grid gap-6">
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
            <p className="mt-1 text-sm text-[color:var(--muted)]">Manage your Coach subscription to unlock player contact info.</p>
          </div>
          <Button type="button" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {!configured ? (
          <div className="mt-6 rounded-2xl border border-[color:var(--border)] bg-[var(--surface-soft)] p-4">
            <div className="text-sm font-semibold text-[color:var(--foreground)]">Billing not configured</div>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              Stripe isn’t configured yet for this environment. Contact an admin to finish setup.
            </p>
          </div>
        ) : (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[color:var(--border)] bg-[var(--surface-soft)] px-2.5 py-1 text-xs font-semibold text-[color:var(--muted-2)]">
              Status: {isActive ? "Active" : "Inactive"}
            </span>

            {isActive ? (
              <Button type="button" onClick={openPortal}>
                Manage subscription
              </Button>
            ) : (
              <>
                <div className="flex items-center gap-2 rounded-2xl border border-[color:var(--border)] bg-[var(--surface-soft)] p-2">
                  <button
                    type="button"
                    onClick={() => setPlan("monthly")}
                    className={`rounded-xl px-3 py-1.5 text-sm ${
                      plan === "monthly"
                        ? "bg-indigo-600 text-white"
                        : "text-[color:var(--muted)] hover:bg-[var(--surface)]"
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlan("annual")}
                    className={`rounded-xl px-3 py-1.5 text-sm ${
                      plan === "annual"
                        ? "bg-indigo-600 text-white"
                        : "text-[color:var(--muted)] hover:bg-[var(--surface)]"
                    }`}
                  >
                    Annual
                  </button>
                </div>
                <Button type="button" onClick={startCheckout}>
                  Upgrade ({planLabel})
                </Button>
              </>
            )}
          </div>
        )}

        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
      </Card>
    </div>
  );
}


