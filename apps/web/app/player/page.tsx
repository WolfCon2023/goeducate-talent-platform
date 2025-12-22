import Link from "next/link";

import { PlayerProfileForm } from "@/components/PlayerProfileForm";
import { PlayerFilmStatusWidget } from "@/components/PlayerFilmStatusWidget";
import { PlayerGuard } from "./Guard";

export default function PlayerDashboardPage() {
  return (
    <PlayerGuard>
      <div className="grid gap-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Player dashboard</h1>
            <p className="mt-2 text-sm text-white/80">
              Manage your athlete profile. Film upload and evaluation status are next.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/player/film" className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
              Film submissions
            </Link>
            <Link href="/showcases" className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
              Showcases
            </Link>
          </div>
        </div>

        <PlayerFilmStatusWidget />

        <PlayerProfileForm />
      </div>
    </PlayerGuard>
  );
}


