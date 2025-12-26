import { Suspense } from "react";

import { AdminGuard } from "../../Guard";
import { AdminMetricsTrendsClient } from "./trendsClient";

export default function AdminMetricsTrendsPage() {
  return (
    <AdminGuard>
      <Suspense fallback={<div className="text-sm text-white/70">Loading trends…</div>}>
        <AdminMetricsTrendsClient />
      </Suspense>
    </AdminGuard>
  );
}


