import { EvaluatorQueue } from "@/components/EvaluatorQueue";
import { EvaluatorGuard } from "./Guard";
import Link from "next/link";
import { Card } from "@/components/ui";
import { HelpIcon } from "@/components/kb/HelpIcon";

export default function EvaluatorDashboardPage() {
  return (
    <EvaluatorGuard>
      <div className="grid gap-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">Evaluator queue</h1>
              <HelpIcon helpKey="evaluator.film.queue" title="Evaluator queue" />
            </div>
            <p className="mt-2 text-sm text-white/80">Review submitted film. Tagging and reports are next.</p>
          </div>
        </div>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Notes tool</div>
              <p className="mt-1 text-sm text-white/80">Take structured notes based on the active evaluation form and copy them into evaluations.</p>
            </div>
            <Link href="/evaluator/notes" className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
              Open notes
            </Link>
          </div>
        </Card>

        <EvaluatorQueue />
      </div>
    </EvaluatorGuard>
  );
}



