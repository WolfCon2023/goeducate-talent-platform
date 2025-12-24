"use client";

import * as React from "react";

import { Card } from "@/components/ui";
import { apiFetch, ApiFetchError } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";

type PlayerPublicProfile = {
  userId: string;
  firstName: string;
  lastName: string;
  sport?: string;
  position?: string;
  gradYear?: number;
  school?: string;
  city?: string;
  state?: string;
  highlightPhotoUrl?: string;
  hudlLink?: string;
  contactEmail?: string;
  contactPhone?: string;
};

export function PublicPlayerProfile(props: { userId: string }) {
  const [loading, setLoading] = React.useState(false);
  const [profile, setProfile] = React.useState<PlayerPublicProfile | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function run() {
      setLoading(true);
      setError(null);
      setNotFound(false);
      try {
        const token = getAccessToken();
        const res = await apiFetch<PlayerPublicProfile>(`/profiles/player/${encodeURIComponent(props.userId)}`, {
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
        <h1 className="text-xl font-semibold">Player profile not found</h1>
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

  return (
    <div className="grid gap-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {profile.firstName} {profile.lastName}
            </h1>
            <div className="mt-2 text-sm text-white/80">
              {profile.position ? profile.position : "Position —"}{" "}
              {profile.gradYear ? `· Class of ${profile.gradYear}` : ""}
            </div>
            <div className="mt-1 text-sm text-white/70">
              {profile.school ? `${profile.school}` : ""}
              {profile.school && (profile.city || profile.state) ? " · " : ""}
              {profile.city ? profile.city : ""}
              {profile.city && profile.state ? ", " : ""}
              {profile.state ? profile.state : ""}
            </div>
          </div>
          {profile.highlightPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.highlightPhotoUrl}
              alt={`${profile.firstName} ${profile.lastName}`}
              className="h-24 w-24 rounded-xl object-cover border border-white/10"
            />
          ) : null}
        </div>

        {profile.hudlLink ? (
          <div className="mt-4 text-sm">
            <a className="text-indigo-300 hover:text-indigo-200 hover:underline" href={profile.hudlLink} target="_blank" rel="noreferrer">
              Highlights / HUDL →
            </a>
          </div>
        ) : null}
      </Card>

      <Card>
        <div className="text-sm font-semibold">Contact</div>
        {profile.contactEmail || profile.contactPhone ? (
          <div className="mt-3 grid gap-2 text-sm text-white/80">
            {profile.contactEmail ? (
              <div>
                Email:{" "}
                <a className="text-indigo-300 hover:underline" href={`mailto:${profile.contactEmail}`}>
                  {profile.contactEmail}
                </a>
              </div>
            ) : null}
            {profile.contactPhone ? (
              <div>
                Phone:{" "}
                <a className="text-indigo-300 hover:underline" href={`tel:${profile.contactPhone}`}>
                  {profile.contactPhone}
                </a>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-2 text-sm text-white/70">Contact info is not available.</div>
        )}
      </Card>
    </div>
  );
}


