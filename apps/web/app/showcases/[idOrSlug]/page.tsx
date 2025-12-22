"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Card, Button, Input, Label } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";
import { FormErrorSummary, FieldError } from "@/components/FormErrors";
import { parseApiError, type FieldErrors } from "@/lib/formErrors";

type Showcase = {
  id: string;
  slug: string;
  title: string;
  description: string;
  sportCategories: string[];
  startDateTime: string | null;
  endDateTime: string | null;
  timezone: string;
  locationName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zip?: string;
  costCents: number;
  currency: string;
  capacity?: number;
  spotsRemaining?: number;
  registrationStatus: "open" | "closed" | "sold_out";
  registrationStatusLabel: string;
};

type MeResponse = { user: { email: string; role: string; displayName?: string } };

function fmtMoney(cents: number, currency: string) {
  const amount = (cents ?? 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: (currency || "usd").toUpperCase() }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "TBD";
  return new Date(iso).toLocaleString();
}

export default function ShowcaseDetailPage() {
  const params = useParams<{ idOrSlug: string }>();
  const search = useSearchParams();
  const idOrSlug = params?.idOrSlug ?? "";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showcase, setShowcase] = useState<Showcase | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors | undefined>(undefined);

  const success = search?.get("success") === "1";
  const canceled = search?.get("canceled") === "1";

  useEffect(() => {
    let cancelled = false;
    async function prefill() {
      const token = getAccessToken();
      if (!token) return;
      if (fullName.trim() && email.trim()) return;
      try {
        const me = await apiFetch<MeResponse>("/auth/me", { token });
        if (cancelled) return;
        if (!email.trim()) setEmail(String(me.user.email ?? "").trim().toLowerCase());
        if (!fullName.trim() && me.user.displayName) setFullName(String(me.user.displayName).trim());
      } catch {
        // best effort only
      }
    }
    void prefill();
    return () => {
      cancelled = true;
    };
  }, [email, fullName]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      setLoading(true);
      try {
        const res = await apiFetch<Showcase>(`/showcases/${encodeURIComponent(idOrSlug)}`);
        if (cancelled) return;
        setShowcase(res);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load showcase");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [idOrSlug]);

  const address = useMemo(() => {
    if (!showcase) return "";
    const parts = [showcase.locationName, showcase.addressLine1, showcase.addressLine2, `${showcase.city}, ${showcase.state} ${showcase.zip ?? ""}`.trim()];
    return parts.filter(Boolean).join(", ");
  }, [showcase]);

  const mapUrl = useMemo(() => {
    if (!address) return null;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }, [address]);

  async function register() {
    setFormError(null);
    setFieldErrors(undefined);
    setSubmitting(true);
    try {
      if (!showcase) throw new Error("Showcase not loaded.");
      if (showcase.registrationStatus !== "open") throw new Error("Registration is not open.");

      const token = getAccessToken();
      const role = token ? getTokenRole(token) : null;

      const fe: FieldErrors = {};
      if (!fullName.trim()) fe.fullName = ["Full name is required."];
      if (!email.trim()) fe.email = ["Email is required."];
      if (Object.keys(fe).length > 0) {
        setFieldErrors(fe);
        return;
      }

      const body = { fullName: fullName.trim(), email: email.trim().toLowerCase(), ...(role ? { role } : {}) };

      const res = await apiFetch<{ url: string }>(`/showcases/${encodeURIComponent(showcase.slug || showcase.id)}/register`, {
        method: "POST",
        ...(token ? { token } : {}),
        body: JSON.stringify(body)
      });
      window.location.href = res.url;
    } catch (err) {
      const parsed = parseApiError(err);
      setFormError(parsed.formError ?? "Failed to start registration");
      setFieldErrors(parsed.fieldErrors);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/showcases" className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
          ← Back to showcases
        </Link>
        <Link href="/" className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
          Home
        </Link>
      </div>

      {success ? (
        <Card>
          <div className="text-lg font-semibold text-white">Registration submitted</div>
          <p className="mt-2 text-sm text-white/80">Thanks! If payment completed successfully, you’ll receive a confirmation email.</p>
        </Card>
      ) : null}
      {canceled ? (
        <Card>
          <div className="text-lg font-semibold text-white">Checkout canceled</div>
          <p className="mt-2 text-sm text-white/80">You can try again when you’re ready.</p>
        </Card>
      ) : null}

      {error ? (
        <Card>
          <p className="text-sm text-red-300">{error}</p>
        </Card>
      ) : null}

      {loading || !showcase ? (
        <Card>
          <p className="text-sm text-white/80">{loading ? "Loading..." : "Showcase not found."}</p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <Card>
            <h1 className="text-2xl font-semibold tracking-tight">{showcase.title}</h1>
            <div className="mt-2 text-sm text-white/80">
              {fmtDateTime(showcase.startDateTime)} – {fmtDateTime(showcase.endDateTime)} ({showcase.timezone})
            </div>

            <div className="mt-4 grid gap-2 text-sm text-white/80">
              <div>
                <span className="font-semibold text-white">Location:</span> {showcase.city}, {showcase.state} · {showcase.locationName}
              </div>
              <div>
                <span className="font-semibold text-white">Cost:</span> {fmtMoney(showcase.costCents, showcase.currency)}
              </div>
              <div className="flex flex-wrap gap-2">
                {(showcase.sportCategories ?? []).map((c) => (
                  <span key={c} className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-xs font-semibold text-white/80">
                    {c}
                  </span>
                ))}
              </div>
            </div>

            {showcase.description ? (
              <div className="mt-6">
                <h2 className="text-base font-semibold">Description</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm text-white/80">{showcase.description}</p>
              </div>
            ) : null}

            <div className="mt-6 grid gap-2 text-sm text-white/80">
              {mapUrl ? (
                <a href={mapUrl} target="_blank" rel="noreferrer" className="text-indigo-300 hover:text-indigo-200 hover:underline">
                  Open map directions
                </a>
              ) : null}
              <div className="text-xs text-white/70">
                Refund policy: refunds are subject to GoEducate policies (MVP placeholder).
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm text-white/70">Registration</div>
                <div className="mt-1 text-lg font-semibold text-white">{showcase.registrationStatusLabel}</div>
                {typeof showcase.capacity === "number" && typeof showcase.spotsRemaining === "number" ? (
                  <div className="mt-1 text-sm text-white/80">
                    Capacity: {showcase.capacity} · Remaining: {showcase.spotsRemaining}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-4">
              <FormErrorSummary formError={formError ?? undefined} fieldErrors={fieldErrors} />
            </div>

            <div className="mt-4 grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="fullName">Full name</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                <FieldError name="fullName" fieldErrors={fieldErrors} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <FieldError name="email" fieldErrors={fieldErrors} />
              </div>
            </div>

            <div className="mt-5">
              <Button type="button" disabled={submitting || showcase.registrationStatus !== "open"} onClick={register} className="w-full">
                {submitting ? "Redirecting..." : "Register"}
              </Button>
              {showcase.registrationStatus !== "open" ? (
                <div className="mt-2 text-xs text-white/70">Registration is not open for this showcase.</div>
              ) : null}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}


