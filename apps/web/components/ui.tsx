import * as React from "react";

type ClassNameProps = { className?: string };

function cx(...classes: Array<string | undefined | false | null>) {
  return classes.filter(Boolean).join(" ");
}

export function Card(props: React.PropsWithChildren<ClassNameProps>) {
  return (
    <div
      className={cx(
        "rounded-2xl border border-white/10 bg-[var(--surface)] p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_12px_40px_rgba(0,0,0,0.35)]",
        props.className
      )}
    >
      {props.children}
    </div>
  );
}

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(function Label(
  { className, ...props },
  ref
) {
  return (
    <label
      ref={ref}
      className={cx("text-sm font-medium text-[color:var(--foreground)]", className)}
      {...props}
    />
  );
});

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, type, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cx(
        "h-10 w-full rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary-600)]",
        className
      )}
      {...props}
    />
  );
});

export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(function Button(
  { className, type, disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      disabled={disabled}
      className={cx(
        "inline-flex h-10 items-center justify-center rounded-md bg-[color:var(--color-primary-600)] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[color:var(--color-primary-500)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary-600)] disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
      {...props}
    />
  );
});


