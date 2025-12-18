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

export function CoachPlayerDetail(props: { userId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [films, setFilms] = useState<FilmSubmission[]>([]);
  const [evals, setEvals] = useState<EvaluationReport[]>([]);

  async function load(userId: string) {
    setError(null);
    setLoading(true);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login as a coach first.");
      if (role !== "coach" && role !== "admin" && role !== "evaluator") throw new Error("Insufficient permissions.");

      const p = await apiFetch<PlayerProfile>(`/player-profiles/player/${userId}`, { token });
      const f = await apiFetch<{ results: FilmSubmission[] }>(`/film-submissions/player/${userId}`, { token });
      const e = await apiFetch<{ results: EvaluationReport[] }>(`/evaluations/player/${userId}`, { token });

      setProfile(p);
      setFilms(f.results);
      setEvals(e.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load player");
    } finally {
      setLoading(false);
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
            <p className="mt-1 text-sm text-slate-300">Coach visibility and contact gating can be added later.</p>
          </div>
          <Button type="button" onClick={() => load(props.userId)} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

        {profile ? (
          <div className="mt-6 text-sm text-slate-200">
            <div className="text-base font-semibold">
              {profile.firstName} {profile.lastName}
            </div>
            <div className="mt-1 text-slate-300">
              {profile.position} · {profile.gradYear} · {profile.city}, {profile.state}
              {profile.heightIn ? ` · ${profile.heightIn} in` : ""}
              {profile.weightLb ? ` · ${profile.weightLb} lb` : ""}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-400">{loading ? "Loading..." : "No profile found."}</p>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Film submissions</h2>
        <div className="mt-4 grid gap-3">
          {films.map((s) => (
            <div key={s._id} className="rounded-lg border border-slate-800 bg-slate-950 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="font-semibold">{s.title}</div>
                <div className="text-xs uppercase tracking-wide text-slate-400">{s.status}</div>
              </div>
              <div className="mt-1 text-sm text-slate-300">
                {s.opponent ? <>Opponent: {s.opponent}</> : null}
                {s.opponent && s.gameDate ? " · " : null}
                {s.gameDate ? <>Game date: {new Date(s.gameDate).toLocaleDateString()}</> : null}
              </div>
              {s.videoUrl ? (
                <div className="mt-2 text-sm">
                  <a className="text-slate-200 underline hover:text-white" href={s.videoUrl} target="_blank" rel="noreferrer">
                    View video link
                  </a>
                </div>
              ) : null}
              {s.notes ? <p className="mt-2 text-sm text-slate-300">{s.notes}</p> : null}
            </div>
          ))}
          {films.length === 0 ? <p className="text-sm text-slate-400">No film submissions yet.</p> : null}
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Evaluations</h2>
        <div className="mt-4 grid gap-3">
          {evals.map((r) => (
            <div key={r._id} className="rounded-lg border border-slate-800 bg-slate-950 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="font-semibold">Grade: {r.overallGrade}/10</div>
                <div className="text-xs text-slate-500">{r.createdAt ? new Date(r.createdAt).toLocaleString() : ""}</div>
              </div>
              <div className="mt-3 grid gap-3 text-sm text-slate-200">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-400">Strengths</div>
                  <div className="mt-1 whitespace-pre-wrap">{r.strengths}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-400">Improvements</div>
                  <div className="mt-1 whitespace-pre-wrap">{r.improvements}</div>
                </div>
                {r.notes ? (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-slate-400">Notes</div>
                    <div className="mt-1 whitespace-pre-wrap">{r.notes}</div>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
          {evals.length === 0 ? <p className="text-sm text-slate-400">No evaluations yet.</p> : null}
        </div>
      </Card>
    </div>
  );
}


