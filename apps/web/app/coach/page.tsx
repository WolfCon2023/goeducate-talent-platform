import Link from "next/link";

import { CoachSearch } from "@/components/CoachSearch";

export default function CoachDashboardPage() {
  return (
    <div className="grid gap-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Coach dashboard (MVP)</h1>
          <p className="mt-2 text-sm text-slate-300">
            Search players and view profiles. Watchlists and subscription gating are scaffolded for later.
          </p>
        </div>
        <Link href="/login" className="text-sm text-slate-300 hover:text-white">
          Login
        </Link>
      </div>

      <CoachSearch />
    </div>
  );
}



