"use client";

import Link from "next/link";

import { FilmSubmissions } from "@/components/FilmSubmissions";
import { PlayerGuard } from "../Guard";
import { HelpIcon } from "@/components/kb/HelpIcon";

export default function PlayerFilmPage() {
  return (
    <PlayerGuard>
      <div className="grid gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Film submissions</h1>
            <HelpIcon helpKey="player.film.submit" title="Submitting film" />
          </div>
          <Link href="/player" className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
            Back to dashboard
          </Link>
        </div>

        <FilmSubmissions />
      </div>
    </PlayerGuard>
  );
}


