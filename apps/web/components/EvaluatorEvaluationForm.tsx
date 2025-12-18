"use client";

import { useMemo, useState } from "react";

import { Button, Card, Input, Label } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";

type FilmSubmission = {
  _id: string;
  userId: string;
  title: string;
  opponent?: string;
  gameDate?: string;
  status: string;
};

type PlayerProfile = {
  firstName: string;
  lastName: string;
  position: string;
  gradYear: number;
  city: string;
  state: string;
};

export function EvaluatorEvaluationForm(props: { filmSubmissionId: string }) {
  const [overallGrade, setOverallGrade] = useState(7);
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [film, setFilm] = useState<FilmSubmission | null>(null);
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);

  const canSubmit = useMemo(() => !!film?.userId && strengths.trim() && improvements.trim(), [film, strengths, improvements]);

  async function loadMeta() {
    setStatus(null);
    setLoadingMeta(true);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "evaluator" && role !== "admin") throw new Error("Insufficient permissions.");

      const filmRes = await apiFetch<FilmSubmission>(`/film-submissions/${props.filmSubmissionId}`, { token });
      setFilm(filmRes);

      const profileRes = await apiFetch<PlayerProfile>(`/player-profiles/player/${filmRes.userId}`, { token });
      setPlayer(profileRes);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to load film metadata");
    } finally {
      setLoadingMeta(false);
    }
  }

  async function submit() {
    setStatus(null);
    setSaving(true);
    try {
      const token = getAccessToken();
      const role = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (role !== "evaluator" && role !== "admin") throw new Error("Insufficient permissions.");
      if (!film?.userId) throw new Error("Missing film metadata. Click 'Load details' first.");

      await apiFetch("/evaluations", {
        method: "POST",
        token,
        body: JSON.stringify({
          filmSubmissionId: props.filmSubmissionId,
          overallGrade,
          strengths,
          improvements,
          notes: notes || undefined
        })
      });

      setStatus("Evaluation submitted.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to submit evaluation");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="grid gap-2">
        <div className="text-sm text-slate-300">
          Film:{" "}
          <span className="text-slate-100">
            {film ? `${film.title}${film.opponent ? ` vs ${film.opponent}` : ""}` : "(not loaded)"}
          </span>
        </div>
        <div className="text-sm text-slate-300">
          Player:{" "}
          <span className="text-slate-100">
            {player
              ? `${player.firstName} ${player.lastName} · ${player.position} · ${player.gradYear} · ${player.city}, ${player.state}`
              : "(not loaded)"}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <Button type="button" onClick={loadMeta} disabled={loadingMeta}>
            {loadingMeta ? "Loading details..." : film ? "Reload details" : "Load details"}
          </Button>
          <span className="text-xs text-slate-400">We fetch this from the API so it stays correct and secure.</span>
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="grade">Overall grade (1-10)</Label>
          <Input
            id="grade"
            type="number"
            min={1}
            max={10}
            value={overallGrade}
            onChange={(e) => setOverallGrade(Number(e.target.value))}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="strengths">Strengths</Label>
          <textarea
            id="strengths"
            className="min-h-28 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400"
            value={strengths}
            onChange={(e) => setStrengths(e.target.value)}
            placeholder="What stood out positively..."
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="improvements">Improvements</Label>
          <textarea
            id="improvements"
            className="min-h-28 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400"
            value={improvements}
            onChange={(e) => setImprovements(e.target.value)}
            placeholder="What to improve next..."
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="notes">Notes (optional)</Label>
          <textarea
            id="notes"
            className="min-h-28 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Button type="button" onClick={submit} disabled={saving || !canSubmit}>
          {saving ? "Submitting..." : "Submit evaluation"}
        </Button>
        {status ? <p className="text-sm text-slate-300">{status}</p> : null}
      </div>
    </Card>
  );
}


