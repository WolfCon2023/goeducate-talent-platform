import { PlayerProfileForm } from "@/components/PlayerProfileForm";
import { PlayerFilmStatusWidget } from "@/components/PlayerFilmStatusWidget";
import { PlayerEvaluationHistoryWidget } from "@/components/PlayerEvaluationHistoryWidget";
import { PlayerGuard } from "./Guard";
import Link from "next/link";
import { HelpIcon } from "@/components/kb/HelpIcon";

export default function PlayerDashboardPage() {
  return (
    <PlayerGuard>
      <div className="grid gap-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">Player dashboard</h1>
              <HelpIcon helpKey="player.dashboard" title="Player dashboard" />
            </div>
            <p className="mt-2 text-sm text-white/80">
              Manage your athlete profile. Submit film and track evaluation status.
            </p>
          </div>
        </div>

        <PlayerFilmStatusWidget />

        <PlayerEvaluationHistoryWidget />

        <PlayerProfileForm />
      </div>
    </PlayerGuard>
  );
}


