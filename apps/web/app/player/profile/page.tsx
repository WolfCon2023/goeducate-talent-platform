import Link from "next/link";

import { PlayerGuard } from "../Guard";
import { ProfileVisibilityCard } from "@/components/profiles/ProfileVisibilityCard";
import { PlayerProfileForm } from "@/components/PlayerProfileForm";

export default function PlayerProfilePage() {
  return (
    <PlayerGuard>
      <div className="grid gap-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Player profile</h1>
            <p className="mt-2 text-sm text-white/80">Control visibility and complete your profile to improve discoverability.</p>
          </div>
          <Link href="/player" className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
            ← Back to dashboard
          </Link>
        </div>

        <ProfileVisibilityCard title="Profile settings" showContactToggle />

        <PlayerProfileForm />
      </div>
    </PlayerGuard>
  );
}


