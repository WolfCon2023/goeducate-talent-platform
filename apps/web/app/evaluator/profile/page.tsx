import Link from "next/link";

import { EvaluatorGuard } from "../Guard";
import { ProfileVisibilityCard } from "@/components/profiles/ProfileVisibilityCard";
import { EvaluatorSelfProfileForm } from "@/components/profiles/EvaluatorSelfProfileForm";
import { HelpIcon } from "@/components/kb/HelpIcon";

export default function EvaluatorProfilePage() {
  return (
    <EvaluatorGuard>
      <div className="grid gap-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">Evaluator profile</h1>
              <HelpIcon helpKey="evaluator.profile" title="Evaluator profile" />
            </div>
            <p className="mt-2 text-sm text-white/80">Control visibility and keep your evaluator profile up to date.</p>
          </div>
          <Link href="/evaluator" className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
            ← Back to dashboard
          </Link>
        </div>

        <ProfileVisibilityCard title="Profile settings" />

        <EvaluatorSelfProfileForm />
      </div>
    </EvaluatorGuard>
  );
}


