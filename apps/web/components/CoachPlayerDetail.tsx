"use client";

import { useEffect, useState } from "react";

import { Card, Button } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";

type PlayerProfile = {
  userId: string;
  firstName: string;
  lastName: string;
  position: string;
  gradYear: number;
  city: string;
  state: string;
  heightIn?: number;
  weightLb?: number;
};

type FilmSubmission = {
  _id: string;
  title: string;
  opponent?: string;
  gameDate?: string;
  status: string;
  videoUrl?: string;
  notes?: string;
};

type EvaluationReport = {
  _id: string;
  filmSubmissionId: string;
  overallGrade: number;
  strengths: string;
  improvements: string;
  notes?: string;
  createdAt?: string;
};

type ContactInfo = {
  contactEmail: string | null;
  contactPhone: string | null;
};

function formatHeight(heightIn?: number) {
  if (typeof heightIn !== "number" || !Number.isFinite(heightIn) || heightIn <= 0) return null;
  const ft = Math.floor(heightIn / 12);
  const inches = heightIn % 12;
  return `${ft}'${inches}"`;
}

export function CoachPlayerDetail(props: { userId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [films, setFilms] = useState<FilmSubmission[]>([]);
  const [evals, setEvals] = useState<EvaluationReport[]>([]);
  const [contact, setContact] = useState<ContactInfo | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);
  const [viewerRole, setViewerRole] = useState<string | null>(null);

  async function load(userId: string) {
    setError(null);
    setLoading(true);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login as a coach first.");
      if (role !== "coach" && role !== "admin" && role !== "evaluator") throw new Error("Insufficient permissions.");
      setViewerRole(role ?? null);

      const p = await apiFetch<PlayerProfile>(`/player-profiles/player/${userId}`, { token });
      const f = await apiFetch<{ results: FilmSubmission[] }>(`/film-submissions/player/${userId}`, { token });
      const e = await apiFetch<{ results: EvaluationReport[] }>(`/evaluations/player/${userId}`, { token });

      setProfile(p);
      setFilms(f.results);
      setEvals(e.results);
      setContact(null);
      setContactError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load player");
    } finally {
      setLoading(false);
    }
  }

  async function loadContact() {
    setContactError(null);
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Please login as a coach first.");
      const c = await apiFetch<ContactInfo>(`/contact/player/${props.userId}`, { token });
      setContact(c);
    } catch (err) {
      setContact(null);
      setContactError(err instanceof Error ? err.message : "Failed to load contact info");
    }
  }

  useEffect(() => {
    void load(props.userId);
  }, [props.userId]);

  return (
    <div className="grid gap-6">
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Overview</h2>
            <p className="mt-1 text-sm text-white/80">Player profile, film, evaluations, and subscription-gated contact info.</p>
          </div>
          <Button type="button" onClick={() => load(props.userId)} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

        {profile ? (
          <div className="mt-6 text-sm text-white/90">
            <div className="text-base font-semibold">
              {profile.firstName} {profile.lastName}
            </div>
            <div className="mt-1 text-white/80">
              {profile.position} · {profile.gradYear} · {profile.city}, {profile.state}
              {profile.heightIn ? ` · ${formatHeight(profile.heightIn)}` : ""}
              {profile.weightLb ? ` · ${profile.weightLb} lb` : ""}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-white/70">{loading ? "Loading..." : "No profile found."}</p>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Film submissions</h2>
        <div className="mt-4 grid gap-3">
          {films.map((s) => (
            <div key={s._id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="font-semibold">{s.title}</div>
                <div
                  className={`text-xs uppercase tracking-wide ${
                    s.status === "completed"
                      ? "text-emerald-300"
                      : s.status === "in_review"
                        ? "text-amber-300"
                        : "text-white/70"
                  }`}
                >
                  {s.status.replace("_", " ")}
                </div>
              </div>
              <div className="mt-1 text-sm text-white/80">
                {s.opponent ? <>Opponent: {s.opponent}</> : null}
                {s.opponent && s.gameDate ? " · " : null}
                {s.gameDate ? <>Game date: {new Date(s.gameDate).toLocaleDateString()}</> : null}
              </div>
              {s.videoUrl ? (
                <div className="mt-2 text-sm">
                  <a className="text-indigo-300 hover:text-indigo-200 hover:underline" href={s.videoUrl} target="_blank" rel="noreferrer">
                    View video link
                  </a>
                </div>
              ) : null}
              {s.notes ? <p className="mt-2 text-sm text-white/80">{s.notes}</p> : null}
            </div>
          ))}
          {films.length === 0 ? <p className="text-sm text-white/70">No film submissions yet.</p> : null}
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Evaluations</h2>
        <div className="mt-4 grid gap-3">
          {evals.map((r) => (
            <div key={r._id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="font-semibold">Grade: {r.overallGrade}/10</div>
                <div className="text-xs text-white/60">{r.createdAt ? new Date(r.createdAt).toLocaleString() : ""}</div>
              </div>
              <div className="mt-3 grid gap-3 text-sm text-white/90">
                <div>
                  <div className="text-xs uppercase tracking-wide text-white/70">Strengths</div>
                  <div className="mt-1 whitespace-pre-wrap">{r.strengths}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-white/70">Improvements</div>
                  <div className="mt-1 whitespace-pre-wrap">{r.improvements}</div>
                </div>
                {r.notes ? (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-white/70">Notes</div>
                    <div className="mt-1 whitespace-pre-wrap">{r.notes}</div>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
          {evals.length === 0 ? <p className="text-sm text-white/70">No evaluations yet.</p> : null}
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Contact info</h2>
        <p className="mt-1 text-sm text-white/80">Coaches require an active subscription to view contact details.</p>

        {viewerRole === "evaluator" ? (
          <p className="mt-4 text-sm text-white/70">Evaluators do not have access to player contact info.</p>
        ) : (
          <>
            <div className="mt-4 flex items-center gap-3">
              <Button type="button" onClick={loadContact} disabled={loading}>
                {contact ? "Refresh contact info" : "View contact info"}
              </Button>
              {contactError ? <p className="text-sm text-red-300">{contactError}</p> : null}
            </div>

            {contact ? (
              <div className="mt-4 text-sm text-white/90">
                <div>Email: {contact.contactEmail ?? "Not provided"}</div>
                <div className="mt-1">Phone: {contact.contactPhone ?? "Not provided"}</div>
              </div>
            ) : contactError?.toLowerCase().includes("subscription required") ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm font-semibold text-white/90">Locked</div>
                <p className="mt-1 text-sm text-white/80">
                  Upgrade to view this player’s contact email and phone. (Billing integration coming next.)
                </p>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm font-semibold text-white/90">Not loaded</div>
                <p className="mt-1 text-sm text-white/70">Click “View contact info” to load contact details.</p>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}


