import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";

import { ROLE } from "@goeducate/shared";

import { ApiError } from "../http/errors.js";
import { zodToBadRequest } from "../http/zod.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { KnowledgeBaseArticleModel } from "../models/KnowledgeBaseArticle.js";
import { KnowledgeBaseEventModel } from "../models/KnowledgeBaseEvent.js";
import { KnowledgeBaseArticleHistoryModel } from "../models/KnowledgeBaseArticleHistory.js";
import { UserModel } from "../models/User.js";

export const adminKbRouter = Router();

export const KB_CATEGORIES = [
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

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSlug(input: string) {
  const raw = String(input ?? "").trim().toLowerCase();
  const cleaned = raw
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 220);
  return cleaned;
}

const ArticleUpsertSchema = z.object({
  title: z.string().min(3).max(200),
  slug: z.string().min(3).max(220),
  summary: z.string().max(500).optional(),
  body: z.string().min(1).max(200_000),
  tags: z.array(z.string().min(1).max(60)).optional().default([]),
  category: z.enum(KB_CATEGORIES).optional(),
  helpKeys: z.array(z.string().min(1).max(140)).optional().default([]),
  status: z.enum(["draft", "published"]).optional()
});

adminKbRouter.use(requireAuth, requireRole([ROLE.ADMIN]));

adminKbRouter.get("/admin/kb/articles", async (req, res, next) => {
  try {
    const q = String(req.query.q ?? "").trim();
    const status = String(req.query.status ?? "").trim().toLowerCase();
    const category = String(req.query.category ?? "").trim().toLowerCase();
    const helpKey = String(req.query.helpKey ?? "").trim();
    const limitRaw = Number(req.query.limit ?? 25);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : 25;
    const skipRaw = Number(req.query.skip ?? 0);
    const skip = Number.isFinite(skipRaw) ? Math.max(0, Math.min(50_000, skipRaw)) : 0;

    const match: any = {};
    if (status && ["draft", "published"].includes(status)) match.status = status;
    if (category) match.category = category;
    if (helpKey) match.helpKeys = helpKey;
    if (q) {
      const rx = new RegExp(escapeRegex(q), "i");
      match.$or = [{ title: rx }, { slug: rx }, { tags: rx }, { category: rx }, { helpKeys: rx }];
    }

    const [total, rows] = await Promise.all([
      KnowledgeBaseArticleModel.countDocuments(match),
      KnowledgeBaseArticleModel.find(match)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select({
          title: 1,
          slug: 1,
          summary: 1,
          tags: 1,
          category: 1,
          helpKeys: 1,
          status: 1,
          version: 1,
          publishedAt: 1,
          createdAt: 1,
          updatedAt: 1
        })
        .lean()
    ]);

    return res.json({
      q,
      status: status || null,
      category: category || null,
      helpKey: helpKey || null,
      total,
      skip,
      limit,
      results: rows.map((r: any) => ({
        id: String(r._id),
        title: r.title,
        slug: r.slug,
        summary: r.summary ?? null,
        tags: r.tags ?? [],
        category: r.category ?? null,
        helpKeys: r.helpKeys ?? [],
        status: r.status,
        version: r.version ?? 1,
        publishedAt: r.publishedAt ?? null,
        createdAt: r.createdAt ?? null,
        updatedAt: r.updatedAt ?? null
      }))
    });
  } catch (err) {
    return next(err);
  }
});

adminKbRouter.get("/admin/kb/articles/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Article not found" }));
    }
    const article = await KnowledgeBaseArticleModel.findById(req.params.id).lean();
    if (!article) return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Article not found" }));
    return res.json({
      article: {
        id: String((article as any)._id),
        title: (article as any).title,
        slug: (article as any).slug,
        summary: (article as any).summary ?? null,
        body: (article as any).body,
        tags: (article as any).tags ?? [],
        category: (article as any).category ?? null,
        helpKeys: (article as any).helpKeys ?? [],
        status: (article as any).status,
        version: (article as any).version ?? 1,
        publishedAt: (article as any).publishedAt ?? null,
        createdAt: (article as any).createdAt ?? null,
        updatedAt: (article as any).updatedAt ?? null,
        createdByUserId: String((article as any).createdByUserId),
        updatedByUserId: (article as any).updatedByUserId ? String((article as any).updatedByUserId) : null
      }
    });
  } catch (err) {
    return next(err);
  }
});

