"use client";

import { createContext, useContext, useMemo, useState } from "react";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
};

type ConfirmState = {
  open: boolean;
  title?: string;
  message: string;
  confirmText: string;
  cancelText: string;
  destructive: boolean;
  resolve?: (value: boolean) => void;
};

const ConfirmContext = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmProvider(props: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmState>({
    open: false,
    title: "Confirm",
    message: "",
    confirmText: "Confirm",
    cancelText: "Cancel",
    destructive: false
  });

  const confirm = useMemo(() => {
    return (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setState({
          open: true,
          title: opts.title ?? "Confirm",
          message: opts.message,
          confirmText: opts.confirmText ?? "Confirm",
          cancelText: opts.cancelText ?? "Cancel",
          destructive: !!opts.destructive,
          resolve
        });
      });
  }, []);

  function close(value: boolean) {
    const r = state.resolve;
    setState((s) => ({ ...s, open: false, resolve: undefined }));
    r?.(value);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {props.children}

      {state.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => close(false)} />
          <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[var(--surface)] p-6 shadow-2xl">
            <div className="text-lg font-semibold text-white">{state.title}</div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-white/80">{state.message}</p>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                className="rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                onClick={() => close(false)}
              >
                {state.cancelText}
              </button>
              <button
                type="button"
                className={`rounded-md px-4 py-2 text-sm font-medium ${
                  state.destructive
                    ? "bg-red-500 text-white hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                    : "bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                }`}
                onClick={() => close(true)}
              >
                {state.confirmText}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}


