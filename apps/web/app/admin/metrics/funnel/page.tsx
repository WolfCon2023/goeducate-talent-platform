import { Suspense } from "react";

import { AdminGuard } from "../../Guard";
import { FunnelClient } from "./pageClient";

export default function FunnelPage() {
  return (
    <AdminGuard>
      <Suspense fallback={<div className="text-sm text-white/70">Loading…</div>}>
        <FunnelClient />
      </Suspense>
    </AdminGuard>
  );
}


