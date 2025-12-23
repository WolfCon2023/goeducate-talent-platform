"use client";

import * as React from "react";

import { useTheme } from "@/components/ThemeProvider";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      className="rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-1.5 text-sm text-[color:var(--foreground)] hover:bg-[var(--surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      aria-label="Toggle theme"
      title="Toggle theme"
    >
      {theme === "dark" ? "Light" : "Dark"}
    </button>
  );
}


