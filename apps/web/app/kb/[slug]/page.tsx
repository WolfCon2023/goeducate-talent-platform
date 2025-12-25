import Link from "next/link";

import { apiFetch } from "@/lib/api";
import { Card, Button } from "@/components/ui";
import { Markdown } from "@/components/kb/Markdown";
import { FeedbackButtons } from "./FeedbackButtons";

type Article = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  body: string;
  tags: string[];
  category: string | null;
  helpKeys: string[];
  status: "draft" | "published";
  version: number;
  publishedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  helpfulYesCount: number;
  helpfulNoCount: number;
};

export default async function KbArticlePage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  let data: { article: Article; related: Array<{ title: string; slug: string; summary: string | null; updatedAt: string | null }> } | null = null;
  let err: string | null = null;
  try {
    data = await apiFetch(`/kb/articles/${encodeURIComponent(slug)}`, { retries: 2, retryOn404: true });
  } catch (e) {
    err = e instanceof Error ? e.message : "Failed to load article";
  }

  if (err || !data?.article) {
    return (
      <div className="grid gap-6">
        <Card>
          <div className="text-xl font-semibold">Knowledge Base</div>
          <div className="mt-2 text-sm text-[color:var(--muted)]">{err ?? "Article not found."}</div>
          <div className="mt-4">
            <Link href="/kb">
              <Button type="button" className="border border-white/15 bg-white/5 text-white hover:bg-white/10">
                Back to KB
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const { article, related } = data;

  return (
    <div className="grid gap-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs text-[color:var(--muted-2)]">
              <Link href="/kb" className="text-indigo-300 hover:text-indigo-200 hover:underline">
                Knowledge Base
              </Link>{" "}
              / {article.slug}
            </div>
            <h1 className="mt-2 text-xl font-semibold">{article.title}</h1>
            {article.summary ? <div className="mt-2 text-sm text-[color:var(--muted)]">{article.summary}</div> : null}
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[color:var(--muted-2)]">
              {article.category ? <span className="rounded-full border border-white/10 bg-black/10 px-2 py-0.5">{article.category}</span> : null}
              {(article.tags ?? []).map((t) => (
                <Link
                  key={t}
                  href={`/kb?tag=${encodeURIComponent(t)}`}
                  className="rounded-full border border-white/10 bg-black/10 px-2 py-0.5 hover:bg-white/10"
                >
                  #{t}
                </Link>
              ))}
            </div>
          </div>
          <div className="shrink-0 text-right text-xs text-[color:var(--muted-2)]">
            <div>{article.status === "draft" ? "Draft" : "Published"}</div>
            <div className="mt-1">Updated: {article.updatedAt ? new Date(article.updatedAt).toLocaleString() : "—"}</div>
          </div>
        </div>

        <div className="mt-6">
          <Markdown markdown={article.body} />
        </div>

        <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold">Was this helpful?</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <FeedbackButtons slug={article.slug} initialYes={article.helpfulYesCount} initialNo={article.helpfulNoCount} />
          </div>
        </div>
      </Card>

      {related?.length ? (
        <Card>
          <div className="text-sm font-semibold">Related articles</div>
          <div className="mt-3 grid gap-2">
            {related.map((r) => (
              <Link
                key={r.slug}
                href={`/kb/${encodeURIComponent(r.slug)}`}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10"
              >
                <div className="text-sm font-semibold text-white/90">{r.title}</div>
                {r.summary ? <div className="mt-0.5 text-xs text-[color:var(--muted)]">{r.summary}</div> : null}
              </Link>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

