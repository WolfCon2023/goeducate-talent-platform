import * as React from "react";
import { Suspense } from "react";
import { MessagesClient } from "./MessagesClient";

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="text-sm text-[color:var(--muted)]">Loading…</div>}>
      <MessagesClient />
    </Suspense>
  );
}


