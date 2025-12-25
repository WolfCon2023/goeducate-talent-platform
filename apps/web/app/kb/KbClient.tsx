"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button, Card, Input, Label } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { toast } from "@/components/ToastProvider";

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
  publishedAt: string | null;
  helpfulYesCount: number;
  helpfulNoCount: number;
};

export function KbClient() {
  const sp = useSearchParams();
  const router = useRouter();

  const q = sp.get("q") ?? "";
  const tag = sp.get("tag") ?? "";
  const category = sp.get("category") ?? "";
  const helpKey = sp.get("helpKey") ?? "";

  const [search, setSearch] = useState(q);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<KbResult[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  const qs = useMemo(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (tag.trim()) params.set("tag", tag.trim());
    if (category.trim()) params.set("category", category.trim());
    if (helpKey.trim()) params.set("helpKey", helpKey.trim());
    params.set("limit", "20");
    params.set("skip", "0");
    return params.toString();
  }, [q, tag, category, helpKey]);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const [res, cats, tgs] = await Promise.all([
        apiFetch<{ results: KbResult[]; total: number }>(`/kb/search?${qs}`, { retries: 2, retryOn404: true }),
        apiFetch<{ categories: string[] }>("/kb/categories", { retries: 2, retryOn404: true }).catch(() => ({ categories: [] })),
        apiFetch<{ tags: string[] }>("/kb/tags", { retries: 2, retryOn404: true }).catch(() => ({ tags: [] }))
      ]);
      setResults(res.results ?? []);
      setTotal(res.total ?? 0);
      setCategories(cats.categories ?? []);
      setTags(tgs.tags ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load Knowledge Base");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  function updateQuery(next: { q?: string; tag?: string; category?: string; helpKey?: string }) {
    const params = new URLSearchParams(sp.toString());
    if (typeof next.q === "string") {
      if (next.q.trim()) params.set("q", next.q.trim());
      else params.delete("q");
    }
    if (typeof next.tag === "string") {
      if (next.tag.trim()) params.set("tag", next.tag.trim());
      else params.delete("tag");
    }
    if (typeof next.category === "string") {
      if (next.category.trim()) params.set("category", next.category.trim());
      else params.delete("category");
    }
    if (typeof next.helpKey === "string") {
      if (next.helpKey.trim()) params.set("helpKey", next.helpKey.trim());
      else params.delete("helpKey");
    }
    router.push(`/kb?${params.toString()}`);
  }

  return (
    <div className="grid gap-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Knowledge Base</h1>
            <p className="mt-1 text-sm text-[color:var(--muted)]">Search help articles and guides.</p>
          </div>
          <Button
            type="button"
            className="border border-white/15 bg-white/5 text-white hover:bg-white/10"
            onClick={() => {
              void load();
              toast({ kind: "info", title: "Refreshing", message: "Updating articles list…" });
            }}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        </div>

        {error ? <div className="mt-4 text-sm text-red-300">{error}</div> : null}

        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_260px]">
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="kbSearch">Search</Label>
              <div className="flex gap-2">
                <Input
                  id="kbSearch"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Try: film submission, billing, evaluations…"
                />
                <Button type="button" onClick={() => updateQuery({ q: search })} disabled={loading}>
                  Search
                </Button>
              </div>
            </div>

            {helpKey ? (
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                Showing help for <span className="font-semibold text-white/90">{helpKey}</span>{" "}
                <button
                  type="button"
                  className="ml-2 text-indigo-300 hover:text-indigo-200 hover:underline"
                  onClick={() => updateQuery({ helpKey: "" })}
                >
                  Clear
                </button>
              </div>
            ) : null}

            <div className="text-xs text-[color:var(--muted)]">
              {loading ? "Loading…" : `${total} article${total === 1 ? "" : "s"} found`}
            </div>

            {results.length ? (
              <div className="grid gap-3">
                {results.map((a) => (
                  <Link
                    key={a.id}
                    href={`/kb/${encodeURIComponent(a.slug)}`}
                    className="block rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-white/90">{a.title}</div>
                        {a.summary ? <div className="mt-1 line-clamp-2 text-xs text-[color:var(--muted)]">{a.summary}</div> : null}
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[color:var(--muted-2)]">
                          {a.category ? <span className="rounded-full border border-white/10 bg-black/10 px-2 py-0.5">{a.category}</span> : null}
                          {(a.tags ?? []).slice(0, 5).map((t) => (
                            <span key={t} className="rounded-full border border-white/10 bg-black/10 px-2 py-0.5">
                              #{t}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="shrink-0 text-[10px] text-[color:var(--muted-2)]">
                        {a.status === "draft" ? "Draft" : "Published"}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-[color:var(--muted)]">
                No articles match your filters yet. Try a different search, or contact support.
              </div>
            )}
          </div>

          <div className="grid gap-4">
            <Card className="p-4">
              <div className="text-sm font-semibold">Categories</div>
              <div className="mt-3 grid gap-2">
                <button
                  type="button"
                  className={`text-left text-sm ${!category ? "text-white/90 font-semibold" : "text-[color:var(--muted)] hover:text-white/90"}`}
                  onClick={() => updateQuery({ category: "" })}
                >
                  All
                </button>
                {categories.slice(0, 30).map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`text-left text-sm ${category === c ? "text-white/90 font-semibold" : "text-[color:var(--muted)] hover:text-white/90"}`}
                    onClick={() => updateQuery({ category: c })}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <div className="text-sm font-semibold">Tags</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(tags ?? []).slice(0, 40).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`rounded-full border px-2 py-1 text-xs ${
                      tag === t
                        ? "border-indigo-500/50 bg-indigo-500/10 text-white/90"
                        : "border-white/10 bg-black/10 text-[color:var(--muted)] hover:text-white/90"
                    }`}
                    onClick={() => updateQuery({ tag: tag === t ? "" : t })}
                  >
                    #{t}
                  </button>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </Card>
    </div>
  );
}


