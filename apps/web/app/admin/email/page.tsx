import { Suspense } from "react";

import { AdminGuard } from "../Guard";
import { AdminEmailPageClient } from "./pageClient";

export default function AdminEmailPage() {
  return (
    <AdminGuard>
      <Suspense fallback={<div className="text-sm text-white/70">Loading…</div>}>
        <AdminEmailPageClient />
      </Suspense>
    </AdminGuard>
  );
}


