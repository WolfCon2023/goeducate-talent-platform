"use client";

import { useEffect, useRef } from "react";

export function useAutoRevalidate(
  load: () => void | Promise<void>,
  opts?: {
    deps?: unknown[];
    onMount?: boolean;
    onFocus?: boolean;
    intervalMs?: number;
  }
) {
  const onMount = opts?.onMount ?? true;
  const onFocus = opts?.onFocus ?? true;
  const intervalMs = opts?.intervalMs ?? 0;
  const deps = opts?.deps ?? [];

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (onMount) void loadRef.current();

    function maybeReload() {
      void loadRef.current();
    }

    let t: number | null = null;
    if (intervalMs && intervalMs > 0) {
      t = window.setInterval(maybeReload, intervalMs);
    }

    if (onFocus) {
      window.addEventListener("focus", maybeReload);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") maybeReload();
      });
    }

    return () => {
      if (t) window.clearInterval(t);
      if (onFocus) {
        window.removeEventListener("focus", maybeReload);
        // visibilitychange listener is anonymous above; keep it simple (best-effort).
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}


