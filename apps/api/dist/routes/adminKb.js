import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { ROLE } from "@goeducate/shared";
import { ApiError } from "../http/errors.js";
import { zodToBadRequest } from "../http/zod.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { KnowledgeBaseArticleModel } from "../models/KnowledgeBaseArticle.js";
import { KnowledgeBaseEventModel } from "../models/KnowledgeBaseEvent.js";
export const adminKbRouter = Router();
function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function normalizeSlug(input) {
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
    category: z.string().min(1).max(80).optional(),
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
        const match = {};
        if (status && ["draft", "published"].includes(status))
            match.status = status;
        if (category)
            match.category = category;
        if (helpKey)
            match.helpKeys = helpKey;
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
            results: rows.map((r) => ({
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
    }
    catch (err) {
        return next(err);
    }
});
adminKbRouter.get("/admin/kb/articles/:id", async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Article not found" }));
        }
        const article = await KnowledgeBaseArticleModel.findById(req.params.id).lean();
        if (!article)
            return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Article not found" }));
        return res.json({
            article: {
                id: String(article._id),
                title: article.title,
                slug: article.slug,
                summary: article.summary ?? null,
                body: article.body,
                tags: article.tags ?? [],
                category: article.category ?? null,
                helpKeys: article.helpKeys ?? [],
                status: article.status,
                version: article.version ?? 1,
                publishedAt: article.publishedAt ?? null,
                createdAt: article.createdAt ?? null,
                updatedAt: article.updatedAt ?? null,
                createdByUserId: String(article.createdByUserId),
                updatedByUserId: article.updatedByUserId ? String(article.updatedByUserId) : null
            }
        });
    }
    catch (err) {
        return next(err);
    }
});
adminKbRouter.post("/admin/kb/articles", async (req, res, next) => {
    const parsed = ArticleUpsertSchema.safeParse(req.body);
    if (!parsed.success)
        return next(zodToBadRequest(parsed.error.flatten()));
    try {
        const slug = normalizeSlug(parsed.data.slug);
        if (!slug)
            return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid slug" }));
        const existing = await KnowledgeBaseArticleModel.findOne({ slug }).lean();
        if (existing)
            return next(new ApiError({ status: 409, code: "SLUG_TAKEN", message: "Slug already exists" }));
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
            createdByUserId: new mongoose.Types.ObjectId(req.user.id),
            updatedByUserId: new mongoose.Types.ObjectId(req.user.id)
        });
        void KnowledgeBaseEventModel.create({
            type: "kb_open",
            userId: new mongoose.Types.ObjectId(req.user.id),
            meta: { action: "admin_create", articleId: String(created._id), slug }
        }).catch(() => { });
        return res.json({ article: { id: String(created._id), slug: created.slug } });
    }
    catch (err) {
        return next(err);
    }
});
adminKbRouter.put("/admin/kb/articles/:id", async (req, res, next) => {
    const parsed = ArticleUpsertSchema.safeParse(req.body);
    if (!parsed.success)
        return next(zodToBadRequest(parsed.error.flatten()));
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Article not found" }));
        }
        const article = await KnowledgeBaseArticleModel.findById(req.params.id);
        if (!article)
            return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Article not found" }));
        const slug = normalizeSlug(parsed.data.slug);
        if (!slug)
            return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid slug" }));
        if (slug !== article.slug) {
            const existing = await KnowledgeBaseArticleModel.findOne({ slug }).lean();
            if (existing)
                return next(new ApiError({ status: 409, code: "SLUG_TAKEN", message: "Slug already exists" }));
            article.slug = slug;
        }
        article.title = parsed.data.title.trim();
        article.summary = parsed.data.summary?.trim();
        article.body = parsed.data.body;
        article.tags = Array.from(new Set((parsed.data.tags ?? []).map((t) => String(t).trim().toLowerCase()).filter(Boolean))).slice(0, 30);
        article.helpKeys = Array.from(new Set((parsed.data.helpKeys ?? []).map((k) => String(k).trim()).filter(Boolean))).slice(0, 50);
        article.category = parsed.data.category ? String(parsed.data.category).trim().toLowerCase() : undefined;
        article.updatedByUserId = new mongoose.Types.ObjectId(req.user.id);
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
        return res.json({ article: { id: String(article._id), slug: article.slug, status: article.status, version: article.version } });
    }
    catch (err) {
        return next(err);
    }
});
adminKbRouter.post("/admin/kb/articles/:id/publish", async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Article not found" }));
        }
        const article = await KnowledgeBaseArticleModel.findById(req.params.id);
        if (!article)
            return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Article not found" }));
        article.status = "published";
        article.publishedAt = article.publishedAt ?? new Date();
        article.updatedByUserId = new mongoose.Types.ObjectId(req.user.id);
        article.version = (article.version ?? 1) + 1;
        await article.save();
        return res.json({ ok: true, status: article.status, publishedAt: article.publishedAt });
    }
    catch (err) {
        return next(err);
    }
});
adminKbRouter.post("/admin/kb/articles/:id/unpublish", async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Article not found" }));
        }
        const article = await KnowledgeBaseArticleModel.findById(req.params.id);
        if (!article)
            return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Article not found" }));
        article.status = "draft";
        article.updatedByUserId = new mongoose.Types.ObjectId(req.user.id);
        article.version = (article.version ?? 1) + 1;
        await article.save();
        return res.json({ ok: true, status: article.status });
    }
    catch (err) {
        return next(err);
    }
});
adminKbRouter.delete("/admin/kb/articles/:id", async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Article not found" }));
        }
        await KnowledgeBaseArticleModel.deleteOne({ _id: req.params.id });
        return res.json({ ok: true });
    }
    catch (err) {
        return next(err);
    }
});
//# sourceMappingURL=adminKb.js.map