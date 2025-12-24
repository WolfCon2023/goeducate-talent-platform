"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { Card, Button } from "@/components/ui";
import { toast } from "@/components/ToastProvider";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";

type BillingStatus = {
  configured: boolean;
  status: string;
  hasCustomer: boolean;
  hasSubscription: boolean;
  plan: "monthly" | "annual" | "unknown" | null;
};

export function BillingClient() {
  const router = useRouter();
  const search = useSearchParams();
  const [status, setStatus] = React.useState<BillingStatus | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const success = search.get("success");
    const canceled = search.get("canceled");
    if (success) toast({ kind: "success", title: "Success", message: "Your subscription update is complete." });
    if (canceled) toast({ kind: "info", title: "Canceled", message: "Checkout was canceled." });
    // Clean URL (so refresh doesn't re-toast)
    if (success || canceled) router.replace("/coach/billing");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Please login as a coach first.");
      const res = await apiFetch<BillingStatus>("/billing/status", { token });
      setStatus(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load billing status");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void load();
  }, []);

  async function startCheckout(plan: "monthly" | "annual") {
    setError(null);
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  }

  async function openPortal() {
    setError(null);
    setLoading(true);
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Please login as a coach first.");
      const res = await apiFetch<{ url: string }>("/billing/portal", { method: "POST", token });
      window.location.href = res.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open billing portal");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
          <p className="mt-2 text-sm text-white/80">Manage your Coach subscription to unlock player contact details.</p>
        </div>
        <Link href="/coach" className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
          ← Back to dashboard
        </Link>
      </div>

      <Card className="mt-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold">Subscription status</div>
            <div className="mt-1 text-sm text-white/80">
              {status ? (
                <>
                  Stripe:{" "}
                  <span className={status.configured ? "text-emerald-300" : "text-amber-300"}>
                    {status.configured ? "Configured" : "Not configured"}
                  </span>
                  {" · "}Status: <span className="text-white/90">{String(status.status ?? "—")}</span>
                  {status.hasSubscription ? (
                    <>
                      {" · "}Plan:{" "}
                      <span className="text-white/90">
                        {status.plan === "monthly" ? "Monthly" : status.plan === "annual" ? "Annual" : "Unknown"}
                      </span>
                    </>
                  ) : null}
                </>
              ) : (
                "Loading…"
              )}
            </div>
          </div>
          <Button
            type="button"
            className="border border-white/15 bg-white/5 text-white hover:bg-white/10"
            onClick={load}
            disabled={loading}
          >
            {loading ? "Checking…" : "Re-check"}
          </Button>
        </div>

        {error ? <div className="mt-4 text-sm text-red-300">{error}</div> : null}

        {!status?.configured ? (
          <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
            Billing is not configured right now. Please contact support if you need access to subscription features.
          </div>
        ) : status?.hasSubscription ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm text-white/80">Manage your existing subscription (payment method, cancel, invoices).</div>
            <Button type="button" onClick={openPortal} disabled={loading}>
              {loading ? "Opening…" : "Manage subscription"}
            </Button>
          </div>
        ) : (
          <div className="mt-6 grid gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-semibold">Upgrade</div>
              <div className="mt-1 text-sm text-white/80">Choose a plan to unlock player contact info.</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="button" onClick={() => startCheckout("monthly")} disabled={loading}>
                  {loading ? "Redirecting…" : "Monthly"}
                </Button>
                <Button
                  type="button"
                  className="border border-white/15 bg-white/5 text-white hover:bg-white/10"
                  onClick={() => startCheckout("annual")}
                  disabled={loading}
                >
                  {loading ? "Redirecting…" : "Annual"}
                </Button>
              </div>
            </div>
            <div className="text-xs text-white/60">
              You’ll be redirected to Stripe Checkout. After payment, you’ll return here.
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}


