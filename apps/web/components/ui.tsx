import type { ButtonHTMLAttributes, InputHTMLAttributes } from "react";

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;
  return (
    <button
      className={`rounded-md bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-200 disabled:opacity-60 ${className}`}
      {...rest}
    />
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return (
    <input
      className={`w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400 ${className}`}
      {...rest}
    />
  );
}

export function Label(props: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={props.htmlFor} className="text-sm font-medium text-slate-200">
      {props.children}
    </label>
  );
}

export function Card(props: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-slate-800 bg-slate-950 p-6">{props.children}</div>;
}


