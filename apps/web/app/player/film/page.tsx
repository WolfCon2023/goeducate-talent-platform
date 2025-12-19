import Link from "next/link";

import { FilmSubmissions } from "@/components/FilmSubmissions";
import { PlayerGuard } from "../Guard";

export default function PlayerFilmPage() {
  return (
    <PlayerGuard>
      <div className="grid gap-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Film submissions</h1>
            <p className="mt-2 text-sm text-white/80">Submit game film for evaluator review.</p>
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



