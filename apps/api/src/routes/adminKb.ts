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

adminKbRouter.post("/admin/kb/seed", async (req, res, next) => {
  try {
    const force = String((req.query as any).force ?? "") === "1";
    const actorUserId = new mongoose.Types.ObjectId(req.user!.id);

    type SeedArticle = {
      title: string;
      slug: string;
      summary: string;
      body: string;
      tags: string[];
      category: (typeof KB_CATEGORIES)[number];
      helpKeys: string[];
      status: "published" | "draft";
    };

    const seed: SeedArticle[] = [
      {
        title: "Player Dashboard",
        slug: "player-dashboard",
        summary: "Overview of the Player dashboard and where to find film submissions, evaluations, and next steps.",
        category: "getting-started",
        tags: ["player", "dashboard", "overview"],
        helpKeys: ["player.dashboard"],
        status: "published",
        body: [
          "# Player Dashboard",
          "",
          "## What this page is for",
          "Your Player dashboard is your home base to:",
          "- Submit film for evaluation",
          "- See where your submission is in the process",
          "- Open completed evaluation reports",
          "",
          "## Where to find it",
          "Header → **Home** (or go to `/player`).",
          "",
          "## Step-by-step: the typical workflow",
          "1. **Complete your profile** (recommended) → header dropdown → **Edit profile**.",
          "2. Go to **Film** → `/player/film`.",
          "3. Submit film (URL or upload).",
          "4. Watch status updates on your dashboard/film list:",
          "   - `submitted` → received and in the queue",
          "   - `in_review` → an evaluator is actively reviewing",
          "   - `needs_changes` → you need to fix a link or submit a better video",
          "   - `completed` → evaluation is ready",
          "5. When completed, click **Open evaluation** to view the full report.",
          "",
          "## What happens next",
          "- You’ll receive an **in-app notification** when your evaluation is completed.",
          "- If email is configured, you’ll also receive an **email** with a link to the report.",
          "",
          "## Troubleshooting",
          "- **I don’t see Film**: you may be logged out or not logged in as a Player.",
          "- **My status never changes**: evaluations are completed by evaluators; contact support/admin for ETA.",
          "",
          "## Related articles",
          "- [Submit Film (Player)](/kb/articles/submit-film-player)",
          "- [Player Evaluation History](/kb/articles/player-evaluation-history)",
          "- [Player Profile](/kb/articles/player-profile)",
          "- [Notifications](/kb/articles/notifications)"
        ].join("\n")
      },
      {
        title: "Player Profile",
        slug: "player-profile",
        summary: "How to edit your player profile, manage visibility, and what coaches can see.",
        category: "profiles",
        tags: ["player", "profile", "visibility"],
        helpKeys: ["player.profile"],
        status: "published",
        body: [
          "# Player Profile",
          "",
          "## Where to find it",
          "Header → click your name → **Edit profile** (or go to `/player/profile`).",
          "",
          "## Why it matters",
          "- Better evaluation context for evaluators",
          "- Better discoverability and trust for coaches",
          "",
          "## Step-by-step: complete your profile",
          "1. Open `/player/profile`.",
          "2. Fill the basics (sport, position, graduation year/school).",
          "3. Add city/state and any athletic metrics you want to share.",
          "4. Click **Save** and confirm the success message.",
          "",
          "## Visibility & contact settings",
          "- **Public profile**: allows coaches to find and view your profile in search/map (when enabled).",
          "- **Contact visibility**: controls whether subscribed coaches can see your contact details (when enabled).",
          "",
          "## Troubleshooting",
          "- **Coach can’t find me**: confirm Public profile is enabled and sport/position are set.",
          "",
          "## Related articles",
          "- [Coach Search (Players)](/kb/articles/coach-search-players)",
          "- [Submit Film (Player)](/kb/articles/submit-film-player)"
        ].join("\n")
      },
      {
        title: "Submit Film (Player)",
        slug: "submit-film-player",
        summary: "Step-by-step guide to submitting film (URL or upload), what happens next, and common issues.",
        category: "film",
        tags: ["player", "film", "submit", "upload"],
        helpKeys: ["player.film.submit"],
        status: "published",
        body: [
          "# Submit Film (Player)",
          "",
          "## Where to submit",
          "Header → **Film** (or go to `/player/film`).",
          "",
          "## Step-by-step: submit film",
          "1. Go to `/player/film`.",
          "2. Click **Submit film**.",
          "3. Enter a **Title** (required). Recommended: `Opponent – YYYY-MM-DD`.",
          "4. Add **Opponent** and **Game date** (recommended).",
          "5. Provide **one** (required):",
          "   - Video URL (Hudl/YouTube/Vimeo/etc.), or",
          "   - Upload a video (if enabled).",
          "6. Add notes (optional): jersey #, timestamps, context.",
          "7. Click **Submit** and confirm success.",
          "",
          "## What happens next",
          "- Status becomes `submitted` and enters the evaluation queue.",
          "- If film/link is insufficient, status may change to `needs_changes`.",
          "- When completed, you get a notification (and email if configured).",
          "",
          "## Troubleshooting",
          "- **Video is required**: you must provide a URL or upload a file.",
          "- **Bad link**: ensure the URL opens while logged out / incognito (public or unlisted).",
          "",
          "## Related articles",
          "- [Player Evaluation History](/kb/articles/player-evaluation-history)",
          "- [Notifications](/kb/articles/notifications)"
        ].join("\n")
      },
      {
        title: "Player Evaluation History",
        slug: "player-evaluation-history",
        summary: "How to view completed evaluations and open/print reports.",
        category: "evaluations",
        tags: ["player", "evaluations", "reports"],
        helpKeys: ["player.evaluations"],
        status: "published",
        body: [
          "# Player Evaluation History",
          "",
          "## Where to find it",
          "Header → **Evaluations** (Players only) or go to `/player/evaluations`.",
          "",
          "## Step-by-step: open a report",
          "1. Open `/player/evaluations`.",
          "2. Find your submission.",
          "3. Click **Open evaluation** (available when status is `completed`).",
          "4. Use **Print/PDF** to save or share.",
          "",
          "## Troubleshooting",
          "- **No Open evaluation link**: evaluation not completed yet or submission needs changes.",
          "",
          "## Related articles",
          "- [Submit Film (Player)](/kb/articles/submit-film-player)",
          "- [Notifications](/kb/articles/notifications)"
        ].join("\n")
      },
      {
        title: "Notifications",
        slug: "notifications",
        summary: "How to use notifications, what they mean, and how to open deep links to the right place.",
        category: "notifications",
        tags: ["notifications", "alerts"],
        helpKeys: ["player.notifications", "coach.notifications", "evaluator.notifications", "notifications"],
        status: "published",
        body: [
          "# Notifications",
          "",
          "## What notifications are",
          "Notifications alert you when important events happen, such as:",
          "- Film submitted/received",
          "- Evaluation completed",
          "- Watchlist evaluation completed (coaches)",
          "- Admin operations alerts",
          "",
          "## Where to find them",
          "Header → **Notifications** (badge = unread count).",
          "",
          "## Step-by-step: use notifications",
          "1. Open Notifications from the header.",
          "2. Click a notification to follow the deep link to the correct page.",
          "3. Mark it as read (or bulk mark read) where available.",
          "",
          "## Troubleshooting",
          "- **Unread badge doesn’t change**: open the notifications page and mark items read.",
          "- **A link opens the wrong place**: report it to admin; links are type-based.",
          ""
        ].join("\n")
      },
      {
        title: "Messages",
        slug: "messages",
        summary: "How in-app messaging works (request/accept flow), and how to start a conversation by role.",
        category: "messages",
        tags: ["messages", "chat", "inbox"],
        helpKeys: ["messages.inbox", "player.messages", "coach.messages", "evaluator.messages"],
        status: "published",
        body: [
          "# Messages",
          "",
          "## What Messages are for",
          "Messages let you communicate in-app. Recipients are selected by name/email (typeahead) — you never need to paste IDs.",
          "",
          "## Where to find Messages",
          "Header → **Messages** (or go to `/messages`).",
          "",
          "## Step-by-step: start a conversation",
          "1. Open `/messages`.",
          "2. Choose the recipient role tab (Player/Coach/Evaluator).",
          "3. Type a name/email and select a user from the dropdown.",
          "4. Write your message and send.",
          "",
          "## Unread badge",
          "The header shows an unread badge next to **Messages** when you have unread items. Opening a conversation marks messages read.",
          "",
          "## Troubleshooting",
          "- **Can’t find a recipient**: they must be an allowed role and exist in the system.",
          ""
        ].join("\n")
      },
      {
        title: "Coach Dashboard",
        slug: "coach-dashboard",
        summary: "Overview of the Coach dashboard, including search, watchlist, and evaluation deep links.",
        category: "getting-started",
        tags: ["coach", "dashboard"],
        helpKeys: ["coach.dashboard"],
        status: "published",
        body: [
          "# Coach Dashboard",
          "",
          "## What this page is for",
          "Your Coach dashboard is your recruiting home base to:",
          "- Search public player profiles",
          "- Track prospects in your watchlist",
          "- Open evaluation deep links when new reports are posted",
          "- Manage subscription for contact access",
          "",
          "## Where to find it",
          "Header → **Home** (Coach) or go to `/coach`.",
          "",
          "## Step-by-step: recommended workflow",
          "1. Complete your coach profile: `/coach/profile`.",
          "2. Search for players: `/coach/search`.",
          "3. Open a player profile and add them to your **Watchlist**.",
          "4. Use **Notifications** to open evaluation deep links when posted.",
          "5. If contact is locked, go to `/coach/billing` to subscribe.",
          "",
          "## Troubleshooting",
          "- **I can’t see contact info**: it may be hidden by the player or gated by subscription. Use Request contact or subscribe.",
          "",
          "## Related articles",
          "- [Coach Search (Players)](/kb/articles/coach-search-players)",
          "- [Coach: Viewing a Player Profile](/kb/articles/coach-view-player-profile)",
          "- [Coach Billing & Subscription](/kb/articles/coach-billing)",
          "- [Notifications](/kb/articles/notifications)"
        ].join("\n")
      },
      {
        title: "Coach Billing & Subscription",
        slug: "coach-billing",
        summary: "How to manage your Coach subscription, plan type, upgrades, and downgrades.",
        category: "billing-subscriptions",
        tags: ["coach", "billing", "subscription", "stripe"],
        helpKeys: ["coach.billing"],
        status: "published",
        body: [
          "# Coach Billing & Subscription",
          "",
          "## Where to find it",
          "Header → **Billing** (Coach) or go to `/coach/billing`.",
          "",
          "## What you’ll see",
          "- Subscription status: **active** or **inactive**",
          "- Plan type: **Monthly** or **Annual** (shown to prevent duplicate billing)",
          "- Renewal date (when available)",
          "",
          "## Step-by-step: start a subscription",
          "1. Open `/coach/billing`.",
          "2. Choose Monthly or Annual and click **Subscribe**.",
          "3. Complete Stripe Checkout.",
          "4. Return to the app and confirm status is **Active**.",
          "",
          "## Step-by-step: manage billing",
          "1. Open `/coach/billing`.",
          "2. Click **Manage billing** to open the Stripe Billing Portal.",
          "3. Update payment method, invoices, or cancel per your needs.",
          "",
          "## Annual → Monthly downgrade (scheduled)",
          "- If you downgrade from Annual to Monthly, the change is scheduled to take effect on your **annual renewal date**.",
          "- The page shows if a downgrade is already scheduled.",
          "",
          "## Troubleshooting",
          "- **Billing portal won’t open**: try again; portal links can expire.",
          "- **Status says active but plan is unknown**: contact admin; Stripe data may be missing or legacy.",
          ""
        ].join("\n")
      },
      {
        title: "Evaluator Notes Tool",
        slug: "evaluator-notes-tool",
        summary: "How evaluators take structured notes, autosave drafts, and copy content into evaluation forms.",
        category: "evaluations",
        tags: ["evaluator", "notes", "drafts"],
        helpKeys: ["evaluator.notes.tool"],
        status: "published",
        body: [
          "# Evaluator Notes Tool",
          "",
          "## What it is",
          "A structured note-taking tool designed for evaluators working live events. Use it to capture notes in a consistent format and transfer them into the official evaluation report.",
          "",
          "## Where to find it",
          "Go to `/evaluator/notes`.",
          "",
          "## Step-by-step: create a named draft (recommended at events)",
          "1. Open `/evaluator/notes`.",
          "2. Select sport/template context (if prompted).",
          "3. Start taking notes (autosave happens automatically).",
          "4. Click **Save as…** and name the draft (example: `Jane Doe – WR – 12/26`).",
          "5. Repeat per athlete so you can switch between drafts quickly.",
          "",
          "## Step-by-step: keep a draft updated",
          "- Use **Save now** to force-save any changes before switching devices or closing the browser.",
          "",
          "## Step-by-step: copy into the official evaluation",
          "1. Open the film submission: `/evaluator/film/[filmSubmissionId]`.",
          "2. In the notes tool, choose the copy format you prefer.",
          "3. Paste the content into the evaluation report fields and submit.",
          "",
          "## Troubleshooting",
          "- **Draft not showing on another device**: confirm you’re logged into the same evaluator account and refresh the drafts list.",
          "- **Draft name shows as Untitled**: use Save as… again and ensure the name field is not blank.",
          ""
        ].join("\n")
      },
      {
        title: "Admin: Knowledge Base Authoring",
        slug: "admin-kb-authoring",
        summary: "How admins create/edit/publish KB articles and link them to helpKeys.",
        category: "admin",
        tags: ["admin", "kb", "helpkeys", "publishing"],
        helpKeys: ["admin.kb.authoring"],
        status: "published",
        body: [
          "# Admin: Knowledge Base Authoring",
          "",
          "## Where to find it",
          "Admin → **KB** (or `/admin/kb`).",
          "",
          "## Goal",
          "KB articles should be practical and step-by-step so users can self-serve without support tickets.",
          "",
          "## How helpKeys work (important)",
          "- Each feature has a stable `helpKey` (example: `player.film.submit`).",
          "- Clicking the **?** icon opens KB filtered by that helpKey.",
          "- A single article can contain multiple helpKeys.",
          "",
          "## Recommended article template",
          "1. What this page is for",
          "2. Where to find it (route)",
          "3. Step-by-step instructions",
          "4. What happens next",
          "5. Troubleshooting/FAQs",
          "6. Related links",
          "",
          "## Step-by-step: create and publish an article",
          "1. Go to `/admin/kb`.",
          "2. Click **New article**.",
          "3. Fill Title, Slug, Category (dropdown), Tags, helpKeys.",
          "4. Write the content in Markdown using the template above.",
          "5. Click **Save** and confirm the toast.",
          "6. Click **Publish** when ready (only published articles are visible to non-admin users).",
          "",
          "## History / audit trail",
          "Open any article → **History** shows create/update/publish/unpublish actions and the actor.",
          ""
        ].join("\n")
      },
      {
        title: "Coach Profile",
        slug: "coach-profile",
        summary: "How coaches edit their profile and how profile fields affect maps/search.",
        category: "profiles",
        tags: ["coach", "profile", "location"],
        helpKeys: ["coach.profile"],
        status: "published",
        body: [
          "# Coach Profile",
          "",
          "## Where to find it",
          "Header → click your name → **Edit profile** (or go to `/coach/profile`).",
          "",
          "## Step-by-step: update your coach profile",
          "1. Open `/coach/profile`.",
          "2. Fill institution/program fields (name, program level, title).",
          "3. Enter **Institution location** (recommended). City/State may auto-fill.",
          "4. Add recruiting interests (positions/regions/grad years) if available.",
          "5. Click **Save**.",
          "",
          "## Why location matters",
          "- Admin maps rely on City/State fields for accurate distribution and operations support.",
          "",
          "## Troubleshooting",
          "- **City/State didn’t auto-fill**: type a clearer location format (example: `Austin, TX`) and save.",
          "",
          "## Related articles",
          "- [Coach Search (Players)](/kb/articles/coach-search-players)",
          "- [Coach Billing & Subscription](/kb/articles/coach-billing)"
        ].join("\n")
      },
      {
        title: "Coach Search (Players)",
        slug: "coach-search-players",
        summary: "How coaches search public player profiles and request contact info (subscription-gated).",
        category: "maps-search",
        tags: ["coach", "search", "players"],
        helpKeys: ["coach.search.players"],
        status: "published",
        body: [
          "# Coach Search (Players)",
          "",
          "## Where to find it",
          "Go to `/coach/search`.",
          "",
          "## Step-by-step: find players",
          "1. Open `/coach/search`.",
          "2. Apply filters (sport, position, location, grad year, etc.).",
          "3. Open a player profile from results.",
          "4. Add the player to your **Watchlist** to get notified when evaluations are posted.",
          "",
          "## Contact access (subscription + player settings)",
          "- Some contact information is hidden based on player visibility settings.",
          "- Some contact access is subscription-gated. If locked, upgrade at `/coach/billing`.",
          "",
          "## Troubleshooting",
          "- **No results**: broaden filters or confirm players have enabled public profiles.",
          "",
          "## Related articles",
          "- [Coach: Viewing a Player Profile](/kb/articles/coach-view-player-profile)",
          "- [Coach Billing & Subscription](/kb/articles/coach-billing)"
        ].join("\n")
      },
      {
        title: "Coach: Viewing a Player Profile",
        slug: "coach-view-player-profile",
        summary: "What coaches can see on player profiles, including film submissions and evaluation links.",
        category: "profiles",
        tags: ["coach", "player-profile", "evaluations"],
        helpKeys: ["coach.player.profile"],
        status: "published",
        body: [
          "# Coach: Viewing a Player Profile",
          "",
          "## Where this is",
          "Coach view of a player profile: `/coach/player/[userId]` (opened from Search, Watchlist, or Notifications).",
          "",
          "## Step-by-step: review a player",
          "1. Review public fields (sport, position, grad year, etc.).",
          "2. Scroll to **Film & evaluations**.",
          "3. Click **Open evaluation** for completed reports.",
          "4. Add to **Watchlist** to receive evaluation completion notifications.",
          "",
          "## Troubleshooting",
          "- **No evaluations listed**: the player may not have submitted film yet or evaluations aren’t completed.",
          "",
          "## Related articles",
          "- [Coach Film & Evaluation Detail](/kb/articles/coach-film-evaluation-detail)",
          "- [Notifications](/kb/articles/notifications)"
        ].join("\n")
      },
      {
        title: "Coach Film & Evaluation Detail",
        slug: "coach-film-evaluation-detail",
        summary: "How coaches open a film submission and view the full evaluation report.",
        category: "evaluations",
        tags: ["coach", "film", "evaluation-report"],
        helpKeys: ["coach.film.detail"],
        status: "published",
        body: [
          "# Coach Film & Evaluation Detail",
          "",
          "## Where to get here from",
          "- Watchlist evaluation-complete notification",
          "- Player profile → Film & evaluations → **Open evaluation**",
          "",
          "## Step-by-step: open the report",
          "1. Navigate to `/coach/film/[filmSubmissionId]?view=evaluation`.",
          "2. Review film context (title/opponent/date).",
          "3. Review the evaluation report and rubric breakdown.",
          "4. Use Print/PDF if available to save a clean copy.",
          "",
          "## Troubleshooting",
          "- **Report missing**: evaluation may not be completed yet.",
          "- **Access denied**: your subscription or role may not allow access.",
          ""
        ].join("\n")
      },
      {
        title: "Evaluator Dashboard",
        slug: "evaluator-dashboard",
        summary: "Overview of evaluator workflow: queue, review, notes, and submitting evaluations.",
        category: "getting-started",
        tags: ["evaluator", "dashboard", "queue"],
        helpKeys: ["evaluator.dashboard"],
        status: "published",
        body: [
          "# Evaluator Dashboard",
          "",
          "## Where to find it",
          "Header → **Home** (Evaluator) or go to `/evaluator`.",
          "",
          "## Step-by-step: typical evaluator workflow",
          "1. Open the queue and (if available) enable **My queue** to focus on assigned items.",
          "2. Use **Overdue only** to prioritize SLA breaches.",
          "3. Open a submission and verify the film is accessible.",
          "4. Use the Notes Tool (`/evaluator/notes`) if capturing structured notes during events.",
          "5. Submit the evaluation report and confirm the submission becomes `completed`.",
          "",
          "## Related articles",
          "- [Evaluator Queue](/kb/articles/evaluator-queue)",
          "- [Evaluator: Review a Film Submission](/kb/articles/evaluator-review-film)",
          "- [Evaluator Notes Tool](/kb/articles/evaluator-notes-tool)"
        ].join("\n")
      },
      {
        title: "Evaluator Profile",
        slug: "evaluator-profile",
        summary: "How evaluators edit their profile and keep location fields accurate.",
        category: "profiles",
        tags: ["evaluator", "profile", "location"],
        helpKeys: ["evaluator.profile"],
        status: "published",
        body: [
          "# Evaluator Profile",
          "",
          "## Where to find it",
          "Header → click your name → **Edit profile** (or go to `/evaluator/profile`).",
          "",
          "## Step-by-step: complete your evaluator profile",
          "1. Fill your title/credentials/specialties (if applicable).",
          "2. Set location (City/State) so admin maps are accurate.",
          "3. Click **Save**.",
          "",
          "## Troubleshooting",
          "- **I don’t appear on the evaluator map**: save City/State and refresh the admin map view.",
          ""
        ].join("\n")
      },
      {
        title: "Evaluator Queue",
        slug: "evaluator-queue",
        summary: "How evaluators work the film queue and open submissions for review.",
        category: "evaluations",
        tags: ["evaluator", "queue", "film"],
        helpKeys: ["evaluator.film.queue"],
        status: "published",
        body: [
          "# Evaluator Queue",
          "",
          "## Where to find it",
          "Go to `/evaluator`.",
          "",
          "## Step-by-step: work the queue",
          "1. Filter to **My queue** to focus on assigned work.",
          "2. Toggle **Overdue only** to prioritize urgent items.",
          "3. Click a submission row to open it.",
          "4. Review film and context (title/opponent/date/notes).",
          "5. Submit the evaluation report when ready.",
          "",
          "## What happens next",
          "- Player receives a notification and can open the full report.",
          "- Subscribed watchlist coaches receive a notification with a deep link to the report.",
          ""
        ].join("\n")
      },
      {
        title: "Evaluator: Review a Film Submission",
        slug: "evaluator-review-film",
        summary: "How to evaluate film and submit a consistent evaluation report.",
        category: "evaluations",
        tags: ["evaluator", "review", "report"],
        helpKeys: ["evaluator.film.review"],
        status: "published",
        body: [
          "# Evaluator: Review a Film Submission",
          "",
          "## Goal",
          "Create a consistent evaluation report with clear rubric scoring and actionable notes.",
          "",
          "## Step-by-step",
          "1. Open the submission from the queue: `/evaluator/film/[filmSubmissionId]`.",
          "2. Confirm the video plays and is accessible.",
          "3. Identify the athlete (jersey number/position) using submission notes and film context.",
          "4. Use the evaluation rubric/categories as your structure.",
          "5. Score each category/trait and add notes that justify the score.",
          "6. Complete strengths and improvement areas with specific examples.",
          "7. Submit the report.",
          "",
          "## Quality checklist",
          "- Scores match notes (no contradictions).",
          "- Notes include at least one concrete example (timestamp or play description).",
          "- Strengths and improvements are actionable.",
          "",
          "## Troubleshooting",
          "- **Broken/private link**: return as `needs_changes` and specify what the player must fix.",
          ""
        ].join("\n")
      },
      {
        title: "Admin Dashboard",
        slug: "admin-dashboard",
        summary: "Overview of admin tools: users, evaluations, maps, email delivery, audit logs, and KB.",
        category: "admin",
        tags: ["admin", "dashboard"],
        helpKeys: ["admin.dashboard"],
        status: "published",
        body: [
          "# Admin Dashboard",
          "",
          "## What this page is for",
          "The Admin dashboard is the operational control center for the platform.",
          "",
          "## Where to find it",
          "Go to `/admin` (Admin role required).",
          "",
          "## Step-by-step: common admin workflows",
          "1. **Queue health**: open `/admin/evaluations` and review KPIs (open/unassigned/overdue/avg age).",
          "2. **Assignments**: bulk-assign submissions to evaluators with assignment notes.",
          "3. **User support**: open Users, edit role/username/email, or send password reset.",
          "4. **Email reliability**: open `/admin/email` and review failures/resend supported emails.",
          "5. **Leadership reporting**: open `/admin/metrics` and trends.",
          "6. **Reduce support load**: maintain KB content at `/admin/kb`.",
          "",
          "## Related articles",
          "- [Admin: Evaluations Queue](/kb/articles/admin-evaluations-queue)",
          "- [Admin: User Management](/kb/articles/admin-user-management)",
          "- [Admin: Email Diagnostics & Delivery](/kb/articles/admin-email-diagnostics)",
          "- [Admin: Audit Logs](/kb/articles/admin-audit-logs)",
          "- [Admin: Metrics Dashboard](/kb/articles/admin-metrics)"
        ].join("\n")
      },
      {
        title: "Admin: User Management",
        slug: "admin-user-management",
        summary: "How admins edit users, manage roles, visibility, and trigger password resets.",
        category: "admin",
        tags: ["admin", "users", "security"],
        helpKeys: ["admin.users"],
        status: "published",
        body: [
          "# Admin: User Management",
          "",
          "## Where to find it",
          "Admin dashboard (`/admin`) → **Users** section.",
          "",
          "## What you can do",
          "- Update email, username, name, role, and active/disabled status",
          "- Manage coach subscription status",
          "- Toggle profile visibility fields (public profile/contact visibility when applicable)",
          "- Send password reset emails",
          "",
          "## Step-by-step: edit a user",
          "1. Search for the user by name/email/username.",
          "2. Click **Edit** to open the modal.",
          "3. Update fields (role, active, subscription, visibility).",
          "4. Click **Save** and confirm success.",
          "",
          "## Step-by-step: send password reset",
          "1. Open the user’s edit modal.",
          "2. Click **Send password reset**.",
          "3. Verify the attempt in `/admin/email` audit log.",
          "",
          "## Troubleshooting",
          "- **User can’t sign in**: confirm account is active and login uses correct email/username.",
          "- **No reset email delivered**: check `/admin/email` failures and SMTP config.",
          ""
        ].join("\n")
      },
      {
        title: "Admin: Evaluations Queue",
        slug: "admin-evaluations-queue",
        summary: "Paginated list of film submissions and evaluation status with search and filters.",
        category: "admin",
        tags: ["admin", "evaluations", "queue"],
        helpKeys: ["admin.evaluations.queue"],
        status: "published",
        body: [
          "# Admin: Evaluations Queue",
          "",
          "## Where to find it",
          "Go to `/admin/evaluations`.",
          "",
          "## What this page is for",
          "This is the ops queue for all film submissions and evaluation status, including KPIs and assignment tools.",
          "",
          "## Step-by-step: triage the queue",
          "1. Review KPI cards: Open / Unassigned / Overdue / Avg age.",
          "2. Toggle **Overdue only** to prioritize SLA breaches.",
          "3. Search by player name/email as needed.",
          "4. Select rows and assign an evaluator (add assignment notes when needed).",
          "5. Open a row to see evaluation detail and rubric breakdown.",
          "",
          "## Troubleshooting",
          "- **Assign fails**: ensure the evaluator exists and you are logged in as Admin.",
          "- **Queue empty**: confirm players have submitted film (`/player/film`).",
          ""
        ].join("\n")
      },
      {
        title: "Admin: Evaluation Detail",
        slug: "admin-evaluation-detail",
        summary: "How admins view evaluator identity and rubric/category scoring breakdown.",
        category: "admin",
        tags: ["admin", "evaluation", "report", "rubric"],
        helpKeys: ["admin.evaluations.detail"],
        status: "published",
        body: [
          "# Admin: Evaluation Detail",
          "",
          "## Where to find it",
          "From `/admin/evaluations`, click a row to open details.",
          "",
          "## What you can verify",
          "- Evaluator identity (who submitted the report)",
          "- Overall grade and rubric/category scoring breakdown",
          "- Film submission metadata (title/opponent/date/notes)",
          "",
          "## Step-by-step: quality check",
          "1. Confirm evaluator identity matches assignment expectations.",
          "2. Confirm rubric/category scores are present and reasonable.",
          "3. Confirm strengths and improvement notes are complete and coherent.",
          "4. If needed, reassign follow-up work using admin ops processes.",
          ""
        ].join("\n")
      },
      {
        title: "Admin: Email Diagnostics & Delivery",
        slug: "admin-email-diagnostics",
        summary: "How to troubleshoot email delivery using audit logs and resend supported emails.",
        category: "admin",
        tags: ["admin", "email", "audit"],
        helpKeys: ["admin.email.diagnostics"],
        status: "published",
        body: [
          "# Admin: Email Diagnostics & Delivery",
          "",
          "## Where to find it",
          "Go to `/admin/email`.",
          "",
          "## Step-by-step: diagnose email delivery",
          "1. Confirm SMTP is configured (top of the page).",
          "2. Filter to failures (24h) or status=failed.",
          "3. Open a row and inspect error details (if present).",
          "4. If **Resend supported**, click **Resend**.",
          "5. Confirm a new audit row appears for the resend attempt.",
          "",
          "## Troubleshooting",
          "- **Many failures at once**: verify SMTP credentials/provider status and check API logs.",
          "- **Resend not supported**: required metadata may be missing; manual resend required.",
          ""
        ].join("\n")
      },
      {
        title: "Getting Started (Talent Platform)",
        slug: "getting-started-talent-platform",
        summary: "Quick start guide for Players, Coaches, and Evaluators: what to do first and where to find key features.",
        category: "getting-started",
        tags: ["getting-started", "overview"],
        helpKeys: ["getting-started"],
        status: "published",
        body: [
          "# Getting Started (Talent Platform)",
          "",
          "## Players",
          "1. Complete your profile: `/player/profile`.",
          "2. Submit film: `/player/film`.",
          "3. Track status and open reports: `/player/evaluations`.",
          "",
          "## Coaches",
          "1. Complete your profile: `/coach/profile`.",
          "2. Search players and build a watchlist: `/coach/search`.",
          "3. Manage subscription for contact access: `/coach/billing`.",
          "",
          "## Evaluators",
          "1. Complete your profile: `/evaluator/profile`.",
          "2. Work the queue: `/evaluator`.",
          "3. Use Notes Tool at events: `/evaluator/notes`.",
          "",
          "## Admins",
          "1. Monitor the queue: `/admin/evaluations`.",
          "2. Check email health: `/admin/email`.",
          "3. Review KPIs and trends: `/admin/metrics` and `/admin/metrics/trends`.",
          "4. Maintain KB content: `/admin/kb`.",
          ""
        ].join("\n")
      },
      {
        title: "Login, Invites, and Access Requests",
        slug: "login-invites-access",
        summary: "How login works, what to do if you can’t sign in, and how invites/access requests are handled.",
        category: "accounts-access",
        tags: ["login", "invite", "access"],
        helpKeys: ["auth.login", "auth.access"],
        status: "published",
        body: [
          "# Login, Invites, and Access Requests",
          "",
          "## Login (email or username)",
          "1. Go to `/login`.",
          "2. Enter **Email or username** and your password.",
          "3. Click **Sign in**.",
          "",
          "## Forgot username / password",
          "- Username: `/forgot-username`",
          "- Password: `/forgot-password`",
          "- If configured, you can also recover via security questions.",
          "",
          "## Access requests (if you don’t have access yet)",
          "1. Go to `/request-access`.",
          "2. Submit your request.",
          "3. Admin reviews and approves/denies.",
          "",
          "## Invites (admin-created accounts)",
          "Some roles may be created via invite (common for evaluators/admins).",
          "1. Open the invite email.",
          "2. Click the invite link and set your password.",
          "3. Sign in at `/login`.",
          "",
          "## Troubleshooting",
          "- **No email received**: check spam; admin can resend from `/admin/email` when supported.",
          ""
        ].join("\n")
      },
      {
        title: "Account Security: Passwords & Recovery Questions",
        slug: "account-security",
        summary: "How to set security questions, recover accounts, and keep your account secure.",
        category: "security-recovery",
        tags: ["security", "recovery", "password"],
        helpKeys: ["account.security", "auth.password-reset"],
        status: "published",
        body: [
          "# Account Security: Passwords & Recovery Questions",
          "",
          "## Where to find Account Security",
          "Header → click your name → **Account security** (or go to `/account/security`).",
          "",
          "## Step-by-step: set recovery questions",
          "1. Open `/account/security`.",
          "2. Enter your current password.",
          "3. Choose and answer the 3 recovery questions.",
          "4. Click **Save** and confirm success.",
          "",
          "## Step-by-step: recover your username",
          "1. Email-based: `/forgot-username`.",
          "2. Security questions (if configured): `/recover/username`.",
          "",
          "## Step-by-step: reset your password",
          "1. Email-based: `/forgot-password`.",
          "2. Security questions (if configured): `/recover/password`.",
          "3. If you receive a reset link, open it and set a new password.",
          "",
          "## Best practices",
          "- Use a strong password (12+ characters).",
          "- Don’t reuse passwords across sites.",
          ""
        ].join("\n")
      },
      {
        title: "Showcases",
        slug: "showcases-overview",
        summary: "How to browse showcases, register, and what happens after registration.",
        category: "showcases",
        tags: ["showcases", "events"],
        helpKeys: ["showcases", "player.showcases", "coach.showcases"],
        status: "published",
        body: [
          "# Showcases",
          "",
          "## Where to find showcases",
          "Header → **Showcases** (or go to `/showcases`).",
          "",
          "## Step-by-step: browse showcases",
          "1. Open `/showcases`.",
          "2. Click a showcase to open details (`/showcases/[idOrSlug]`).",
          "3. Review date/location and registration availability.",
          "",
          "## Step-by-step: register (players)",
          "1. Open the showcase detail page.",
          "2. Click **Register** (if enabled).",
          "3. Complete payment/confirmation (if applicable).",
          "4. Confirm you see the registration confirmation screen.",
          "",
          "## What happens next",
          "- You may receive an email confirmation (if configured).",
          "- Your registration appears in your registrations list.",
          "",
          "## Troubleshooting",
          "- **Registration fails**: confirm payment method and try again; contact admin if it persists.",
          ""
        ].join("\n")
      },
      {
        title: "Showcase Registrations (Player)",
        slug: "showcase-registrations-player",
        summary: "How players view and manage their showcase registrations.",
        category: "showcases",
        tags: ["player", "showcases", "registrations"],
        helpKeys: ["player.showcases.registrations"],
        status: "published",
        body: [
          "# Showcase Registrations (Player)",
          "",
          "## Where to find it",
          "Go to `/showcases/registrations` (Players), or follow the registrations link from Showcases.",
          "",
          "## Step-by-step: view your registrations",
          "1. Open `/showcases/registrations`.",
          "2. Find your showcase in the list.",
          "3. Open it to confirm details and status.",
          "",
          "## Tips",
          "- Keep your profile up to date so showcase staff and coaches have accurate info.",
          ""
        ].join("\n")
      },
      {
        title: "Admin: Maps (Players, Coaches, Evaluators)",
        slug: "admin-maps",
        summary: "How admins use the maps to understand distribution by state and drill into lists.",
        category: "maps-search",
        tags: ["admin", "maps", "players", "coaches", "evaluators"],
        helpKeys: ["admin.maps"],
        status: "published",
        body: [
          "# Admin: Maps (Players, Coaches, Evaluators)",
          "",
          "## Where to find them",
          "Admin dashboard (`/admin`) → Player map / Coach map / Evaluator map sections.",
          "",
          "## What these maps show",
          "- Counts by US state",
          "- Drilldown lists when a state is selected",
          "",
          "## Step-by-step: drill into a state",
          "1. Click a state on the map.",
          "2. Review the list of users for that state.",
          "3. Click a row to open the user profile (where supported).",
          "",
          "## Data completeness",
          "- Missing City/State fields reduce map accuracy. Encourage users to fill location fields in profiles.",
          ""
        ].join("\n")
      },
      {
        title: "Admin: Audit Logs",
        slug: "admin-audit-logs",
        summary: "How to review sensitive admin actions and changes for accountability and troubleshooting.",
        category: "admin",
        tags: ["admin", "audit", "logs"],
        helpKeys: ["admin.audit-logs"],
        status: "published",
        body: [
          "# Admin: Audit Logs",
          "",
          "## Where to find it",
          "Go to `/admin/audit-logs`.",
          "",
          "## What’s tracked",
          "Sensitive actions are recorded for accountability, such as:",
          "- User edits and deletions",
          "- Assignment/unassignment actions",
          "- Email resend actions",
          "",
          "## Step-by-step: investigate an issue",
          "1. Identify the affected user/object and the time window.",
          "2. Filter/search the audit log around that time.",
          "3. Confirm who performed the action and what changed.",
          ""
        ].join("\n")
      },
      {
        title: "Admin: Metrics Dashboard",
        slug: "admin-metrics",
        summary: "How to use the Metrics dashboard (executive snapshot + operational KPIs) and what each metric means.",
        category: "admin",
        tags: ["admin", "metrics", "kpi"],
        helpKeys: ["admin.metrics"],
        status: "published",
        body: [
          "# Admin: Metrics Dashboard",
          "",
          "## Where to find it",
          "Admin → **Metrics** (or `/admin/metrics`).",
          "",
          "## What’s included",
          "- **Users**: totals, new users, and active users (DAU/WAU/MAU) by role",
          "- **Profiles**: completion scores and player public profile rate",
          "- **Evaluations**: submissions, backlog, overdue items, and turnaround time",
          "- **Engagement**: coach searches, watchlist adds, messages, contact requests, evaluation opens",
          "- **Revenue**: Stripe subscription KPIs (MRR/ARR) and showcase revenue (paid registrations)",
          "- **Reliability**: email fail rate and KB usage",
          "",
          "## Step-by-step: use metrics in weekly ops reviews",
          "1. Start with evaluations: backlog + overdue + turnaround time (avg/median/p90).",
          "2. Review evaluator throughput/workload to spot bottlenecks.",
          "3. Review coach funnel metrics and contact requests.",
          "4. Review email failures (24h) and fail rate.",
          "5. Open trends: `/admin/metrics/trends` for weekly movement.",
          ""
        ].join("\n")
      }
    ];

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const results: Array<{ slug: string; action: "created" | "updated" | "skipped" }> = [];

    for (const a of seed) {
      const slug = normalizeSlug(a.slug);
      const existing = await KnowledgeBaseArticleModel.findOne({ slug });
      if (!existing) {
        const doc = await KnowledgeBaseArticleModel.create({
          title: a.title,
          slug,
          summary: a.summary,
          body: a.body,
          tags: Array.from(new Set(a.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))).slice(0, 30),
          category: a.category,
          helpKeys: Array.from(new Set(a.helpKeys.map((k) => k.trim()).filter(Boolean))).slice(0, 50),
          status: a.status,
          publishedAt: a.status === "published" ? new Date() : undefined,
          version: 1,
          createdByUserId: actorUserId,
          updatedByUserId: actorUserId
        });
        await KnowledgeBaseArticleHistoryModel.create({
          articleId: doc._id,
          action: "created",
          actorUserId,
          snapshot: {
            title: doc.title,
            slug: doc.slug,
            summary: doc.summary,
            body: doc.body,
            tags: doc.tags,
            category: doc.category,
            helpKeys: doc.helpKeys,
            status: doc.status,
            version: doc.version,
            publishedAt: doc.publishedAt
          }
        });
        created += 1;
        results.push({ slug, action: "created" });
      } else if (force) {
        existing.title = a.title;
        existing.summary = a.summary;
        existing.body = a.body;
        existing.tags = Array.from(new Set(a.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))).slice(0, 30) as any;
        existing.category = a.category as any;
        existing.helpKeys = Array.from(new Set(a.helpKeys.map((k) => k.trim()).filter(Boolean))).slice(0, 50) as any;
        existing.status = a.status as any;
        existing.publishedAt = a.status === "published" ? existing.publishedAt ?? new Date() : undefined;
        existing.updatedByUserId = actorUserId;
        existing.version = (existing.version ?? 1) + 1;
        await existing.save();
        await KnowledgeBaseArticleHistoryModel.create({
          articleId: existing._id,
          action: "updated",
          actorUserId,
          snapshot: {
            title: existing.title,
            slug: existing.slug,
            summary: existing.summary,
            body: existing.body,
            tags: existing.tags,
            category: existing.category,
            helpKeys: existing.helpKeys,
            status: existing.status,
            version: existing.version,
            publishedAt: existing.publishedAt
          }
        });
        updated += 1;
        results.push({ slug, action: "updated" });
      } else {
        skipped += 1;
        results.push({ slug, action: "skipped" });
      }
    }

    return res.json({ ok: true, created, updated, skipped, results, note: "Pass ?force=1 to overwrite existing slugs." });
  } catch (err) {
    return next(err);
  }
});


