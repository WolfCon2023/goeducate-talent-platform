"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { toast } from "@/components/ToastProvider";
import { Button, Input } from "@/components/ui";

type KbResult = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  tags: string[];
  category: string | null;
  helpKeys: string[];
  status: "draft" | "published";
  updatedAt: string | null;
};

type HelpContextValue = {
  open: (args: { helpKey: string; title?: string; initialQuery?: string }) => void;
  close: () => void;
};

const HelpContext = createContext<HelpContextValue | null>(null);

export function useHelpDrawer() {
  const ctx = useContext(HelpContext);
  if (!ctx) throw new Error("useHelpDrawer must be used within HelpDrawerProvider");
  return ctx;
}

export function HelpDrawerProvider(props: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [helpKey, setHelpKey] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<KbResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const apiQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (helpKey) params.set("helpKey", helpKey);
    params.set("limit", "10");
    params.set("skip", "0");
    return params.toString();
  }, [query, helpKey]);

  const load = useCallback(async () => {
    if (!helpKey) return;
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<{ results: KbResult[] }>(`/kb/search?${apiQuery}`, { retries: 2, retryOn404: true });
      setResults(res.results ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load help");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [apiQuery, helpKey]);

  const openDrawer = useCallback(
    (args: { helpKey: string; title?: string; initialQuery?: string }) => {
      setHelpKey(args.helpKey);
      setTitle(args.title ?? null);
      setQuery(args.initialQuery ?? "");
      setOpen(true);
      // Telemetry (best-effort)
      void apiFetch("/kb/events", {
        method: "POST",
        token: getAccessToken() ?? undefined,
        body: JSON.stringify({ type: "kb_open", helpKey: args.helpKey, meta: { pathname } }),
        retries: 1,
        retryOn404: true
      }).catch(() => {});
    },
    [pathname]
  );

  // Load on open / query changes.
  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  // Close on navigation.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const value = useMemo<HelpContextValue>(() => ({ open: openDrawer, close }), [openDrawer, close]);

  return (
    <HelpContext.Provider value={value}>
      {props.children}

      {open ? (
        <div
          className="fixed inset-0 z-[130] bg-black/60"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
          role="dialog"
          aria-modal="true"
        >
          <aside className="absolute right-0 top-0 h-full w-full max-w-[520px] border-l border-white/10 bg-[var(--surface)] shadow-[0_20px_80px_rgba(0,0,0,0.7)]">
            <div className="flex items-start justify-between gap-3 border-b border-white/10 p-5">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white/90">{title ?? "Help"}</div>
                <div className="mt-1 text-xs text-[color:var(--muted)]">
                  helpKey: <span className="font-mono text-white/80">{helpKey}</span>
                </div>
              </div>
              <Button
                type="button"
                className="border border-white/15 bg-white/5 text-white hover:bg-white/10"
                onClick={close}
              >
                Close
              </Button>
            </div>

            <div className="p-5">
              <div className="flex gap-2">
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search within help…" />
                <Button type="button" className="border border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={() => void load()}>
                  Search
                </Button>
              </div>

              {error ? <div className="mt-3 text-sm text-red-300">{error}</div> : null}
              <div className="mt-3 text-xs text-[color:var(--muted)]">
                {loading ? "Loading…" : results.length ? `${results.length} result${results.length === 1 ? "" : "s"}` : "No matching articles yet."}
              </div>

              <div className="mt-4 grid gap-3">
                {results.map((r) => (
                  <Link
                    key={r.id}
                    href={`/kb/${encodeURIComponent(r.slug)}`}
                    className="block rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10"
                    onClick={() => {
                      toast({ kind: "info", title: "Opening article", message: r.title });
                      close();
                    }}
                  >
                    <div className="text-sm font-semibold text-white/90">{r.title}</div>
                    {r.summary ? <div className="mt-1 line-clamp-2 text-xs text-[color:var(--muted)]">{r.summary}</div> : null}
                    <div className="mt-2 text-[11px] text-[color:var(--muted-2)]">
                      {r.category ? <span>{r.category}</span> : null}
                      {r.tags?.length ? <span>{r.category ? " · " : ""}#{r.tags.slice(0, 4).join(" #")}</span> : null}
                    </div>
                  </Link>
                ))}
              </div>

              {!loading && results.length === 0 ? (
                <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-[color:var(--muted)]">
                  No article is published for this section yet. Please contact support (or an admin) to add one.
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                <Link href={`/kb?helpKey=${encodeURIComponent(helpKey ?? "")}`} className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline" onClick={close}>
                  Browse all for this section →
                </Link>
                <Link href="/kb" className="text-sm text-indigo-300 hover:text-indigo-200 hover:underline" onClick={close}>
                  Open Knowledge Base →
                </Link>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </HelpContext.Provider>
  );
}


