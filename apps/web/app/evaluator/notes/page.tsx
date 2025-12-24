import Link from "next/link";

import { EvaluatorGuard } from "../Guard";
import { EvaluatorNotesTool } from "@/components/evaluator/EvaluatorNotesTool";

export default function EvaluatorNotesPage() {
  return (
    <EvaluatorGuard>
      <div className="grid gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Evaluator notes</h1>
            <p className="mt-2 text-sm text-white/80">
              Take structured notes based on the active evaluation form. Copy results into the evaluation when ready.
            </p>
          </div>
          <Link href="/evaluator" className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
            ← Back to evaluator
          </Link>
        </div>

        <EvaluatorNotesTool />
      </div>
    </EvaluatorGuard>
  );
}


