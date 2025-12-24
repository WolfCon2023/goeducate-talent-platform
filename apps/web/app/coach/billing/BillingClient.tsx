"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { Card, Button } from "@/components/ui";
import { toast } from "@/components/ToastProvider";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";
import { useConfirm } from "@/components/ConfirmDialog";

type BillingStatus = {
  configured: boolean;
  status: string;
  hasCustomer: boolean;
  hasSubscription: boolean;
  plan: "monthly" | "annual" | "unknown" | null;
  renewalDate: string | null;
  subscriptionId: string | null;
  downgradeScheduled: boolean;
};

export function BillingClient() {
  const router = useRouter();
  const search = useSearchParams();
  const confirm = useConfirm();
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

  async function scheduleDowngradeToMonthly() {
    setError(null);
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Please login as a coach first.");

      const renewal = status?.renewalDate ? new Date(status.renewalDate) : null;
      const pretty = renewal ? renewal.toLocaleDateString() : "your renewal date";
      const ok = await confirm({
        title: "Downgrade to Monthly",
        message: `Downgrades from Annual to Monthly take effect on ${pretty}. We'll schedule the change so you won't be double-billed.`,
        confirmText: "Schedule downgrade",
        cancelText: "Keep Annual"
      });
      if (!ok) return;

      setLoading(true);
      const res = await apiFetch<{ scheduled: boolean; alreadyScheduled?: boolean; effectiveDate?: string | null; message?: string }>(
        "/billing/downgrade-monthly",
        { method: "POST", token }
      );
      toast({
        kind: "success",
        title: res.alreadyScheduled ? "Already scheduled" : "Downgrade scheduled",
        message: res.effectiveDate ? `Effective ${new Date(res.effectiveDate).toLocaleDateString()}.` : res.message ?? "Scheduled."
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule downgrade");
    } finally {
      setLoading(false);
    }
  }

  const token = getAccessToken();
  const role = getTokenRole(token);
  const isAdmin = role === "admin";
  const subscribed = Boolean(status && (status.hasSubscription || status.status === "active"));

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
                  Status:{" "}
                  <span className={String(status.status) === "active" ? "text-emerald-300" : "text-white/90"}>
                    {String(status.status ?? "—")}
                  </span>
                  {isAdmin ? (
                    <>
                      {" · "}Stripe:{" "}
                      <span className={status.configured ? "text-emerald-300" : "text-amber-300"}>
                        {status.configured ? "Configured" : "Not configured"}
                      </span>
                    </>
                  ) : null}
                  {subscribed ? (
                    <>
                      {" · "}Plan:{" "}
                      <span className="text-white/90">
                        {status.plan === "monthly" ? "Monthly" : status.plan === "annual" ? "Annual" : "Unknown"}
                      </span>
                      {status.renewalDate ? (
                        <>
                          {" · "}Renews:{" "}
                          <span className="text-white/90">{new Date(status.renewalDate).toLocaleDateString()}</span>
                        </>
                      ) : null}
                      {status.downgradeScheduled ? (
                        <>
                          {" · "}
                          <span className="text-amber-200">Downgrade scheduled</span>
                        </>
                      ) : null}
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
            Billing is temporarily unavailable. Please contact support if you need access to subscription features.
            {isAdmin ? (
              <div className="mt-2 text-xs text-amber-100/80">
                Admin note: Stripe is not configured (missing required environment variables).
              </div>
            ) : null}
          </div>
        ) : subscribed ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm text-white/80">
              Manage your existing subscription (payment method, cancel, invoices).
              {status.plan === "annual" && status.renewalDate ? (
                <div className="mt-2 text-xs text-amber-200">
                  Downgrading from Annual → Monthly is available on your renewal date ({new Date(status.renewalDate).toLocaleDateString()}).
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {status.plan === "annual" ? (
                <Button
                  type="button"
                  className="border border-white/15 bg-white/5 text-white hover:bg-white/10"
                  onClick={scheduleDowngradeToMonthly}
                  disabled={loading || Boolean(status.downgradeScheduled)}
                >
                  {status.downgradeScheduled ? "Downgrade scheduled" : "Downgrade to Monthly"}
                </Button>
              ) : null}
              <Button type="button" onClick={openPortal} disabled={loading}>
                {loading ? "Opening…" : "Manage subscription"}
              </Button>
            </div>
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


