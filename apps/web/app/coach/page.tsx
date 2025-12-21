import Link from "next/link";

import { CoachSearch } from "@/components/CoachSearch";
import { CoachWatchlist } from "@/components/CoachWatchlist";
import { ProfilePhotoUploader } from "@/components/ProfilePhotoUploader";
import { Card } from "@/components/ui";
import { CoachGuard } from "./Guard";

export default function CoachDashboardPage() {
  return (
    <CoachGuard>
      <div className="grid gap-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Coach dashboard (MVP)</h1>
            <p className="mt-2 text-sm text-white/80">
              Search players and view profiles. Upgrade your subscription to unlock contact info.
            </p>
          </div>
          <Link href="/" className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
            Home
          </Link>
        </div>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Billing</div>
              <p className="mt-1 text-sm text-white/80">Manage your Coach subscription and unlock player contact details.</p>
            </div>
            <Link
              href="/coach/billing"
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Manage / Upgrade
            </Link>
          </div>
        </Card>

        <ProfilePhotoUploader title="Coach profile photo" />

        <CoachSearch />

        <CoachWatchlist />
      </div>
    </CoachGuard>
  );
}



