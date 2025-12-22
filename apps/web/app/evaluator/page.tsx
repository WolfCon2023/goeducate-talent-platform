import Link from "next/link";

import { EvaluatorQueue } from "@/components/EvaluatorQueue";
import { EvaluatorGuard } from "./Guard";

export default function EvaluatorDashboardPage() {
  return (
    <EvaluatorGuard>
      <div className="grid gap-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Evaluator queue</h1>
            <p className="mt-2 text-sm text-white/80">Review submitted film. Tagging and reports are next.</p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/showcases" className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
              Showcases
            </Link>
            <Link href="/" className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
              Home
            </Link>
          </div>
        </div>

        <EvaluatorQueue />
      </div>
    </EvaluatorGuard>
  );
}



