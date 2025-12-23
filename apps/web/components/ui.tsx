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

export function RefreshIconButton(props: {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  const title = props.title ?? "Refresh";
  const disabled = props.disabled || props.loading;
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={disabled}
      aria-label={title}
      title={title}
      className={cx(
        "inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white/90 shadow-sm transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary-600)] disabled:cursor-not-allowed disabled:opacity-60",
        props.className
      )}
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        className={props.loading ? "animate-spin" : ""}
        aria-hidden="true"
      >
        <path
          fill="currentColor"
          d="M12 6V3L8 7l4 4V8c2.757 0 5 2.243 5 5a5 5 0 0 1-9.9 1h-2.02A7 7 0 0 0 19 13c0-3.86-3.14-7-7-7Zm-5 5a5 5 0 0 1 9.9-1h2.02A7 7 0 0 0 5 11c0 3.86 3.14 7 7 7v3l4-4-4-4v3c-2.757 0-5-2.243-5-5Z"
        />
      </svg>
    </button>
  );
}


