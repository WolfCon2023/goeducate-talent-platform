import { PlayerProfileForm } from "@/components/PlayerProfileForm";
import { PlayerFilmStatusWidget } from "@/components/PlayerFilmStatusWidget";
import { PlayerGuard } from "./Guard";
import Link from "next/link";

export default function PlayerDashboardPage() {
  return (
    <PlayerGuard>
      <div className="grid gap-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Player dashboard</h1>
            <p className="mt-2 text-sm text-white/80">
              Manage your athlete profile. Submit film and track evaluation status.
            </p>
          </div>
        </div>

        <PlayerFilmStatusWidget />

        <PlayerProfileForm />
      </div>
    </PlayerGuard>
  );
}


