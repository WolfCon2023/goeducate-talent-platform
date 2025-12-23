"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    // Capture client-side render errors in App Router.
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body style={{ fontFamily: "system-ui, Segoe UI, Roboto, Helvetica, Arial, sans-serif" }}>
        <div style={{ padding: 24 }}>
          <h2>Something went wrong.</h2>
          <p>Please refresh the page. If the issue persists, contact support.</p>
        </div>
      </body>
    </html>
  );
}


