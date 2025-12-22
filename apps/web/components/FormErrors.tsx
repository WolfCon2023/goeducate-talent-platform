"use client";

import { firstFieldError, type FieldErrors } from "@/lib/formErrors";

export function FormErrorSummary(props: { title?: string; formError?: string; fieldErrors?: FieldErrors }) {
  const fieldEntries = Object.entries(props.fieldErrors ?? {}).filter(([, v]) => Array.isArray(v) && v.length > 0);
  const hasAny = Boolean(props.formError) || fieldEntries.length > 0;
  if (!hasAny) return null;

  return (
    <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4">
      <div className="text-sm font-semibold text-red-200">{props.title ?? "Please fix the following:"}</div>
      <div className="mt-2 grid gap-1 text-sm text-red-100">
        {props.formError ? <div>{props.formError}</div> : null}
        {fieldEntries.length ? (
          <ul className="list-disc pl-5">
            {fieldEntries.slice(0, 8).map(([k, v]) => (
              <li key={k}>
                <span className="font-semibold">{k}:</span> {v[0]}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

export function FieldError(props: { fieldErrors?: FieldErrors; name: string }) {
  const msg = firstFieldError(props.fieldErrors, props.name);
  if (!msg) return null;
  return <div className="text-sm text-red-300">{msg}</div>;
}


