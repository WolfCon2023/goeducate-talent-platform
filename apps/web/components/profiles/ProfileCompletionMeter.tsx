"use client";

import * as React from "react";

export function ProfileCompletionMeter(props: { score: number; missing: string[] }) {
  const score = Math.max(0, Math.min(100, Math.round(props.score)));
  const missing = props.missing ?? [];

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-sm font-semibold text-white">Profile completion</div>
        <div className="text-sm text-white/80">
          <span className="font-semibold text-white">{score}%</span>
        </div>
      </div>
      <div className="mt-2 h-2 w-full rounded-full bg-white/10">
        <div
          className="h-2 rounded-full bg-indigo-500 transition-[width]"
          style={{ width: `${score}%` }}
          aria-label={`Profile completion ${score}%`}
        />
      </div>

      {missing.length ? (
        <div className="mt-3 text-xs text-white/70">
          Missing: <span className="text-white/80">{missing.join(", ")}</span>
        </div>
      ) : (
        <div className="mt-3 text-xs text-emerald-200">All key fields complete.</div>
      )}
    </div>
  );
}


