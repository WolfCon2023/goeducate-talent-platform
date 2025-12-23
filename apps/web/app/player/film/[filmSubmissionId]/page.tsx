"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Card, Button } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { PlayerGuard } from "../../Guard";

type FilmSubmission = {
  _id: string;
  title: string;
  opponent?: string;
  gameDate?: string;
  notes?: string;
  videoUrl?: string;
  status: string;
  createdAt?: string;
};

function fmtDate(iso?: string) {
  if (!iso) return "TBD";
  return new Date(iso).toLocaleString();
}

export default function PlayerFilmDetailPage() {
  const params = useParams<{ filmSubmissionId: string }>();
  const filmSubmissionId = String(params?.filmSubmissionId ?? "").trim();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [film, setFilm] = useState<FilmSubmission | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      setLoading(true);
      try {
        const token = getAccessToken();
        if (!token) throw new Error("Please login first.");
        const res = await apiFetch<FilmSubmission>(`/film-submissions/${encodeURIComponent(filmSubmissionId)}`, { token });
        if (!cancelled) setFilm(res);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load film");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (filmSubmissionId) void load();
    return () => {
      cancelled = true;
    };
  }, [filmSubmissionId]);

  return (
    <PlayerGuard>
      <div className="grid gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Film submission</h1>
          <Link href="/player/film" className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
            Back to submissions
          </Link>
        </div>

        {error ? (
          <Card>
            <div className="text-sm text-red-300">{error}</div>
          </Card>
        ) : null}

        {loading ? (
          <Card>
            <div className="text-sm text-white/80">Loading…</div>
          </Card>
        ) : null}

        {film ? (
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">{film.title}</div>
                <div className="mt-1 text-sm text-white/80">
                  Status: <span className="font-semibold text-white">{film.status}</span>
                </div>
                <div className="mt-1 text-sm text-white/80">Submitted: {fmtDate(film.createdAt)}</div>
                {film.opponent ? <div className="mt-1 text-sm text-white/80">Opponent: {film.opponent}</div> : null}
                {film.gameDate ? <div className="mt-1 text-sm text-white/80">Game date: {fmtDate(film.gameDate)}</div> : null}
              </div>
              {film.videoUrl ? (
                <a
                  href={film.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                >
                  View video
                </a>
              ) : null}
            </div>

            {film.notes ? (
              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-sm font-semibold">Notes</div>
                <div className="mt-2 whitespace-pre-wrap text-sm text-white/80">{film.notes}</div>
              </div>
            ) : null}

            <div className="mt-6">
              <Link href="/player/film">
                <Button type="button" className="border border-white/15 bg-white/5 text-white hover:bg-white/10">
                  Back
                </Button>
              </Link>
            </div>
          </Card>
        ) : null}
      </div>
    </PlayerGuard>
  );
}


