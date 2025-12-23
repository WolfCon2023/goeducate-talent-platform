"use client";

import * as React from "react";

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
};

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = React.createContext<ConfirmFn | null>(null);

function cx(...classes: Array<string | undefined | false | null>) {
  return classes.filter(Boolean).join(" ");
}

export function ConfirmProvider(props: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [opts, setOpts] = React.useState<ConfirmOptions | null>(null);
  const resolverRef = React.useRef<((value: boolean) => void) | null>(null);

  const confirm = React.useCallback<ConfirmFn>(async (next) => {
    setOpts(next);
    setOpen(true);
    return await new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  function close(result: boolean) {
    setOpen(false);
    const resolve = resolverRef.current;
    resolverRef.current = null;
    resolve?.(result);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {props.children}
      {open && opts ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          onMouseDown={() => close(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[var(--surface)] p-6 shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="text-lg font-semibold">{opts.title}</div>
            {opts.message ? <div className="mt-2 text-sm text-white/80">{opts.message}</div> : null}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="h-10 rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-4 text-sm text-[color:var(--foreground)] hover:bg-[var(--surface)]"
                onClick={() => close(false)}
              >
                {opts.cancelText ?? "Cancel"}
              </button>
              <button
                type="button"
                className={cx(
                  "h-10 rounded-md px-4 text-sm font-semibold text-white",
                  opts.destructive ? "bg-red-600 hover:bg-red-500" : "bg-[color:var(--color-primary-600)] hover:bg-[color:var(--color-primary-500)]"
                )}
                onClick={() => close(true)}
              >
                {opts.confirmText ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = React.useContext(ConfirmContext);
  return React.useCallback<ConfirmFn>(
    async (opts) => {
      if (ctx) return await ctx(opts);
      // Fallback for safety (shouldn't happen if ConfirmProvider is mounted)
      return Promise.resolve(window.confirm(opts.message ?? opts.title));
    },
    [ctx]
  );
}