adminKbRouter.get("/admin/kb/articles/:id/history", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Article not found" }));
    }
    const limitRaw = Number(req.query.limit ?? 50);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 50;

    const rows = await KnowledgeBaseArticleHistoryModel.find({ articleId: new mongoose.Types.ObjectId(req.params.id) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const actorIds = Array.from(new Set(rows.map((r: any) => String(r.actorUserId)).filter(Boolean)));
    const actors = await UserModel.find({ _id: { $in: actorIds } }).select({ email: 1, firstName: 1, lastName: 1, role: 1 }).lean();
    const actorById = new Map(actors.map((u: any) => [String(u._id), u]));

    return res.json({
      history: rows.map((r: any) => {
        const actor = actorById.get(String(r.actorUserId));
        const displayName =
          actor?.firstName ? `${actor.firstName} ${actor.lastName ?? ""}`.trim() : actor?.email ?? String(r.actorUserId);
        return {
          id: String(r._id),
          action: r.action,
          createdAt: r.createdAt ?? null,
          actor: actor
            ? { id: String(actor._id), email: actor.email, role: actor.role, displayName }
            : { id: String(r.actorUserId), displayName }
        };
      })
    });
  } catch (err) {
    return next(err);
  }
});

adminKbRouter.post("/admin/kb/articles", async (req, res, next) => {
  const parsed = ArticleUpsertSchema.safeParse(req.body);
  if (!parsed.success) return next(zodToBadRequest(parsed.error.flatten()));

  try {
    const slug = normalizeSlug(parsed.data.slug);
    if (!slug) return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid slug" }));
    const existing = await KnowledgeBaseArticleModel.findOne({ slug }).lean();
    if (existing) return next(new ApiError({ status: 409, code: "SLUG_TAKEN", message: "Slug already exists" }));

    const tags = Array.from(new Set((parsed.data.tags ?? []).map((t) => String(t).trim().toLowerCase()).filter(Boolean))).slice(0, 30);
    const helpKeys = Array.from(new Set((parsed.data.helpKeys ?? []).map((k) => String(k).trim()).filter(Boolean))).slice(0, 50);
    const category = parsed.data.category ? String(parsed.data.category).trim().toLowerCase() : undefined;

    const created = await KnowledgeBaseArticleModel.create({
      title: parsed.data.title.trim(),
      slug,
      summary: parsed.data.summary?.trim(),
      body: parsed.data.body,
      tags,
      category,
      helpKeys,
      status: parsed.data.status === "published" ? "published" : "draft",
      publishedAt: parsed.data.status === "published" ? new Date() : undefined,
      version: 1,
      createdByUserId: new mongoose.Types.ObjectId(req.user!.id),
      updatedByUserId: new mongoose.Types.ObjectId(req.user!.id)
    });

    await KnowledgeBaseArticleHistoryModel.create({
      articleId: created._id,
      action: "created",
      actorUserId: new mongoose.Types.ObjectId(req.user!.id),
      snapshot: {
        title: created.title,
        slug: created.slug,
        summary: created.summary,
        body: created.body,
        tags: created.tags,
        category: created.category,
        helpKeys: created.helpKeys,
        status: created.status,
        version: created.version,
        publishedAt: created.publishedAt
      }
    });

    void KnowledgeBaseEventModel.create({
      type: "kb_open",
      userId: new mongoose.Types.ObjectId(req.user!.id),
      meta: { action: "admin_create", articleId: String(created._id), slug }
    }).catch(() => {});

    return res.json({ article: { id: String(created._id), slug: created.slug } });
  } catch (err) {
    return next(err);
  }
});

