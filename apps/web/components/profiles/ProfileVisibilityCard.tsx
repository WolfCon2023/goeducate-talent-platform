"use client";

import * as React from "react";

import { Card, Button } from "@/components/ui";
import { apiFetch, ApiFetchError } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";
import { toast } from "@/components/ToastProvider";
import { ProfileCompletionMeter } from "./ProfileCompletionMeter";

type ProfileMeResponse = {
  profile: { isProfilePublic?: boolean; isContactVisibleToSubscribedCoaches?: boolean } & Record<string, unknown>;
  profileCompletion: { score: number; missing: string[] };
};

export function ProfileVisibilityCard(props: {
  title?: string;
  helpText?: string;
  showContactToggle?: boolean;
}) {
  const role = getTokenRole();
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<ProfileMeResponse | null>(null);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Please login first.");

      // Player profiles have required fields and are created via the existing Player profile form.
      // Avoid calling /profiles/me before the player profile exists to prevent noisy 404s.
      if (role === "player") {
        try {
          await apiFetch("/player-profiles/me", { token });
        } catch (err) {
          if (err instanceof ApiFetchError && err.status === 404) {
            setData(null);
            setError("Save your player profile below to enable visibility and contact settings.");
            return;
          }
        }
      }

      const res = await apiFetch<ProfileMeResponse>("/profiles/me", { token });
      setData(res);
    } catch (err) {
      if (err instanceof ApiFetchError && err.status === 404) {
        setData(null);
        setError("No profile found yet. Please complete and save your profile first.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to load profile settings");
      }
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void load();
    const onSaved = () => void load();
    window.addEventListener("goeducate:profile-saved", onSaved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => window.removeEventListener("goeducate:profile-saved", onSaved);
  }, []);

  async function savePatch(patch: Record<string, unknown>) {
    setError(null);
    setSaving(true);
    try {
      const token = getAccessToken();
      if (!token) throw new Error("Please login first.");
      const res = await apiFetch<ProfileMeResponse>("/profiles/me", { method: "PUT", token, body: JSON.stringify(patch) });
      setData(res);
      toast({ kind: "success", title: "Saved", message: "Profile settings updated." });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const isProfilePublic = Boolean(data?.profile?.isProfilePublic);
  const isContactVisible = Boolean(data?.profile?.isContactVisibleToSubscribedCoaches);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{props.title ?? "Profile visibility"}</h2>
          <p className="mt-1 text-sm text-white/80">
            {props.helpText ??
              "Public profiles are discoverable and accessible via public URLs. Private profiles return a 404 to unauthorized viewers."}
          </p>
        </div>
        <Button
          type="button"
          className="border border-white/15 bg-white/5 text-white hover:bg-white/10"
          onClick={load}
          disabled={loading || saving}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {data?.profileCompletion ? (
        <div className="mt-6">
          <ProfileCompletionMeter score={data.profileCompletion.score} missing={data.profileCompletion.missing} />
        </div>
      ) : null}

      {error ? <div className="mt-5 text-sm text-red-300">{error}</div> : null}

      <div className="mt-6 grid gap-3">
        <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-indigo-500"
            checked={isProfilePublic}
            disabled={!data?.profile || saving}
            onChange={(e) => void savePatch({ isProfilePublic: e.target.checked })}
          />
          <div>
            <div className="text-sm font-semibold text-white">Public profile</div>
            <div className="mt-1 text-sm text-white/70">
              When enabled, your profile can appear in search and be viewed via a shareable URL.
            </div>
          </div>
        </label>

        {props.showContactToggle && role === "player" ? (
          <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-indigo-500"
              checked={isContactVisible}
              disabled={!data?.profile || saving}
              onChange={(e) => void savePatch({ isContactVisibleToSubscribedCoaches: e.target.checked })}
            />
            <div>
              <div className="text-sm font-semibold text-white">Allow subscribed coaches to see my contact info</div>
              <div className="mt-1 text-sm text-white/70">
                When enabled, coaches with an active subscription can view your contact email and phone.
              </div>
            </div>
          </label>
        ) : null}
      </div>
    </Card>
  );
}


