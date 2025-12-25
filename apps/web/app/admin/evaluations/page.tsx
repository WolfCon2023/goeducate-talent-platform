import Link from "next/link";

import { AdminEvaluations } from "@/components/AdminEvaluations";
import { AdminGuard } from "../Guard";
import { HelpIcon } from "@/components/kb/HelpIcon";

export default function AdminEvaluationsQueuePage() {
  return (
    <AdminGuard>
      <div className="grid gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">Evaluations queue</h1>
              <HelpIcon helpKey="admin.evaluations.queue" title="Admin evaluations queue" />
            </div>
            <p className="mt-2 text-sm text-white/80">Assign and review film submissions. Open any record regardless of status.</p>
          </div>
          <Link href="/admin" className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline">
            Back to admin
          </Link>
        </div>

        <AdminEvaluations />
      </div>
    </AdminGuard>
  );
}


