import type { ButtonHTMLAttributes, InputHTMLAttributes } from "react";

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;
  return (
    <button
      className={`rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${className}`}
      {...rest}
    />
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return (
    <input
      className={`w-full rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${className}`}
      {...rest}
    />
  );
}

export function Label(props: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={props.htmlFor} className="text-sm font-medium text-[color:var(--muted)]">
      {props.children}
    </label>
  );
}

export function Card(props: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-[color:var(--border)] bg-[var(--surface)] p-6">{props.children}</div>;
}



