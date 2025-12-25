import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { ROLE } from "@goeducate/shared";
import { ApiError } from "../http/errors.js";
import { zodToBadRequest } from "../http/zod.js";
import { maybeAuth, requireAuth } from "../middleware/auth.js";
import { KnowledgeBaseArticleModel } from "../models/KnowledgeBaseArticle.js";
import { KnowledgeBaseEventModel } from "../models/KnowledgeBaseEvent.js";
import { KnowledgeBaseFeedbackModel } from "../models/KnowledgeBaseFeedback.js";
export const kbRouter = Router();
function isAdmin(req) {
    return req.user?.role === ROLE.ADMIN;
}
// Search/browse KB (published only unless admin)
kbRouter.get("/kb/search", maybeAuth, async (req, res, next) => {
    try {
        const q = String(req.query.q ?? "").trim();
        const tag = String(req.query.tag ?? "").trim().toLowerCase();
        const category = String(req.query.category ?? "").trim().toLowerCase();
        const helpKey = String(req.query.helpKey ?? "").trim();
        const limitRaw = Number(req.query.limit ?? 20);
        const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, limitRaw)) : 20;
        const skipRaw = Number(req.query.skip ?? 0);
        const skip = Number.isFinite(skipRaw) ? Math.max(0, Math.min(50_000, skipRaw)) : 0;
        const admin = isAdmin(req);
        const match = {};
        if (!admin)
            match.status = "published";
        if (tag)
            match.tags = tag;
        if (category)
            match.category = category;
        if (helpKey)
            match.helpKeys = helpKey;
        const find = { ...match };
        let sort = { updatedAt: -1 };
        let projection = {
            _id: 0,
            id: "$_id",
            title: 1,
            slug: 1,
            summary: 1,
            tags: 1,
            category: 1,
            helpKeys: 1,
            status: 1,
            updatedAt: 1,
            publishedAt: 1,
            helpfulYesCount: 1,
            helpfulNoCount: 1
        };
        if (q) {
            find.$text = { $search: q };
            sort = { score: { $meta: "textScore" }, updatedAt: -1 };
            projection = { ...projection, score: { $meta: "textScore" } };
        }
        const [total, rows] = await Promise.all([
            KnowledgeBaseArticleModel.countDocuments(find),
            KnowledgeBaseArticleModel.find(find, projection).sort(sort).skip(skip).limit(limit).lean()
        ]);
        // Telemetry (best-effort)
        void KnowledgeBaseEventModel.create({
            type: "kb_search",
            userId: req.user?.id ? new mongoose.Types.ObjectId(req.user.id) : undefined,
            helpKey: helpKey || undefined,
            q: q || undefined,
            meta: { tag: tag || undefined, category: category || undefined }
        }).catch(() => { });
        return res.json({
            q,
            tag: tag || null,
            category: category || null,
            helpKey: helpKey || null,
            skip,
            limit,
            total,
            results: rows.map((r) => ({
                id: String(r.id ?? r._id),
                title: r.title,
                slug: r.slug,
                summary: r.summary ?? null,
                tags: r.tags ?? [],
                category: r.category ?? null,
                helpKeys: r.helpKeys ?? [],
                status: r.status,
                updatedAt: r.updatedAt,
                publishedAt: r.publishedAt ?? null,
                helpfulYesCount: r.helpfulYesCount ?? 0,
                helpfulNoCount: r.helpfulNoCount ?? 0,
                score: r.score ?? null
            }))
        });
    }
    catch (err) {
        return next(err);
    }
});
// Article detail (published only unless admin)
kbRouter.get("/kb/articles/:slug", maybeAuth, async (req, res, next) => {
    try {
        const slug = String(req.params.slug ?? "").trim().toLowerCase();
        if (!slug)
            return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Not found" }));
        const admin = isAdmin(req);
        const article = await KnowledgeBaseArticleModel.findOne({
            slug,
            ...(admin ? {} : { status: "published" })
        })
            .select({
            title: 1,
            slug: 1,
            summary: 1,
            body: 1,
            tags: 1,
            category: 1,
            helpKeys: 1,
            status: 1,
            version: 1,
            publishedAt: 1,
            createdAt: 1,
            updatedAt: 1,
            helpfulYesCount: 1,
            helpfulNoCount: 1
        })
            .lean();
        if (!article)
            return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Article not found" }));
        // Related articles (best-effort): same helpKey or category, exclude self
        const related = await KnowledgeBaseArticleModel.find({
            _id: { $ne: article._id },
            ...(admin ? {} : { status: "published" }),
            $or: [
                article.helpKeys?.length ? { helpKeys: { $in: article.helpKeys } } : null,
                article.category ? { category: article.category } : null
            ].filter(Boolean)
        })
            .select({ title: 1, slug: 1, summary: 1, updatedAt: 1 })
            .sort({ updatedAt: -1 })
            .limit(6)
            .lean();
        void KnowledgeBaseEventModel.create({
            type: "kb_article_view",
            userId: req.user?.id ? new mongoose.Types.ObjectId(req.user.id) : undefined,
            slug,
            meta: { status: article.status }
        }).catch(() => { });
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
                helpfulYesCount: article.helpfulYesCount ?? 0,
                helpfulNoCount: article.helpfulNoCount ?? 0
            },
            related: related.map((r) => ({
                title: r.title,
                slug: r.slug,
                summary: r.summary ?? null,
                updatedAt: r.updatedAt ?? null
            }))
        });
    }
    catch (err) {
        return next(err);
    }
});
kbRouter.get("/kb/categories", maybeAuth, async (req, res, next) => {
    try {
        const admin = isAdmin(req);
        const match = { category: { $ne: null } };
        if (!admin)
            match.status = "published";
        const categories = await KnowledgeBaseArticleModel.distinct("category", match);
        return res.json({ categories: (categories ?? []).filter(Boolean).sort() });
    }
    catch (err) {
        return next(err);
    }
});
kbRouter.get("/kb/tags", maybeAuth, async (req, res, next) => {
    try {
        const admin = isAdmin(req);
        const match = {};
        if (!admin)
            match.status = "published";
        const tags = await KnowledgeBaseArticleModel.distinct("tags", match);
        return res.json({ tags: (tags ?? []).filter(Boolean).sort() });
    }
    catch (err) {
        return next(err);
    }
});
// Feedback (was this helpful?)
kbRouter.post("/kb/articles/:slug/feedback", requireAuth, async (req, res, next) => {
    const parsed = z.object({ helpful: z.boolean() }).safeParse(req.body);
    if (!parsed.success)
        return next(zodToBadRequest(parsed.error.flatten()));
    try {
        const slug = String(req.params.slug ?? "").trim().toLowerCase();
        const article = await KnowledgeBaseArticleModel.findOne({ slug });
        if (!article)
            return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Article not found" }));
        if (article.status !== "published" && req.user?.role !== ROLE.ADMIN) {
            return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Article not found" }));
        }
        const userId = new mongoose.Types.ObjectId(req.user.id);
        const existing = await KnowledgeBaseFeedbackModel.findOne({ articleId: article._id, userId }).lean();
        const helpful = parsed.data.helpful;
        if (!existing) {
            await KnowledgeBaseFeedbackModel.create({ articleId: article._id, userId, helpful });
            if (helpful)
                article.helpfulYesCount += 1;
            else
                article.helpfulNoCount += 1;
            await article.save();
        }
        else if (existing.helpful !== helpful) {
            await KnowledgeBaseFeedbackModel.updateOne({ articleId: article._id, userId }, { $set: { helpful } });
            if (helpful) {
                article.helpfulYesCount += 1;
                article.helpfulNoCount = Math.max(0, article.helpfulNoCount - 1);
            }
            else {
                article.helpfulNoCount += 1;
                article.helpfulYesCount = Math.max(0, article.helpfulYesCount - 1);
            }
            await article.save();
        }
        void KnowledgeBaseEventModel.create({
            type: "kb_feedback",
            userId,
            slug,
            meta: { helpful }
        }).catch(() => { });
        return res.json({
            ok: true,
            helpfulYesCount: article.helpfulYesCount,
            helpfulNoCount: article.helpfulNoCount
        });
    }
    catch (err) {
        return next(err);
    }
});
// Telemetry hook (optional; best-effort)
kbRouter.post("/kb/events", maybeAuth, async (req, res, next) => {
    const parsed = z
        .object({
        type: z.enum(["kb_open", "kb_search", "kb_article_view", "kb_feedback"]),
        helpKey: z.string().min(1).max(140).optional(),
        q: z.string().min(1).max(400).optional(),
        slug: z.string().min(1).max(220).optional(),
        meta: z.record(z.string(), z.unknown()).optional()
    })
        .safeParse(req.body);
    if (!parsed.success)
        return next(zodToBadRequest(parsed.error.flatten()));
    try {
        await KnowledgeBaseEventModel.create({
            type: parsed.data.type,
            userId: req.user?.id ? new mongoose.Types.ObjectId(req.user.id) : undefined,
            helpKey: parsed.data.helpKey,
            q: parsed.data.q,
            slug: parsed.data.slug,
            meta: parsed.data.meta
        });
        return res.json({ ok: true });
    }
    catch (err) {
        return next(err);
    }
});
//# sourceMappingURL=kb.js.map