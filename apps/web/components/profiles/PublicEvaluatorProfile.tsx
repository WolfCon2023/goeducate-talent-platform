"use client";

import * as React from "react";

import { Card } from "@/components/ui";
import { apiFetch, ApiFetchError } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";

type EvaluatorPublicProfile = {
  userId: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  bio?: string;
  experienceYears?: number;
  credentials?: string[];
  specialties?: string[];
};

export function PublicEvaluatorProfile(props: { userId: string }) {
  const [loading, setLoading] = React.useState(false);
  const [profile, setProfile] = React.useState<EvaluatorPublicProfile | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function run() {
      setLoading(true);
      setError(null);
      setNotFound(false);
      try {
        const token = getAccessToken();
        const res = await apiFetch<EvaluatorPublicProfile>(`/profiles/evaluator/${encodeURIComponent(props.userId)}`, {
          token: token ?? undefined
        });
        setProfile(res);
      } catch (err) {
        if (err instanceof ApiFetchError && err.status === 404) {
          setNotFound(true);
        } else {
          setError(err instanceof Error ? err.message : "Failed to load profile");
        }
      } finally {
        setLoading(false);
      }
    }
    void run();
  }, [props.userId]);

  if (notFound) {
    return (
      <Card>
        <h1 className="text-xl font-semibold">Evaluator profile not found</h1>
        <p className="mt-2 text-sm text-white/80">This profile is private or does not exist.</p>
      </Card>
    );
  }

  if (loading && !profile) {
    return (
      <Card>
        <div className="text-sm text-white/80">Loading profile…</div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <h1 className="text-xl font-semibold">Could not load profile</h1>
        <p className="mt-2 text-sm text-red-300">{error}</p>
      </Card>
    );
  }

  if (!profile) return null;

  const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Evaluator";

  return (
    <Card>
      <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
      <div className="mt-2 text-sm text-white/80">
        {profile.title ? profile.title : "Evaluator"}
        {typeof profile.experienceYears === "number" ? ` · ${profile.experienceYears} yrs experience` : ""}
      </div>

      {profile.bio ? <div className="mt-4 text-sm text-white/80 whitespace-pre-wrap">{profile.bio}</div> : null}

      <div className="mt-6 grid gap-3 text-sm text-white/80">
        {profile.specialties?.length ? (
          <div>
            <span className="text-white/60">Specialties:</span> {profile.specialties.join(", ")}
          </div>
        ) : null}
        {profile.credentials?.length ? (
          <div>
            <span className="text-white/60">Credentials:</span> {profile.credentials.join(", ")}
          </div>
        ) : null}
      </div>
    </Card>
  );
}


