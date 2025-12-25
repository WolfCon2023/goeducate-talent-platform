import { Suspense } from "react";

import { ResetPasswordClient } from "./ResetPasswordClient";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="text-sm text-[color:var(--muted)]">Loading…</div>}>
      <ResetPasswordClient />
    </Suspense>
  );
}


