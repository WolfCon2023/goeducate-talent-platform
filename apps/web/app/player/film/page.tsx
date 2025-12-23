"use client";

import Link from "next/link";

import { FilmSubmissions } from "@/components/FilmSubmissions";
import { PlayerGuard } from "../Guard";

export default function PlayerFilmPage() {
  return (
    <PlayerGuard>
      <div className="grid gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Film submissions</h1>
          <Link href="/player" className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
            Back to dashboard
          </Link>
        </div>

        <FilmSubmissions />
      </div>
    </PlayerGuard>
  );
}


