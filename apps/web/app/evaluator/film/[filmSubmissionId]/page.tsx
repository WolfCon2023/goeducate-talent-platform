"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { EvaluatorEvaluationForm } from "@/components/EvaluatorEvaluationForm";
import { EvaluatorGuard } from "../../Guard";

export default function EvaluatorFilmPage() {
  const params = useParams<{ filmSubmissionId: string }>();
  const filmSubmissionId = String(params?.filmSubmissionId ?? "").trim();

  return (
    <EvaluatorGuard>
      <div className="grid gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Evaluation</h1>
          <Link href="/evaluator" className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
            Back to queue
          </Link>
        </div>

        {filmSubmissionId ? (
          <EvaluatorEvaluationForm filmSubmissionId={filmSubmissionId} />
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/80">Missing film id.</div>
        )}
      </div>
    </EvaluatorGuard>
  );
}


