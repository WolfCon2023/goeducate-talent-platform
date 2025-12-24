"use client";

import * as React from "react";

import { Card } from "@/components/ui";
import { apiFetch, ApiFetchError } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";

type CoachPublicProfile = {
  userId: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  institutionName?: string;
  programLevel?: string;
  institutionLocation?: string;
  positionsOfInterest?: string[];
  gradYears?: number[];
  regions?: string[];
};

export function PublicCoachProfile(props: { userId: string }) {
  const [loading, setLoading] = React.useState(false);
  const [profile, setProfile] = React.useState<CoachPublicProfile | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function run() {
      setLoading(true);
      setError(null);
      setNotFound(false);
      try {
        const token = getAccessToken();
        const res = await apiFetch<CoachPublicProfile>(`/profiles/coach/${encodeURIComponent(props.userId)}`, {
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
        <h1 className="text-xl font-semibold">Coach profile not found</h1>
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

  const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Coach";

  return (
    <Card>
      <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
      <div className="mt-2 text-sm text-white/80">
        {profile.title ? profile.title : "Coach"}{" "}
        {profile.institutionName ? `· ${profile.institutionName}` : ""}
      </div>
      <div className="mt-1 text-sm text-white/70">
        {profile.programLevel ? profile.programLevel : ""}
        {profile.programLevel && profile.institutionLocation ? " · " : ""}
        {profile.institutionLocation ? profile.institutionLocation : ""}
      </div>

      <div className="mt-6 grid gap-3 text-sm text-white/80">
        {profile.positionsOfInterest?.length ? (
          <div>
            <span className="text-white/60">Positions of interest:</span> {profile.positionsOfInterest.join(", ")}
          </div>
        ) : null}
        {profile.gradYears?.length ? (
          <div>
            <span className="text-white/60">Grad years:</span> {profile.gradYears.join(", ")}
          </div>
        ) : null}
        {profile.regions?.length ? (
          <div>
            <span className="text-white/60">Regions:</span> {profile.regions.join(", ")}
          </div>
        ) : null}
      </div>
    </Card>
  );
}


