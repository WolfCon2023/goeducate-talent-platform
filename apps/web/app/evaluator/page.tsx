import Link from "next/link";

import { EvaluatorQueue } from "@/components/EvaluatorQueue";

export default function EvaluatorDashboardPage() {
  return (
    <div className="grid gap-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Evaluator queue</h1>
          <p className="mt-2 text-sm text-slate-300">Review submitted film. Tagging and reports are next.</p>
        </div>
        <Link href="/" className="text-sm text-slate-300 hover:text-white">
          Home
        </Link>
      </div>

      <EvaluatorQueue />
    </div>
  );
}



