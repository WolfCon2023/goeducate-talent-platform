"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useConfirm } from "@/components/ConfirmDialog";
import { toast } from "@/components/ToastProvider";
import { Button, Card, RefreshIconButton } from "@/components/ui";
import { apiFetch, ApiFetchError } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";

type PlayerProfile = {
  _id: string;
  userId: string;
  firstName: string;
  lastName: string;
  sport?: string;
  position: string;
  gradYear: number;
  state: string;
  city: string;
  heightIn?: number;
  weightLb?: number;
  hudlLink?: string;
};

type ContactInfo = {
  contactEmail: string | null;
  contactPhone: string | null;
};

type FilmSubmission = {
  _id: string;
  title: string;
  status: string;
  createdAt?: string;
};

type EvalSummary = {
  filmSubmissionId: string;
  overallGrade: number;
  createdAt?: string;
};

function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export function CoachPlayerProfile(props: { userId: string }) {
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [playerEmail, setPlayerEmail] = useState<string | null>(null);
  const [contact, setContact] = useState<ContactInfo | null>(null);
  const [contactBlocked, setContactBlocked] = useState<"subscription" | "other" | null>(null);
  const [films, setFilms] = useState<FilmSubmission[]>([]);
  const [evalByFilmId, setEvalByFilmId] = useState<Record<string, EvalSummary | null>>({});
  const [requesting, setRequesting] = useState(false);

  async function load() {
    setError(null);
    setLoading(true);
    setContactBlocked(null);
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Please login as a coach first.");

      const p = await apiFetch<PlayerProfile>(`/player-profiles/player/${encodeURIComponent(props.userId)}`, { token });
      setProfile(p);
      // Best-effort: we don't currently have a dedicated endpoint to fetch the player's user record,
      // so keep email optional here. If we later add it, we can wire it in.
      setPlayerEmail(null);

      const filmsRes = await apiFetch<{ results: FilmSubmission[] }>(`/film-submissions/player/${encodeURIComponent(props.userId)}`, { token });
      setFilms(filmsRes.results ?? []);

      // Prefetch evaluation summaries for completed items (cap).
      const completed = (filmsRes.results ?? []).filter((f) => f.status === "completed").slice(0, 10);
      await Promise.all(
        completed.map(async (f) => {
          if (evalByFilmId[f._id] !== undefined) return;
          const r = await apiFetch<EvalSummary>(`/evaluations/film/${encodeURIComponent(f._id)}`, { token }).catch(() => null);
          setEvalByFilmId((prev) => ({ ...prev, [f._id]: r }));
        })
      );

      try {
        const c = await apiFetch<ContactInfo>(`/contact/player/${encodeURIComponent(props.userId)}`, { token });
        setContact(c);
      } catch (err) {
        if (err instanceof ApiFetchError && err.status === 402) {
          setContactBlocked("subscription");
        } else {
          setContactBlocked("other");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load player");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.userId]);

  async function requestContact() {
    try {
      const ok = await confirm({
        title: "Request contact?",
        message:
          "We will notify the player that you want to connect, including your coach account email so they can reach you.",
        confirmText: "Send request",
        cancelText: "Cancel"
      });
      if (!ok) return;

      setRequesting(true);
      const token = getAccessToken();
      if (!token) throw new Error("Please login as a coach first.");
      await apiFetch(`/contact/player/${encodeURIComponent(props.userId)}/request`, { method: "POST", token });
      toast({ kind: "success", title: "Request sent", message: "The player has been notified." });
    } catch (err) {
      toast({ kind: "error", title: "Request failed", message: err instanceof Error ? err.message : "Could not send request." });
    } finally {
      setRequesting(false);
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-[color:var(--foreground)]">Player profile</div>
          <div className="mt-1 text-sm text-[color:var(--muted)]">
            {profile ? (
              <span className="text-[color:var(--foreground)]">
                {profile.firstName} {profile.lastName}
                {playerEmail ? <span className="text-[color:var(--muted)]"> · {playerEmail}</span> : null}
              </span>
            ) : loading ? (
              "Loading…"
            ) : (
              "—"
            )}
          </div>
          <div className="mt-1 text-xs text-[color:var(--muted-2)]">ID: {props.userId}</div>
        </div>
        <RefreshIconButton onClick={load} loading={loading} />
      </div>

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

      {profile ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] p-4">
            <div className="text-lg font-semibold">
              {profile.firstName} {profile.lastName}
            </div>
            <div className="mt-2 text-sm text-[color:var(--muted)]">
              {(profile.sport ? `${profile.sport} · ` : "") + `${profile.position} · ${profile.gradYear}`}
              {" · "}
              {profile.city}, {profile.state}
              {typeof profile.heightIn === "number" ? ` · ${profile.heightIn} in` : ""}
              {typeof profile.weightLb === "number" ? ` · ${profile.weightLb} lb` : ""}
            </div>
            {profile.hudlLink ? (
              <div className="mt-3 text-sm">
                <a className="text-indigo-300 hover:text-indigo-200 hover:underline" href={profile.hudlLink} target="_blank" rel="noreferrer">
                  HUDL / highlights
                </a>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] p-4">
            <div className="text-sm font-semibold text-[color:var(--foreground)]">Contact info</div>
            <div className="mt-2 text-sm text-[color:var(--muted)]">
              {contact ? (
                <div className="grid gap-1">
                  <div>
                    Email:{" "}
                    {contact.contactEmail ? (
                      <a className="text-indigo-300 hover:underline" href={`mailto:${contact.contactEmail}`}>
                        {contact.contactEmail}
                      </a>
                    ) : (
                      "—"
                    )}
                  </div>
                  <div>
                    Phone:{" "}
                    {contact.contactPhone ? (
                      <a className="text-indigo-300 hover:underline" href={`tel:${contact.contactPhone}`}>
                        {contact.contactPhone}
                      </a>
                    ) : (
                      "—"
                    )}
                  </div>
                </div>
              ) : contactBlocked === "subscription" ? (
                <div>
                  Subscription required to view contact info.{" "}
                  <Link className="text-indigo-300 hover:text-indigo-200 hover:underline" href="/coach/billing">
                    Manage / Upgrade
                  </Link>
                  <div className="mt-3">
                    <Button type="button" onClick={() => void requestContact()} disabled={requesting}>
                      {requesting ? "Sending..." : "Request contact from player"}
                    </Button>
                    <div className="mt-2 text-xs text-[color:var(--muted-2)]">
                      We’ll send the player a notification with your coach email so they can reach out if they choose.
                    </div>
                  </div>
                </div>
              ) : contactBlocked === "other" ? (
                <div>Contact info unavailable.</div>
              ) : (
                <div className="text-[color:var(--muted)]">—</div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] p-4 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[color:var(--foreground)]">Film & evaluations</div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">Submissions and completed evaluations for this player.</div>
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {films.map((f) => (
                <div key={f._id} className="rounded-xl border border-[color:var(--border)] bg-[var(--surface-soft)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-[color:var(--foreground)]">{f.title}</div>
                      <div className="mt-1 text-sm text-[color:var(--muted)]">
                        Status: <span className="text-[color:var(--foreground)]">{f.status}</span> · Submitted: {fmtDate(f.createdAt)}
                      </div>
                      {f.status === "completed" ? (
                        <div className="mt-1 text-sm text-[color:var(--muted)]">
                          Grade:{" "}
                          <span className="text-[color:var(--foreground)]">
                            {evalByFilmId[f._id]?.overallGrade != null ? `${evalByFilmId[f._id]!.overallGrade}/10` : "—"}
                          </span>
                        </div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3">
                      <Link className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline" href={`/coach/film/${encodeURIComponent(f._id)}?view=evaluation`}>
                        Open
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
              {films.length === 0 ? <div className="text-sm text-[color:var(--muted)]">No film submissions found.</div> : null}
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}


