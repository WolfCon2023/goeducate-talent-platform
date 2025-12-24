import { EvaluatorQueue } from "@/components/EvaluatorQueue";
import { EvaluatorGuard } from "./Guard";
import Link from "next/link";

export default function EvaluatorDashboardPage() {
  return (
    <EvaluatorGuard>
      <div className="grid gap-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Evaluator queue</h1>
            <p className="mt-2 text-sm text-white/80">Review submitted film. Tagging and reports are next.</p>
          </div>
        </div>

        <EvaluatorQueue />
      </div>
    </EvaluatorGuard>
  );
}



