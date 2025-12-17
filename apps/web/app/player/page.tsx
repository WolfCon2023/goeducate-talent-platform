import Link from "next/link";

import { PlayerProfileForm } from "@/components/PlayerProfileForm";

export default function PlayerDashboardPage() {
  return (
    <div className="grid gap-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Player dashboard</h1>
          <p className="mt-2 text-sm text-slate-300">
            Manage your athlete profile. Film upload and evaluation status are next.
          </p>
        </div>
        <Link href="/login" className="text-sm text-slate-300 hover:text-white">
          Login
        </Link>
      </div>

      <PlayerProfileForm />
    </div>
  );
}


