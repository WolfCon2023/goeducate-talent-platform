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
          "## What this is",
          "Your Player dashboard is the home base for submitting film, tracking evaluation status, and reviewing completed evaluations.",
          "",
          "## How to use it",
          "1. **Submit film**: Use the Film section or the Film link in the header to upload/paste video.",
          "2. **Track progress**: Your latest submission shows status (submitted → in queue → completed).",
          "3. **View evaluations**: Open **Evaluations** to see your history and download/print reports.",
          "",
          "## Tips",
          "- Submit the clearest full-game film you can (steady camera, good lighting).",
          "- Add opponent + date so evaluators can context-switch quickly.",
          "",
          "## Related",
          "- Player Film Submission",
          "- Player Evaluation History",
          "- Player Profile"
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
          "In the header, click your name → **Edit profile**.",
          "",
          "## What to fill out",
          "- Basic info (name, sport, position)",
          "- Athletic metrics (optional but helpful)",
          "- School / academics (optional)",
          "",
          "## Visibility controls",
          "- **Public profile**: if enabled, coaches can find you in search/map and view your public profile.",
          "- **Contact visibility**: controls whether subscribed coaches can view contact details (if enabled).",
          "",
          "## Tips",
          "- A complete profile improves coach trust and helps evaluators add context.",
          "- Keep your sport/position accurate so searches work well.",
          "",
          "## Related",
          "- Coach Search & Contact Requests",
          "- Player Dashboard"
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
          "## What you can submit",
          "You must provide **either**:",
          "- A hosted **Video URL** (Hudl/YouTube/Vimeo/etc.), or",
          "- An uploaded video file (if upload is enabled for your environment).",
          "",
          "## Steps",
          "1. Go to **Film** from the header.",
          "2. Fill out the **Title** (required).",
          "3. Add **Opponent** and **Game date** (recommended).",
          "4. Provide a **Video URL** or upload a file.",
          "5. Click **Submit**.",
          "",
          "## What happens next",
          "- Your submission enters the evaluation queue.",
          "- An evaluator will review it and submit an evaluation report.",
          "- You’ll get a notification/email when the evaluation is complete.",
          "",
          "## Common issues",
          "- **Nothing submits**: make sure Title is filled and a video URL/upload is provided.",
          "- **Bad link**: verify the URL is publicly accessible or shared correctly.",
          "",
          "## Related",
          "- Player Evaluation History",
          "- Notifications"
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
          "In the header, click **Evaluations** (Players only).",
          "",
          "## What you’ll see",
          "- Each film submission with a status",
          "- Completed evaluations with grade and report details",
          "",
          "## Actions",
          "- **Open**: view the full evaluation report",
          "- **Print/PDF**: use the Print/PDF button on the report page",
          "",
          "## Related",
          "- Submit Film (Player)",
          "- Notifications"
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
          "Notifications alert you when important events happen: evaluation completed, access requests, contact requests, and more.",
          "",
          "## Where to find them",
          "Click **Notifications** in the header. The badge shows how many are unread.",
          "",
          "## Tips",
          "- Open the notification to follow the deep link to the correct page (film report, profile, etc.).",
          "- If you see a badge but nothing loads, try refreshing once—deploys can briefly cause mixed versions.",
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
          "## How messaging works",
          "Messaging uses a **request → accept** workflow to reduce spam.",
          "",
          "## Starting a conversation",
          "1. Go to **Messages** in the header.",
          "2. Choose a recipient using the role-specific fields (Player / Coach / Evaluator).",
          "3. Write an initial message and click **Send request**.",
          "",
          "## Replying",
          "- If the conversation is **pending**, the recipient must accept before messaging continues.",
          "- Once accepted, both participants can chat freely.",
          "",
          "## Inbox badge",
          "The header shows an unread badge next to **Messages** when you have unread messages.",
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
          "## What this is",
          "Your Coach dashboard helps you discover players, follow evaluations, and manage your subscription.",
          "",
          "## Key areas",
          "- **Search**: find public player profiles",
          "- **Watchlist**: track players you care about",
          "- **Notifications**: evaluation completion and deep links",
          "- **Billing**: manage subscription status",
          ""
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
          "Header → **Billing** (Coach only).",
          "",
          "## What you’ll see",
          "- Subscription status (active/inactive)",
          "- Plan type (Monthly / Annual)",
          "- Renewal date (when applicable)",
          "",
          "## Downgrading Annual → Monthly",
          "If you are on an annual plan and request a downgrade, the change will be scheduled to take effect at your annual renewal date.",
          "",
          "## Troubleshooting",
          "- If billing portal doesn’t open, try again in a minute—Stripe portal links can expire.",
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
          "A structured note-taking tool for evaluations. It helps you capture consistent notes and reuse them in the official evaluation form.",
          "",
          "## Key features",
          "- Autosave drafts locally and server-side",
          "- Multiple named drafts (for events with multiple evals)",
          "- Copy notes in multiple formats (JSON/Markdown)",
          "",
          "## Workflow",
          "1. Open **Notes tool** (header dropdown).",
          "2. Select sport/template context if available.",
          "3. Take notes during the evaluation.",
          "4. Copy/paste into the official evaluation form when ready.",
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
          "## How helpKeys work",
          "Each major feature has a stable helpKey (e.g., `player.film.submit`).",
          "When a user clicks the **?** icon, the app routes them to the corresponding KB article.",
          "",
          "## Authoring workflow",
          "1. Create a new article (draft).",
          "2. Set **Category**, **Tags**, and **helpKeys** (comma-separated).",
          "3. Add Markdown content.",
          "4. Publish when ready.",
          "",
          "## History",
          "Every create/update/publish/unpublish is recorded in the article History section.",
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
          "In the header, click your name → **Edit profile**.",
          "",
          "## Key fields",
          "- Institution / organization",
          "- Institution location (City, State)",
          "- Recruiting interests (optional)",
          "",
          "## Tips",
          "- Keep City/State accurate so admins can support you and maps stay correct.",
          "",
          "## Related",
          "- Coach Billing & Subscription",
          "- Coach Search (Players)"
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
          "## What you can do",
          "- Search public player profiles by sport/position and other filters.",
          "- Open profiles to view film/evaluations (when available).",
          "",
          "## Contact access",
          "If contact info is not visible, it may be gated behind an active Coach subscription or the player’s visibility settings.",
          "",
          "## Related",
          "- Coach Billing & Subscription",
          "- Coach: Viewing a Player Profile"
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
          "## What you’ll see",
          "- Public player profile fields",
          "- Film submissions and **Open evaluation** links (if completed)",
          "",
          "## Related",
          "- Coach Film & Evaluation Detail",
          "- Notifications"
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
          "- Evaluation-complete notifications",
          "- Player profile → Film & evaluations",
          "",
          "## What’s on this page",
          "- Film submission details",
          "- Evaluation report and rubric breakdown (when completed)",
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
          "## Workflow",
          "1. Open the queue.",
          "2. Review film submissions.",
          "3. Use Notes Tool to capture structured notes (optional).",
          "4. Submit evaluation reports.",
          ""
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
          "In the header, click your name → **Edit profile**.",
          "",
          "## Tips",
          "- Fill City/State so the admin evaluator map is accurate.",
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
          "## Steps",
          "1. Open a submission.",
          "2. Review film and context.",
          "3. Submit the evaluation report when ready.",
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
          "## What to do",
          "1. Confirm the video plays and is accessible.",
          "2. Use the evaluation template as your rubric.",
          "3. Score categories/traits and leave clear notes.",
          "4. Submit the report.",
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
          "## Key sections",
          "- User management",
          "- Evaluations queue",
          "- Maps (players/coaches/evaluators)",
          "- Email diagnostics",
          "- Audit logs",
          "- Knowledge Base authoring",
          ""
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
          "## What you can do",
          "- Edit email/username/role/active status",
          "- Manage coach subscription status",
          "- Toggle profile visibility fields",
          "- Send password reset links",
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
          "## How to use it",
          "1. Search by player name/email when needed.",
          "2. Filter by status.",
          "3. Open a row for evaluation detail.",
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
          "## What’s included",
          "- Evaluator identity (who submitted)",
          "- Category/trait scoring breakdown",
          "- Film submission metadata",
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
          "## What you can do",
          "- Verify email is configured",
          "- Review audit entries for failures",
          "- Resend supported emails (starting with invites)",
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
          "1. Complete your **Player profile**.",
          "2. Submit film.",
          "3. Track evaluation status and read completed reports.",
          "",
          "## Coaches",
          "1. Complete your **Coach profile**.",
          "2. Search public player profiles and build a watchlist.",
          "3. Manage subscription if you need contact visibility.",
          "",
          "## Evaluators",
          "1. Complete your **Evaluator profile**.",
          "2. Work the evaluation queue.",
          "3. Use the Notes Tool for consistent, structured notes.",
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
          "## Login",
          "Go to `/login` and sign in with your email/username and password.",
          "",
          "## If you don’t have access yet",
          "Use **Request access**. An admin reviews and can approve/deny.",
          "",
          "## Invites",
          "Some roles may be created via admin invite. Follow the invite link in email to set your password and sign in.",
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
          "## Security questions",
          "Go to **Account security** (header dropdown) to set recovery questions. Answers are stored securely (hashed).",
          "",
          "## Forgot username / forgot password",
          "Use `/forgot-username` or `/forgot-password` to start recovery. You may have options for email-based recovery or recovery questions.",
          "",
          "## Tips",
          "- Use strong passwords (12+ characters).",
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
          "## Browsing showcases",
          "Go to **Showcases** in the header to browse upcoming events.",
          "",
          "## Registration",
          "Players can register for a showcase (if available). After registering, you should see confirmation and receive an email (if configured).",
          "",
          "## Related",
          "- Showcase Registrations",
          "- Notifications"
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
          "Showcases → Registrations (if available), or via links on the Showcase page.",
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
          "## What these maps show",
          "- Counts by state",
          "- A list of users when you select a state (with links to profiles where supported)",
          "",
          "## Data completeness",
          "If City/State fields are missing, the map may be incomplete. Encourage users to fill profile location fields.",
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
          "## What’s tracked",
          "Sensitive actions like user changes, resend email actions, and other admin operations can be recorded here.",
          "",
          "## How to use it",
          "Search and filter by time/user when investigating an issue.",
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


