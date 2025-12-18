import Link from "next/link";

import { EvaluatorEvaluationForm } from "@/components/EvaluatorEvaluationForm";

export default async function EvaluatorFilmPage(props: {
  params: Promise<{ filmSubmissionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await props.params;
  await props.searchParams;

  return (
    <div className="grid gap-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Complete evaluation</h1>
          <p className="mt-2 text-sm text-slate-300">Submit an evaluation report and mark the film as completed.</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/evaluator" className="text-sm text-slate-300 hover:text-white">
            Back to queue
          </Link>
        </div>
      </div>

      <EvaluatorEvaluationForm filmSubmissionId={params.filmSubmissionId} />
    </div>
  );
}


