import { Suspense } from "react";

import { CoachGuard } from "../Guard";
import { BillingClient } from "./BillingClient";

export default function CoachBillingPage() {
  return (
    <CoachGuard>
      <Suspense fallback={null}>
        <BillingClient />
      </Suspense>
    </CoachGuard>
  );
}


