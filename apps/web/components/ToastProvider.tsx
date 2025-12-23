"use client";

import * as React from "react";

export type ToastKind = "success" | "error" | "info";

export type Toast = {
  id: string;
  kind: ToastKind;
  title?: string;
  message: string;
  createdAt: number;
  ttlMs: number;
};

type ToastContextValue = {
  toasts: Toast[];
  push: (t: Omit<Toast, "id" | "createdAt">) => void;
  dismiss: (id: string) => void;
  clear: () => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function ToastProvider(props: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clear = React.useCallback(() => setToasts([]), []);

  const push = React.useCallback((t: Omit<Toast, "id" | "createdAt">) => {
    const id = uid();
    const toast: Toast = { ...t, id, createdAt: Date.now() };
    setToasts((prev) => [toast, ...prev].slice(0, 5));
    window.setTimeout(() => dismiss(id), Math.max(1200, toast.ttlMs));
  }, [dismiss]);

  // Allow non-hook usage (e.g. apiFetch 401 handler) via a window event.
  React.useEffect(() => {
    const onToast = (e: Event) => {
      const ce = e as CustomEvent<any>;
      if (!ce.detail?.message) return;
      push({
        kind: ce.detail.kind ?? "info",
        title: ce.detail.title,
        message: String(ce.detail.message),
        ttlMs: typeof ce.detail.ttlMs === "number" ? ce.detail.ttlMs : 3500
      });
    };
    window.addEventListener("goeducate:toast", onToast as any);
    return () => window.removeEventListener("goeducate:toast", onToast as any);
  }, [push]);

  return (
    <ToastContext.Provider value={{ toasts, push, dismiss, clear }}>
      {props.children}
      <ToastViewport />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function toast(detail: { kind?: ToastKind; title?: string; message: string; ttlMs?: number }) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("goeducate:toast", { detail }));
}

function kindStyles(kind: ToastKind) {
  if (kind === "success") return "border-emerald-500/30 bg-emerald-500/10";
  if (kind === "error") return "border-red-500/30 bg-red-500/10";
  return "border-white/10 bg-white/5";
}

function ToastViewport() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-20 z-[100] flex w-[min(420px,calc(100vw-32px))] flex-col gap-2">
      {ctx.toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto rounded-xl border p-3 shadow-lg backdrop-blur ${kindStyles(t.kind)}`}
          role="status"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {t.title ? <div className="text-sm font-semibold text-[color:var(--foreground)]">{t.title}</div> : null}
              <div className="mt-0.5 text-sm text-[color:var(--muted)]">{t.message}</div>
            </div>
            <button
              type="button"
              className="rounded-md px-2 py-1 text-sm text-[color:var(--muted)] hover:bg-white/10"
              onClick={() => ctx.dismiss(t.id)}
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}


