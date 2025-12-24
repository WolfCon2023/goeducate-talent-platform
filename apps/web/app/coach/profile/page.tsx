import Link from "next/link";

import { CoachGuard } from "../Guard";
import { ProfileVisibilityCard } from "@/components/profiles/ProfileVisibilityCard";
import { CoachSelfProfileForm } from "@/components/profiles/CoachSelfProfileForm";

export default function CoachProfilePage() {
  return (
    <CoachGuard>
      <div className="grid gap-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Coach profile</h1>
            <p className="mt-2 text-sm text-white/80">Control visibility and complete your profile to build trust with athletes.</p>
          </div>
          <Link href="/coach" className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
            ← Back to dashboard
          </Link>
        </div>

        <ProfileVisibilityCard title="Profile settings" />

        <CoachSelfProfileForm />
      </div>
    </CoachGuard>
  );
}


