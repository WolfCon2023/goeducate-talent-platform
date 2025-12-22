"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Card, Button, Input, Label } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";
import { FormErrorSummary, FieldError } from "@/components/FormErrors";
import { parseApiError, type FieldErrors } from "@/lib/formErrors";
import { ShowcasesGuard } from "../Guard";

type Showcase = {
  id: string;
  slug: string;
  title: string;
  description: string;
  refundPolicy?: string;
  weatherClause?: string;
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
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [refundAccepted, setRefundAccepted] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [weatherOpen, setWeatherOpen] = useState(false);
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
        const token = getAccessToken();
        if (!token) throw new Error("Please login first.");
        const res = await apiFetch<Showcase>(`/showcases/${encodeURIComponent(idOrSlug)}`, { token });
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
      if (!waiverAccepted) fe.waiverAccepted = ["You must accept the waiver to continue."];
      if (!refundAccepted) fe.refundPolicyAccepted = ["You must accept the Refund Policy and Weather Policy to continue."];
      if (Object.keys(fe).length > 0) {
        setFieldErrors(fe);
        return;
      }

      const body = {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        waiverAccepted: true as const,
        waiverVersion: "v1",
        refundPolicyAccepted: true as const,
        refundPolicyVersion: "v1",
        ...(role ? { role } : {})
      };

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
    <ShowcasesGuard>
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
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm font-semibold text-white">Refund policy</div>
                <p className="mt-2 text-sm text-white/80">
                  All showcase registration fees are <span className="font-semibold text-white">non-refundable</span> unless expressly stated otherwise in writing by GoEducate, Inc.
                </p>
                <div className="mt-3 grid gap-2">
                  <button
                    type="button"
                    className="text-left text-sm text-indigo-300 hover:text-indigo-200 hover:underline"
                    onClick={() => setPolicyOpen((v) => !v)}
                  >
                    {policyOpen ? "Hide full Refund Policy" : "View full Refund Policy"}
                  </button>
                  {policyOpen ? (
                    <pre className="whitespace-pre-wrap rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white/80">
                      {showcase.refundPolicy || "Refund Policy is not set yet."}
                    </pre>
                  ) : null}

                  <button
                    type="button"
                    className="text-left text-sm text-indigo-300 hover:text-indigo-200 hover:underline"
                    onClick={() => setWeatherOpen((v) => !v)}
                  >
                    {weatherOpen ? "Hide Weather Clause" : "View Weather Clause"}
                  </button>
                  {weatherOpen ? (
                    <pre className="whitespace-pre-wrap rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white/80">
                      {showcase.weatherClause || "Weather Clause is not set yet."}
                    </pre>
                  ) : null}
                </div>
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

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-semibold text-white">Waiver</div>
              <p className="mt-2 text-sm text-white/80">
                By registering for and participating in this GoEducate showcase event, you acknowledge and agree to the following:
              </p>
              <div className="mt-3 grid gap-2 text-sm text-white/80">
                <p>
                  Participation in athletic showcase events involves physical activity that may carry inherent risks, including but not limited to physical injury, illness, or other harm. You voluntarily choose to participate and assume full responsibility for any risks associated with attendance and participation.
                </p>
                <p>
                  You agree to release, waive, and hold harmless GoEducate, Inc., its officers, employees, representatives, and agents from any and all claims, liabilities, damages, or losses arising from or related to participation in this showcase, except as required by law.
                </p>
                <p>
                  You confirm that you are physically capable of participating and that you have not been advised otherwise by a medical professional. If the participant is a minor, you confirm that you are the parent or legal guardian and consent to the minor’s participation.
                </p>
                <p>
                  You acknowledge that this is a waiver placeholder and that a more detailed legal waiver may be required prior to or at the event.
                </p>
                <p className="text-xs text-white/70">
                  By checking the box below, you confirm that you have read, understand, and agree to this waiver.
                </p>
              </div>
              <label className="mt-3 inline-flex items-start gap-2 text-sm text-white/80">
                <input type="checkbox" checked={waiverAccepted} onChange={(e) => setWaiverAccepted(e.target.checked)} />
                <span>I have read and agree to the waiver.</span>
              </label>
              <div className="mt-1">
                <FieldError name="waiverAccepted" fieldErrors={fieldErrors} />
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-semibold text-white">Refund & Weather policy</div>
              <p className="mt-2 text-sm text-white/80">
                I have read and agree to the Refund Policy and Weather Policy.
              </p>
              <label className="mt-3 inline-flex items-start gap-2 text-sm text-white/80">
                <input type="checkbox" checked={refundAccepted} onChange={(e) => setRefundAccepted(e.target.checked)} />
                <span>I agree to the Refund Policy and Weather Policy.</span>
              </label>
              <div className="mt-1">
                <FieldError name="refundPolicyAccepted" fieldErrors={fieldErrors} />
              </div>
            </div>

            <div className="mt-5">
              <Button
                type="button"
                disabled={submitting || showcase.registrationStatus !== "open" || !waiverAccepted || !refundAccepted}
                onClick={register}
                className="w-full"
              >
                {submitting ? "Redirecting..." : "Register"}
              </Button>
              {showcase.registrationStatus !== "open" ? (
                <div className="mt-2 text-xs text-white/70">Registration is not open for this showcase.</div>
              ) : null}
              {showcase.registrationStatus === "open" && !waiverAccepted ? (
                <div className="mt-2 text-xs text-white/70">Accept the waiver to enable registration.</div>
              ) : null}
              {showcase.registrationStatus === "open" && waiverAccepted && !refundAccepted ? (
                <div className="mt-2 text-xs text-white/70">Accept the Refund & Weather policy to enable registration.</div>
              ) : null}
            </div>
          </Card>
        </div>
      )}
      </div>
    </ShowcasesGuard>
  );
}


