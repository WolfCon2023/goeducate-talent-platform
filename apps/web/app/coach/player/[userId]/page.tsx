import Link from "next/link";

import { CoachPlayerDetail } from "@/components/CoachPlayerDetail";
import { CoachGuard } from "../../Guard";

export default async function CoachPlayerDetailPage(props: { params: Promise<{ userId: string }> }) {
  const params = await props.params;
  return (
    <CoachGuard>
      <div className="grid gap-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Player profile</h1>
            <p className="mt-2 text-sm text-slate-300">Profile, film submissions, and evaluations.</p>
          </div>
          <Link href="/coach" className="text-sm text-slate-300 hover:text-white">
            Back to search
          </Link>
        </div>

        <CoachPlayerDetail userId={params.userId} />
      </div>
    </CoachGuard>
  );
}


