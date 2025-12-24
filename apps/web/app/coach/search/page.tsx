import Link from "next/link";

import { CoachGuard } from "../Guard";
import { CoachPublicPlayerSearch } from "@/components/search/CoachPublicPlayerSearch";

export default function CoachSearchPage() {
  return (
    <CoachGuard>
      <div className="grid gap-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
            <p className="mt-2 text-sm text-white/80">Find public player profiles.</p>
          </div>
          <Link href="/coach" className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
            ← Back to dashboard
          </Link>
        </div>
        <CoachPublicPlayerSearch />
      </div>
    </CoachGuard>
  );
}


