import { Suspense } from "react";

import { AdminGuard } from "../Guard";
import { AdminMetricsClient } from "./AdminMetricsClient";

export default function AdminMetricsPage() {
  return (
    <AdminGuard>
      <Suspense fallback={<div className="text-sm text-white/70">Loading metrics…</div>}>
        <AdminMetricsClient />
      </Suspense>
    </AdminGuard>
  );
}


