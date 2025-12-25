"use client";

import { useEffect, useMemo, useState } from "react";

import { Button, Card, Input, Label, RefreshIconButton } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { getAccessToken, getTokenRole } from "@/lib/auth";
import { parseApiError } from "@/lib/formErrors";
import { toast } from "@/components/ToastProvider";

const KB_CATEGORIES = [
  "getting-started",
  "accounts-access",
  "profiles",
  "film",
  "evaluations",
  "showcases",
  "billing-subscriptions",
  "notifications",
  "messages",
  "admin",
  "maps-search",
  "security-recovery",
  "troubleshooting"
] as const;

type ArticleRow = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  tags: string[];
  category: string | null;
  helpKeys: string[];
  status: "draft" | "published";
  version: number;
  publishedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type ArticleDetail = ArticleRow & { body: string; createdByUserId: string; updatedByUserId: string | null };

function normalizeSlug(input: string) {
  const raw = String(input ?? "").trim().toLowerCase();
  return raw
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 220);
}

function splitCsv(input: string) {
  return Array.from(
    new Set(
      String(input ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    )
  );
}

export function AdminKbClient() {
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [results, setResults] = useState<ArticleRow[]>([]);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | "draft" | "published">("");
  const [category, setCategory] = useState("");
  const [helpKey, setHelpKey] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<Array<{ id: string; action: string; createdAt: string | null; actor: { displayName: string } }> | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [editForm, setEditForm] = useState<{
    title: string;
    slug: string;
    summary: string;
    body: string;
    tagsCsv: string;
    category: string;
    helpKeysCsv: string;
    status: "draft" | "published";
  }>({
    title: "",
    slug: "",
    summary: "",
    body: "",
    tagsCsv: "",
    category: "",
    helpKeysCsv: "",
    status: "draft"
  });

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (status) params.set("status", status);
    if (category.trim()) params.set("category", category.trim());
    if (helpKey.trim()) params.set("helpKey", helpKey.trim());
    params.set("limit", "25");
    params.set("skip", "0");
    return params.toString();
  }, [q, status, category, helpKey]);

  async function load() {
    setFormError(null);
    setLoading(true);
    try {
      const token = getAccessToken();
      const tokenRole = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (tokenRole !== "admin") throw new Error("Insufficient permissions.");
      const res = await apiFetch<{ results: ArticleRow[] }>(`/admin/kb/articles?${query}`, { token, retries: 3, retryOn404: true });
      setResults(res.results ?? []);
    } catch (err) {
      const parsed = parseApiError(err);
      setFormError(parsed.formError ?? "Failed to load KB articles");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    if (!editOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [editOpen]);

  async function openCreate() {
    setEditId(null);
    setHistory(null);
    setEditForm({
      title: "",
      slug: "",
      summary: "",
      body: "",
      tagsCsv: "",
      category: "",
      helpKeysCsv: "",
      status: "draft"
    });
    setEditOpen(true);
  }

  async function loadHistory(id: string) {
    setHistoryLoading(true);
    try {
      const token = getAccessToken();
      const tokenRole = getTokenRole(token);
      if (!token) return;
      if (tokenRole !== "admin") return;
      const res = await apiFetch<{ history: any[] }>(`/admin/kb/articles/${encodeURIComponent(id)}/history?limit=50`, {
        token,
        retries: 3,
        retryOn404: true
      });
      setHistory(res.history ?? []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function openEdit(id: string) {
    setEditOpen(true);
    setEditLoading(true);
    setEditId(id);
    setHistory(null);
    try {
      const token = getAccessToken();
      const tokenRole = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (tokenRole !== "admin") throw new Error("Insufficient permissions.");
      const res = await apiFetch<{ article: ArticleDetail }>(`/admin/kb/articles/${encodeURIComponent(id)}`, { token, retries: 3, retryOn404: true });
      const a = res.article;
      setEditForm({
        title: a.title ?? "",
        slug: a.slug ?? "",
        summary: a.summary ?? "",
        body: a.body ?? "",
        tagsCsv: (a.tags ?? []).join(", "),
        category: a.category ?? "",
        helpKeysCsv: (a.helpKeys ?? []).join(", "),
        status: a.status ?? "draft"
      });
      void loadHistory(id);
    } catch (err) {
      const parsed = parseApiError(err);
      toast({ kind: "error", title: "Failed", message: parsed.formError ?? "Failed to load article" });
      setEditOpen(false);
      setEditId(null);
    } finally {
      setEditLoading(false);
    }
  }

  async function save(mode: "save" | "publish" | "unpublish") {
    setSaving(true);
    setFormError(null);
    try {
      const token = getAccessToken();
      const tokenRole = getTokenRole(token);
      if (!token) throw new Error("Please login first.");
      if (tokenRole !== "admin") throw new Error("Insufficient permissions.");

      const slug = normalizeSlug(editForm.slug || editForm.title);
      const payload = {
        title: editForm.title.trim(),
        slug,
        summary: editForm.summary.trim() || undefined,
        body: editForm.body,
        tags: splitCsv(editForm.tagsCsv).map((t) => t.toLowerCase()),
        category: editForm.category.trim() ? editForm.category.trim().toLowerCase() : undefined,
        helpKeys: splitCsv(editForm.helpKeysCsv),
        status: mode === "publish" ? "published" : mode === "unpublish" ? "draft" : editForm.status
      };

      if (!payload.title || payload.title.length < 3) throw new Error("Title is required.");
      if (!payload.slug || payload.slug.length < 3) throw new Error("Slug is required.");
      if (!payload.body.trim()) throw new Error("Body is required.");

      if (!editId) {
        const created = await apiFetch<{ article: { id: string; slug: string } }>("/admin/kb/articles", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
          retries: 3,
          retryOn404: true
        });
        setEditId(created.article.id);
        toast({ kind: "success", title: "Created", message: "Article created." });
      } else {
        await apiFetch(`/admin/kb/articles/${encodeURIComponent(editId)}`, {
          method: "PUT",
          token,
          body: JSON.stringify(payload),
          retries: 3,
          retryOn404: true
        });
        if (mode === "publish") {
          await apiFetch(`/admin/kb/articles/${encodeURIComponent(editId)}/publish`, { method: "POST", token, retries: 3, retryOn404: true });
        }
        if (mode === "unpublish") {
          await apiFetch(`/admin/kb/articles/${encodeURIComponent(editId)}/unpublish`, { method: "POST", token, retries: 3, retryOn404: true });
        }
        toast({ kind: "success", title: "Saved", message: "Article updated." });
      }

      await load();
      if (editId) void loadHistory(editId);
    } catch (err) {
      const parsed = parseApiError(err);
      setFormError(parsed.formError ?? (err instanceof Error ? err.message : "Failed to save"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Knowledge Base</h2>
            <p className="mt-1 text-sm text-white/80">Admin authoring (drafts, publish, helpKeys, tags).</p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" onClick={openCreate}>
              New article
            </Button>
            <RefreshIconButton onClick={load} loading={loading} title="Refresh KB" />
          </div>
        </div>

        {formError ? <div className="mt-4 text-sm text-red-300">{formError}</div> : null}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="kbq">Search</Label>
            <Input id="kbq" value={q} onChange={(e) => setQ(e.target.value)} placeholder="title / slug / helpKey…" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="kbStatus">Status</Label>
            <select
              id="kbStatus"
              className="w-full rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary-600)]"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
            >
              <option value="">All</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="kbCategory">Category</Label>
            <select
              id="kbCategory"
              className="w-full rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary-600)]"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All</option>
              {KB_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2 sm:col-span-2 lg:col-span-2">
            <Label htmlFor="kbHelpKey">Help key</Label>
            <Input id="kbHelpKey" value={helpKey} onChange={(e) => setHelpKey(e.target.value)} placeholder="player.film.submit" />
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[color:var(--border)] text-[color:var(--color-text-muted)]">
                <th className="py-2 pr-4">Title</th>
                <th className="py-2 pr-4">Slug</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Category</th>
                <th className="py-2 pr-4">Updated</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {results.map((a) => (
                <tr key={a.id} className="border-b border-[color:var(--border)]">
                  <td className="py-2 pr-4">{a.title}</td>
                  <td className="py-2 pr-4 text-[color:var(--muted)]">{a.slug}</td>
                  <td className="py-2 pr-4">{a.status}</td>
                  <td className="py-2 pr-4">{a.category ?? "—"}</td>
                  <td className="py-2 pr-4 text-[color:var(--muted)]">{a.updatedAt ? new Date(a.updatedAt).toLocaleString() : "—"}</td>
                  <td className="py-2 pr-4">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        className="border border-white/15 bg-white/5 text-white hover:bg-white/10"
                        onClick={() => void openEdit(a.id)}
                      >
                        Edit
                      </Button>
                      <a
                        className="inline-flex h-10 items-center justify-center rounded-md border border-white/15 bg-white/5 px-4 text-sm font-semibold text-white hover:bg-white/10"
                        href={`/kb/${encodeURIComponent(a.slug)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
              {!results.length ? (
                <tr>
                  <td className="py-4 text-[color:var(--muted)]" colSpan={6}>
                    No KB articles yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      {editOpen ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center overflow-hidden bg-black/70 px-4 py-10"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) setEditOpen(false);
          }}
        >
          <div className="w-full max-w-4xl">
            <Card className="p-0">
              <div className="flex max-h-[calc(100vh-80px)] flex-col overflow-hidden">
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 p-6">
                <div>
                  <h3 className="text-lg font-semibold">{editId ? "Edit KB article" : "New KB article"}</h3>
                  <p className="mt-1 text-sm text-white/70">Markdown content is supported.</p>
                </div>
                <Button
                  type="button"
                  className="border border-white/15 bg-white/5 text-white hover:bg-white/10"
                  onClick={() => setEditOpen(false)}
                  disabled={saving}
                >
                  Close
                </Button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-6">
                  {editLoading ? (
                    <div className="text-sm text-[color:var(--muted)]">Loading…</div>
                  ) : (
                    <>
                      {formError ? <div className="mb-4 text-sm text-red-300">{formError}</div> : null}

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2 sm:col-span-2">
                      <Label>Title</Label>
                      <Input
                        value={editForm.title}
                        onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value, slug: f.slug || normalizeSlug(e.target.value) }))}
                        placeholder="How to submit film"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Slug</Label>
                      <Input value={editForm.slug} onChange={(e) => setEditForm((f) => ({ ...f, slug: normalizeSlug(e.target.value) }))} placeholder="how-to-submit-film" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Status</Label>
                      <select
                        className="w-full rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary-600)]"
                        value={editForm.status}
                        onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as any }))}
                      >
                        <option value="draft">draft</option>
                        <option value="published">published</option>
                      </select>
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
                      <Label>Summary</Label>
                      <Input value={editForm.summary} onChange={(e) => setEditForm((f) => ({ ...f, summary: e.target.value }))} placeholder="Short description shown in search results…" />
                    </div>
                    <div className="grid gap-2">
                      <Label>Category</Label>
                      <select
                        className="w-full rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary-600)]"
                        value={editForm.category}
                        onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                      >
                        <option value="">(none)</option>
                        {KB_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Tags (comma separated)</Label>
                      <Input value={editForm.tagsCsv} onChange={(e) => setEditForm((f) => ({ ...f, tagsCsv: e.target.value }))} placeholder="film, evaluations" />
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
                      <Label>helpKeys (comma separated)</Label>
                      <Input value={editForm.helpKeysCsv} onChange={(e) => setEditForm((f) => ({ ...f, helpKeysCsv: e.target.value }))} placeholder="player.film.submit, player.dashboard" />
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
                      <Label>Body (Markdown)</Label>
                      <textarea
                        className="min-h-64 w-full rounded-md border border-[color:var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary-600)]"
                        value={editForm.body}
                        onChange={(e) => setEditForm((f) => ({ ...f, body: e.target.value }))}
                        placeholder={"# Title\n\nWrite the article in Markdown…"}
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-2">
                    <Button type="button" onClick={() => void save("save")} disabled={saving}>
                      {saving ? "Saving…" : "Save"}
                    </Button>
                    <Button
                      type="button"
                      className="border border-white/15 bg-white/5 text-white hover:bg-white/10"
                      onClick={() => void save("publish")}
                      disabled={saving}
                    >
                      Publish
                    </Button>
                    <Button
                      type="button"
                      className="border border-white/15 bg-white/5 text-white hover:bg-white/10"
                      onClick={() => void save("unpublish")}
                      disabled={saving}
                    >
                      Unpublish
                    </Button>
                  </div>
                  <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="text-sm font-semibold text-white/90">History</div>
                    <div className="mt-2 text-xs text-[color:var(--muted)]">Every publish/update is recorded.</div>
                    {editId ? (
                      historyLoading ? (
                        <div className="mt-3 text-sm text-[color:var(--muted)]">Loading history…</div>
                      ) : history?.length ? (
                        <div className="mt-3 grid gap-2">
                          {history.map((h) => (
                            <div key={h.id} className="rounded-lg border border-white/10 bg-black/10 px-3 py-2 text-sm">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="font-semibold text-white/90">{h.action}</div>
                                <div className="text-xs text-[color:var(--muted-2)]">
                                  {h.createdAt ? new Date(h.createdAt).toLocaleString() : "—"}
                                </div>
                              </div>
                              <div className="mt-1 text-xs text-[color:var(--muted)]">By: {h.actor?.displayName ?? "—"}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-3 text-sm text-[color:var(--muted)]">No history yet.</div>
                      )
                    ) : (
                      <div className="mt-3 text-sm text-[color:var(--muted)]">History will appear after you create the article.</div>
                    )}
                  </div>
                </>
              )}
                </div>
              </div>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}


