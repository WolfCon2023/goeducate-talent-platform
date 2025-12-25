import Link from "next/link";

import { CoachPlayerProfile } from "@/components/CoachPlayerProfile";
import { CoachGuard } from "../../Guard";
import { HelpIcon } from "@/components/kb/HelpIcon";

export default async function CoachPlayerPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  return (
    <CoachGuard>
      <div className="grid gap-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">Player</h1>
              <HelpIcon helpKey="coach.player.profile" title="Coach viewing a player profile" />
            </div>
            <p className="mt-2 text-sm text-white/80">Profile details and (if subscribed) contact info.</p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/coach" className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
              Back to coach dashboard
            </Link>
          </div>
        </div>

        <CoachPlayerProfile userId={userId} />
      </div>
    </CoachGuard>
  );
}


