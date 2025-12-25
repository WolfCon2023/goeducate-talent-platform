import { Suspense } from "react";

import { KbClient } from "./KbClient";

export default function KnowledgeBasePage() {
  return (
    <Suspense fallback={<div className="text-sm text-[color:var(--muted)]">Loading…</div>}>
      <KbClient />
    </Suspense>
  );
}