adminKbRouter.put("/admin/kb/articles/:id", async (req, res, next) => {
  const parsed = ArticleUpsertSchema.safeParse(req.body);
  if (!parsed.success) return next(zodToBadRequest(parsed.error.flatten()));

  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Article not found" }));
    }
    const article = await KnowledgeBaseArticleModel.findById(req.params.id);
    if (!article) return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Article not found" }));

    const slug = normalizeSlug(parsed.data.slug);
    if (!slug) return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid slug" }));
    if (slug !== article.slug) {
      const existing = await KnowledgeBaseArticleModel.findOne({ slug }).lean();
      if (existing) return next(new ApiError({ status: 409, code: "SLUG_TAKEN", message: "Slug already exists" }));
      article.slug = slug;
    }

    article.title = parsed.data.title.trim();
    article.summary = parsed.data.summary?.trim();
    article.body = parsed.data.body;
    article.tags = Array.from(new Set((parsed.data.tags ?? []).map((t) => String(t).trim().toLowerCase()).filter(Boolean))).slice(0, 30) as any;
    article.helpKeys = Array.from(new Set((parsed.data.helpKeys ?? []).map((k) => String(k).trim()).filter(Boolean))).slice(0, 50) as any;
    article.category = parsed.data.category ? String(parsed.data.category).trim().toLowerCase() : undefined;
    article.updatedByUserId = new mongoose.Types.ObjectId(req.user!.id);
    article.version = (article.version ?? 1) + 1;

    // Allow admin to set status inline if desired
    if (parsed.data.status === "draft") {
      article.status = "draft";
      article.publishedAt = undefined;
    }
    if (parsed.data.status === "published") {
      article.status = "published";
      article.publishedAt = article.publishedAt ?? new Date();
    }

    await article.save();
    await KnowledgeBaseArticleHistoryModel.create({
      articleId: article._id,
      action: "updated",
      actorUserId: new mongoose.Types.ObjectId(req.user!.id),
      snapshot: {
        title: article.title,
        slug: article.slug,
        summary: article.summary,
        body: article.body,
        tags: article.tags,
        category: article.category,
        helpKeys: article.helpKeys,
        status: article.status,
        version: article.version,
        publishedAt: article.publishedAt
      }
    });
    return res.json({ article: { id: String(article._id), slug: article.slug, status: article.status, version: article.version } });
  } catch (err) {
    return next(err);
  }
});

adminKbRouter.post("/admin/kb/articles/:id/publish", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Article not found" }));
    }
    const article = await KnowledgeBaseArticleModel.findById(req.params.id);
    if (!article) return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Article not found" }));
    article.status = "published";
    article.publishedAt = article.publishedAt ?? new Date();
    article.updatedByUserId = new mongoose.Types.ObjectId(req.user!.id);
    article.version = (article.version ?? 1) + 1;
    await article.save();
    await KnowledgeBaseArticleHistoryModel.create({
      articleId: article._id,
      action: "published",
      actorUserId: new mongoose.Types.ObjectId(req.user!.id),
      snapshot: {
        title: article.title,
        slug: article.slug,
        summary: article.summary,
        body: article.body,
        tags: article.tags,
        category: article.category,
        helpKeys: article.helpKeys,
        status: article.status,
        version: article.version,
        publishedAt: article.publishedAt
      }
    });
    return res.json({ ok: true, status: article.status, publishedAt: article.publishedAt });
  } catch (err) {
    return next(err);
  }
});

adminKbRouter.post("/admin/kb/articles/:id/unpublish", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Article not found" }));
    }
    const article = await KnowledgeBaseArticleModel.findById(req.params.id);
    if (!article) return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Article not found" }));
    article.status = "draft";
    article.updatedByUserId = new mongoose.Types.ObjectId(req.user!.id);
    article.version = (article.version ?? 1) + 1;
    await article.save();
    await KnowledgeBaseArticleHistoryModel.create({
      articleId: article._id,
      action: "unpublished",
      actorUserId: new mongoose.Types.ObjectId(req.user!.id),
      snapshot: {
        title: article.title,
        slug: article.slug,
        summary: article.summary,
        body: article.body,
        tags: article.tags,
        category: article.category,
        helpKeys: article.helpKeys,
        status: article.status,
        version: article.version,
        publishedAt: article.publishedAt
      }
    });
    return res.json({ ok: true, status: article.status });
  } catch (err) {
    return next(err);
  }
});

adminKbRouter.delete("/admin/kb/articles/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Article not found" }));
    }
    const article = await KnowledgeBaseArticleModel.findById(req.params.id);
    if (article) {
      await KnowledgeBaseArticleHistoryModel.create({
        articleId: article._id,
        action: "deleted",
        actorUserId: new mongoose.Types.ObjectId(req.user!.id),
        snapshot: {
          title: article.title,
          slug: article.slug,
          summary: article.summary,
          body: article.body,
          tags: article.tags,
          category: article.category,
          helpKeys: article.helpKeys,
          status: article.status,
          version: article.version,
          publishedAt: article.publishedAt
        }
      });
    }
    await KnowledgeBaseArticleModel.deleteOne({ _id: req.params.id });
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});


