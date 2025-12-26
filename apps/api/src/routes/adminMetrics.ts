import { Router } from "express";
import mongoose from "mongoose";

import { ROLE, computeCoachProfileCompletion, computeEvaluatorProfileCompletion, computePlayerProfileCompletion } from "@goeducate/shared";

import { requireAuth, requireRole } from "../middleware/auth.js";
import { UserModel, COACH_SUBSCRIPTION_STATUS } from "../models/User.js";
import { PlayerProfileModel } from "../models/PlayerProfile.js";
import { CoachProfileModel } from "../models/CoachProfile.js";
import { EvaluatorProfileModel } from "../models/EvaluatorProfile.js";
import { FilmSubmissionModel } from "../models/FilmSubmission.js";
import { EvaluationReportModel } from "../models/EvaluationReport.js";
import { WatchlistModel } from "../models/Watchlist.js";
import { NotificationModel, NOTIFICATION_TYPE } from "../models/Notification.js";
import { MessageModel } from "../models/Message.js";
import { EmailAuditLogModel, EMAIL_AUDIT_STATUS } from "../models/EmailAuditLog.js";
import { KnowledgeBaseEventModel } from "../models/KnowledgeBaseEvent.js";
import { KnowledgeBaseArticleModel } from "../models/KnowledgeBaseArticle.js";
import { ShowcaseRegistrationModel, SHOWCASE_REGISTRATION_STATUS } from "../models/ShowcaseRegistration.js";
import { ShowcaseModel } from "../models/Showcase.js";
import { DailyActiveUserModel } from "../models/DailyActiveUser.js";
import { AppEventModel, APP_EVENT_TYPE } from "../models/AppEvent.js";
import { AdminMetricsConfigModel } from "../models/AdminMetricsConfig.js";
import { AdminMetricsSnapshotModel } from "../models/AdminMetricsSnapshot.js";
import { getEnv } from "../env.js";
import { getStripe, isStripeConfigured } from "../stripe.js";

export const adminMetricsRouter = Router();

function dayKeyUtc(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysUtc(day: string, deltaDays: number) {
  const [y, m, d] = day.split("-").map((x) => Number(x));
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dayKeyUtc(dt);
}

function percentile(sorted: number[], p: number) {
  if (!sorted.length) return null;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo] ?? null;
  const a = sorted[lo] ?? 0;
  const b = sorted[hi] ?? 0;
  return a + (b - a) * (idx - lo);
}

adminMetricsRouter.use(requireAuth, requireRole([ROLE.ADMIN]));

async function getConfig(reqUserId?: string) {
  const cfg =
    (await AdminMetricsConfigModel.findOne({ key: "default" }).lean()) ??
    (await AdminMetricsConfigModel.create({
      key: "default",
      ...(reqUserId && mongoose.isValidObjectId(reqUserId) ? { updatedByUserId: new mongoose.Types.ObjectId(reqUserId) } : {})
    }).then((d) => d.toObject()));
  return cfg as any;
}

adminMetricsRouter.get("/admin/metrics/config", async (req, res, next) => {
  try {
    const cfg = await getConfig(req.user?.id);
    return res.json({ config: cfg });
  } catch (err) {
    return next(err);
  }
});

adminMetricsRouter.put("/admin/metrics/config", async (req, res, next) => {
  try {
    const input = req.body as Partial<{
      overdueHours: number;
      tatP90WarnHours: number;
      tatP90CritHours: number;
      emailFailWarnPct: number;
      emailFailCritPct: number;
      coachConversionTargetPct: number;
      playerPublicTargetPct: number;
      profileCompletionTargetPctAtLeast80: number;
    }>;

    const patch: any = {};
    const nums: Array<keyof typeof input> = [
      "overdueHours",
      "tatP90WarnHours",
      "tatP90CritHours",
      "emailFailWarnPct",
      "emailFailCritPct",
      "coachConversionTargetPct",
      "playerPublicTargetPct",
      "profileCompletionTargetPctAtLeast80"
    ];
    for (const k of nums) {
      const v = (input as any)[k];
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) patch[k] = v;
    }
    if (req.user?.id && mongoose.isValidObjectId(req.user.id)) {
      patch.updatedByUserId = new mongoose.Types.ObjectId(req.user.id);
    }
    const doc = await AdminMetricsConfigModel.findOneAndUpdate({ key: "default" }, { $set: patch }, { upsert: true, new: true }).lean();
    return res.json({ config: doc });
  } catch (err) {
    return next(err);
  }
});

adminMetricsRouter.get("/admin/metrics/summary", async (req, res, next) => {
  try {
    const daysRaw = Number(req.query.days ?? 30);
    const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(365, daysRaw)) : 30;
    const now = new Date();
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const cfg = await getConfig(req.user?.id);

    // Users
    const totalsByRoleAgg = await UserModel.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]);
    const totalsByRole: Record<string, number> = Object.fromEntries(totalsByRoleAgg.map((r: any) => [String(r._id), Number(r.count)]));

    const newByRoleAgg = await UserModel.aggregate([
      { $match: { createdAt: { $gte: start } } },
      { $group: { _id: "$role", count: { $sum: 1 } } }
    ]);
    const newUsersByRole: Record<string, number> = Object.fromEntries(newByRoleAgg.map((r: any) => [String(r._id), Number(r.count)]));

    const coachesTotal = await UserModel.countDocuments({ role: ROLE.COACH });
    const coachesActive = await UserModel.countDocuments({ role: ROLE.COACH, subscriptionStatus: COACH_SUBSCRIPTION_STATUS.ACTIVE });
    const coachesNew = await UserModel.countDocuments({ role: ROLE.COACH, createdAt: { $gte: start } });
    const coachesNewActive = await UserModel.countDocuments({
      role: ROLE.COACH,
      createdAt: { $gte: start },
      subscriptionStatus: COACH_SUBSCRIPTION_STATUS.ACTIVE
    });

    // DAU/WAU/MAU from DailyActiveUser.
    const today = dayKeyUtc(now);
    const dayMinus6 = addDaysUtc(today, -6);
    const dayMinus29 = addDaysUtc(today, -29);

    const [dauAgg, wauAgg, mauAgg] = await Promise.all([
      DailyActiveUserModel.aggregate([{ $match: { day: today } }, { $group: { _id: "$role", count: { $sum: 1 } } }]),
      DailyActiveUserModel.aggregate([{ $match: { day: { $gte: dayMinus6, $lte: today } } }, { $group: { _id: "$role", count: { $addToSet: "$userId" } } }, { $project: { count: { $size: "$count" } } }]),
      DailyActiveUserModel.aggregate([{ $match: { day: { $gte: dayMinus29, $lte: today } } }, { $group: { _id: "$role", count: { $addToSet: "$userId" } } }, { $project: { count: { $size: "$count" } } }])
    ]);
    const dauByRole: Record<string, number> = Object.fromEntries((dauAgg as any[]).map((r) => [String(r._id), Number(r.count)]));
    const wauByRole: Record<string, number> = Object.fromEntries((wauAgg as any[]).map((r) => [String(r._id), Number(r.count)]));
    const mauByRole: Record<string, number> = Object.fromEntries((mauAgg as any[]).map((r) => [String(r._id), Number(r.count)]));

    // Profile completion + public player rate
    const [playerProfiles, coachProfiles, evaluatorProfiles] = await Promise.all([
      PlayerProfileModel.find({}).select({ userId: 1, isProfilePublic: 1, firstName: 1, lastName: 1, position: 1, gradYear: 1, school: 1, city: 1, state: 1, heightInInches: 1, heightIn: 1, weightLbs: 1, weightLb: 1, fortyTime: 1, verticalInches: 1, gpa: 1, highlightPhotoUrl: 1, jerseyNumber: 1 }).lean(),
      CoachProfileModel.find({}).select({ userId: 1, firstName: 1, lastName: 1, institutionName: 1, programLevel: 1, institutionLocation: 1, positionsOfInterest: 1, gradYears: 1, regions: 1, title: 1 }).lean(),
      EvaluatorProfileModel.find({}).select({ userId: 1, firstName: 1, lastName: 1, title: 1, bio: 1, experienceYears: 1, credentials: 1, specialties: 1 }).lean()
    ]);

    const playerPublicCount = playerProfiles.filter((p: any) => Boolean((p as any).isProfilePublic)).length;
    const playerProfileCount = playerProfiles.length;

    function summarizeCompletion(rows: any[], compute: (p: any) => { score: number }) {
      const scores = rows.map((r) => compute(r).score).filter((n) => Number.isFinite(n));
      const avg = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null;
      const pct80 = scores.length ? Math.round((scores.filter((s) => s >= 80).length / scores.length) * 1000) / 10 : null;
      return { avgScore: avg, pctAtLeast80: pct80, count: scores.length };
    }

    const playerCompletion = summarizeCompletion(playerProfiles, computePlayerProfileCompletion);
    const coachCompletion = summarizeCompletion(coachProfiles, computeCoachProfileCompletion);
    const evaluatorCompletion = summarizeCompletion(evaluatorProfiles, computeEvaluatorProfileCompletion);

    // Evaluations / submissions
    const submissionCountsRaw = await FilmSubmissionModel.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);
    const submissionsByStatus: Record<string, number> = Object.fromEntries(submissionCountsRaw.map((r: any) => [String(r._id), Number(r.count)]));
    const submissionsTotal = Object.values(submissionsByStatus).reduce((a, b) => a + b, 0);
    const submissionsNew = await FilmSubmissionModel.countDocuments({ createdAt: { $gte: start } });

    const openStatuses = ["submitted", "in_review", "needs_changes"];
    const backlog = await FilmSubmissionModel.countDocuments({ status: { $in: openStatuses as any } });
    const overdueHours = Number(cfg?.overdueHours ?? 72);
    const overdueBefore = new Date(Date.now() - overdueHours * 60 * 60 * 1000);
    const overdue = await FilmSubmissionModel.countDocuments({ status: { $in: openStatuses as any }, createdAt: { $lt: overdueBefore } });

    const evaluationsCompletedNew = await EvaluationReportModel.countDocuments({ createdAt: { $gte: start } });
    const evaluationsTotal = await EvaluationReportModel.countDocuments({});

    // Turnaround time (report.createdAt - submission.createdAt) for reports in window
    const turnaroundRows = await EvaluationReportModel.aggregate([
      { $match: { createdAt: { $gte: start } } },
      { $lookup: { from: FilmSubmissionModel.collection.name, localField: "filmSubmissionId", foreignField: "_id", as: "film" } },
      { $unwind: { path: "$film", preserveNullAndEmptyArrays: false } },
      { $project: { createdAt: 1, filmCreatedAt: "$film.createdAt" } },
      { $limit: 10000 }
    ]);
    const diffsHours = (turnaroundRows as any[])
      .map((r) => (r.createdAt && r.filmCreatedAt ? (new Date(r.createdAt).getTime() - new Date(r.filmCreatedAt).getTime()) / (1000 * 60 * 60) : null))
      .filter((n) => typeof n === "number" && Number.isFinite(n) && n >= 0) as number[];
    diffsHours.sort((a, b) => a - b);
    const turnaround = {
      avgHours: diffsHours.length ? Math.round((diffsHours.reduce((a, b) => a + b, 0) / diffsHours.length) * 10) / 10 : null,
      medianHours: percentile(diffsHours, 0.5) != null ? Math.round((percentile(diffsHours, 0.5) as number) * 10) / 10 : null,
      p90Hours: percentile(diffsHours, 0.9) != null ? Math.round((percentile(diffsHours, 0.9) as number) * 10) / 10 : null,
      sampleSize: diffsHours.length
    };

    const throughputByEvaluator = await EvaluationReportModel.aggregate([
      { $match: { createdAt: { $gte: start }, evaluatorUserId: { $ne: null } } },
      { $group: { _id: "$evaluatorUserId", count: { $sum: 1 }, avgGrade: { $avg: "$overallGrade" }, stddev: { $stdDevPop: "$overallGrade" } } },
      { $sort: { count: -1 } },
      { $limit: 100 }
    ]);

    const throughputEvaluatorIds = (throughputByEvaluator as any[]).map((r) => r._id).filter(Boolean);
    const throughputUsers = await UserModel.find({ _id: { $in: throughputEvaluatorIds as any } })
      .select({ _id: 1, email: 1, firstName: 1, lastName: 1 })
      .lean();
    const throughputUserById = new Map(throughputUsers.map((u: any) => [String(u._id), u]));

    // Engagement
    const watchlistTotalItems = await WatchlistModel.countDocuments({});
    const watchlistAdds = await WatchlistModel.countDocuments({ createdAt: { $gte: start } });
    const contactRequests = await NotificationModel.countDocuments({ type: NOTIFICATION_TYPE.CONTACT_REQUEST, createdAt: { $gte: start } });
    const messagesSent = await MessageModel.countDocuments({ createdAt: { $gte: start } });

    const coachSearchEvents = await AppEventModel.countDocuments({ type: APP_EVENT_TYPE.COACH_SEARCH_PLAYERS, createdAt: { $gte: start } });
    const coachSearchUnique = await AppEventModel.distinct("userId", { type: APP_EVENT_TYPE.COACH_SEARCH_PLAYERS, createdAt: { $gte: start } });
    const evaluationViewsCoach = await AppEventModel.countDocuments({ type: APP_EVENT_TYPE.EVALUATION_VIEW_COACH, createdAt: { $gte: start } });

    const funnel = {
      searched: (await AppEventModel.distinct("userId", { type: APP_EVENT_TYPE.COACH_SEARCH_PLAYERS, createdAt: { $gte: start } })).filter(Boolean).length,
      watchlistAdded: (await AppEventModel.distinct("userId", { type: APP_EVENT_TYPE.WATCHLIST_ADD, createdAt: { $gte: start } })).filter(Boolean).length,
      contactRequested: (await AppEventModel.distinct("userId", { type: APP_EVENT_TYPE.CONTACT_REQUEST, createdAt: { $gte: start } })).filter(Boolean).length,
      checkoutStarted: (await AppEventModel.distinct("userId", { type: APP_EVENT_TYPE.COACH_CHECKOUT_STARTED, createdAt: { $gte: start } })).filter(Boolean).length,
      activated: (await AppEventModel.distinct("userId", { type: APP_EVENT_TYPE.COACH_SUBSCRIPTION_ACTIVATED, createdAt: { $gte: start } })).filter(Boolean).length
    };

    // Revenue (Stripe + showcases)
    const env = getEnv();
    const stripeConfigured = isStripeConfigured(env);
    let stripe = null as any;
    let stripeKpis: any = { configured: stripeConfigured, mrrCents: null, arrCents: null, active: null, monthly: null, annual: null };
    if (stripeConfigured) {
      try {
        stripe = getStripe(env);
        const monthlyPriceId = env.STRIPE_PRICE_ID_MONTHLY;
        const annualPriceId = env.STRIPE_PRICE_ID_ANNUAL;
        let subs: any[] = [];
        let startingAfter: string | undefined = undefined;
        // paginate subscriptions (best effort; cap to avoid runaway)
        for (let i = 0; i < 20; i += 1) {
          const page = await stripe.subscriptions.list({ limit: 100, status: "active", ...(startingAfter ? { starting_after: startingAfter } : {}) });
          subs = subs.concat(page.data ?? []);
          if (!page.has_more) break;
          startingAfter = page.data?.[page.data.length - 1]?.id;
        }
        const relevant = subs.filter((s) => (s.items?.data ?? []).some((it: any) => it.price?.id === monthlyPriceId || it.price?.id === annualPriceId));
        const monthly = relevant.filter((s) => (s.items?.data ?? []).some((it: any) => it.price?.id === monthlyPriceId)).length;
        const annual = relevant.filter((s) => (s.items?.data ?? []).some((it: any) => it.price?.id === annualPriceId)).length;
        const mrr = relevant.reduce((sum, s) => {
          const items = s.items?.data ?? [];
          for (const it of items) {
            const price = it.price;
            if (!price?.recurring?.interval || typeof price.unit_amount !== "number") continue;
            if (price.id === monthlyPriceId && price.recurring.interval === "month") sum += price.unit_amount;
            if (price.id === annualPriceId && price.recurring.interval === "year") sum += Math.round(price.unit_amount / 12);
          }
          return sum;
        }, 0);
        stripeKpis = { configured: true, active: relevant.length, monthly, annual, mrrCents: mrr, arrCents: mrr * 12 };
      } catch {
        stripeKpis = { configured: true, error: "stripe_fetch_failed", mrrCents: null, arrCents: null, active: null, monthly: null, annual: null };
      }
    }

    const showcasePaidAgg = await ShowcaseRegistrationModel.aggregate([
      { $match: { paymentStatus: SHOWCASE_REGISTRATION_STATUS.PAID, createdAt: { $gte: start } } },
      { $lookup: { from: ShowcaseModel.collection.name, localField: "showcaseId", foreignField: "_id", as: "showcase" } },
      { $unwind: { path: "$showcase", preserveNullAndEmptyArrays: true } },
      { $project: { costCents: "$showcase.costCents", currency: "$showcase.currency" } },
      { $group: { _id: { currency: "$currency" }, count: { $sum: 1 }, revenueCents: { $sum: "$costCents" } } }
    ]);

    // Reliability / support
    const emailAgg = await EmailAuditLogModel.aggregate([
      { $match: { createdAt: { $gte: start } } },
      { $group: { _id: { type: "$type", status: "$status" }, count: { $sum: 1 } } }
    ]);
    const emailTotals = { sent: 0, failed: 0, skipped: 0 };
    const emailByType: Record<string, { sent: number; failed: number; skipped: number }> = {};
    for (const r of emailAgg as any[]) {
      const type = String(r._id?.type ?? "unknown");
      const status = String(r._id?.status ?? "unknown");
      const count = Number(r.count) || 0;
      if (!emailByType[type]) emailByType[type] = { sent: 0, failed: 0, skipped: 0 };
      if (status === EMAIL_AUDIT_STATUS.SENT) {
        emailByType[type].sent += count;
        emailTotals.sent += count;
      } else if (status === EMAIL_AUDIT_STATUS.FAILED) {
        emailByType[type].failed += count;
        emailTotals.failed += count;
      } else {
        emailByType[type].skipped += count;
        emailTotals.skipped += count;
      }
    }
    const emailTotalAll = emailTotals.sent + emailTotals.failed + emailTotals.skipped;
    const emailFailRate = emailTotalAll ? Math.round((emailTotals.failed / emailTotalAll) * 1000) / 10 : null;

    const kbViewsAgg = await KnowledgeBaseEventModel.aggregate([
      { $match: { type: "kb_article_view", createdAt: { $gte: start } } },
      { $group: { _id: "$slug", views: { $sum: 1 } } },
      { $sort: { views: -1 } },
      { $limit: 10 }
    ]);
    const kbTopViewed = (kbViewsAgg as any[]).map((r) => ({ slug: String(r._id ?? ""), views: Number(r.views) || 0 }));
    const kbMostNotHelpful = await KnowledgeBaseArticleModel.find({ status: "published" })
      .sort({ helpfulNoCount: -1 })
      .limit(10)
      .select({ slug: 1, title: 1, helpfulNoCount: 1, helpfulYesCount: 1 })
      .lean();

    const kbFeedbackAgg = await KnowledgeBaseEventModel.aggregate([
      { $match: { type: "kb_feedback", createdAt: { $gte: start } } },
      { $group: { _id: "$meta.helpful", count: { $sum: 1 } } }
    ]);
    const kbFeedbackYes = (kbFeedbackAgg as any[]).find((r) => r._id === true)?.count ?? 0;
    const kbFeedbackNo = (kbFeedbackAgg as any[]).find((r) => r._id === false)?.count ?? 0;

    // SLA: oldest open submissions + evaluator workload (now)
    const overdueItems = await FilmSubmissionModel.aggregate([
      { $match: { status: { $in: openStatuses as any } } },
      { $sort: { createdAt: 1 } },
      { $limit: 25 },
      {
        $lookup: {
          from: PlayerProfileModel.collection.name,
          localField: "userId",
          foreignField: "userId",
          as: "player"
        }
      },
      { $unwind: { path: "$player", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: UserModel.collection.name,
          localField: "assignedEvaluatorUserId",
          foreignField: "_id",
          as: "assignee"
        }
      },
      { $unwind: { path: "$assignee", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          title: 1,
          status: 1,
          createdAt: 1,
          assignedAt: 1,
          assignedEvaluatorUserId: 1,
          player: { firstName: "$player.firstName", lastName: "$player.lastName", email: "$player.contactEmail", sport: "$player.sport", position: "$player.position" },
          assignee: { _id: "$assignee._id", email: "$assignee.email" }
        }
      }
    ]);

    const workloadAgg = await FilmSubmissionModel.aggregate([
      { $match: { status: { $in: openStatuses as any }, assignedEvaluatorUserId: { $ne: null } } },
      {
        $addFields: {
          ageHours: { $divide: [{ $subtract: [new Date(), "$createdAt"] }, 1000 * 60 * 60] },
          overdue: { $cond: [{ $lt: ["$createdAt", overdueBefore] }, 1, 0] }
        }
      },
      {
        $group: {
          _id: "$assignedEvaluatorUserId",
          openAssigned: { $sum: 1 },
          overdueAssigned: { $sum: "$overdue" },
          oldestAgeHours: { $max: "$ageHours" },
          newestAssignedAt: { $max: "$assignedAt" }
        }
      },
      { $sort: { overdueAssigned: -1, openAssigned: -1 } },
      { $limit: 200 }
    ]);
    const evaluatorIds = (workloadAgg as any[]).map((w) => w._id).filter(Boolean);
    const evaluatorUsers = await UserModel.find({ _id: { $in: evaluatorIds as any } }).select({ _id: 1, email: 1, firstName: 1, lastName: 1 }).lean();
    const evalById = new Map(evaluatorUsers.map((u: any) => [String(u._id), u]));
    const throughputMap = new Map((throughputByEvaluator as any[]).map((r: any) => [String(r._id), r]));
    const evaluatorWorkload = (workloadAgg as any[]).map((w) => {
      const u = evalById.get(String(w._id));
      const t = throughputMap.get(String(w._id));
      const name = u?.firstName ? `${u.firstName} ${u.lastName ?? ""}`.trim() : null;
      return {
        evaluatorUserId: String(w._id),
        evaluatorEmail: u?.email ?? null,
        evaluatorName: name,
        openAssigned: Number(w.openAssigned) || 0,
        overdueAssigned: Number(w.overdueAssigned) || 0,
        oldestAgeHours: w.oldestAgeHours != null ? Math.round(Number(w.oldestAgeHours) * 10) / 10 : null,
        newestAssignedAt: w.newestAssignedAt ?? null,
        completedInWindow: t?.count ? Number(t.count) : 0
      };
    });

    const statusFlags = {
      turnaroundP90: turnaround.p90Hours == null ? "unknown" : turnaround.p90Hours >= cfg.tatP90CritHours ? "red" : turnaround.p90Hours >= cfg.tatP90WarnHours ? "yellow" : "green",
      emailFailRate: emailFailRate == null ? "unknown" : emailFailRate >= cfg.emailFailCritPct ? "red" : emailFailRate >= cfg.emailFailWarnPct ? "yellow" : "green",
      overdueBacklog: overdue > 0 ? "yellow" : "green",
      coachConversion: (coachesTotal ? Math.round((coachesActive / coachesTotal) * 1000) / 10 : null) != null
        ? (Math.round((coachesActive / coachesTotal) * 1000) / 10) >= cfg.coachConversionTargetPct
          ? "green"
          : "yellow"
        : "unknown",
      playerPublicRate: (playerProfileCount ? Math.round((playerPublicCount / playerProfileCount) * 1000) / 10 : null) != null
        ? (Math.round((playerPublicCount / playerProfileCount) * 1000) / 10) >= cfg.playerPublicTargetPct
          ? "green"
          : "yellow"
        : "unknown"
    };

    // Snapshot today's headline metrics so we can chart trends over time (populates after deploy).
    const todayKey = dayKeyUtc(now);
    void AdminMetricsSnapshotModel.updateOne(
      { day: todayKey },
      {
        $set: {
          day: todayKey,
          mrrCents: typeof stripeKpis?.mrrCents === "number" ? stripeKpis.mrrCents : null,
          arrCents: typeof stripeKpis?.arrCents === "number" ? stripeKpis.arrCents : null,
          backlogOpen: backlog,
          overdueOpen: overdue,
          submissionsNew,
          evaluationsCompletedNew,
          emailFailRatePct: emailFailRate,
          coachSearchEvents,
          coachConversionRatePct: coachesTotal ? Math.round((coachesActive / coachesTotal) * 1000) / 10 : null
        }
      },
      { upsert: true }
    ).catch(() => {});

    return res.json({
      timeframe: { days, start: start.toISOString(), end: now.toISOString() },
      config: cfg,
      statusFlags,
      users: {
        totalsByRole,
        newUsersByRole,
        coaches: {
          total: coachesTotal,
          active: coachesActive,
          conversionRatePct: coachesTotal ? Math.round((coachesActive / coachesTotal) * 1000) / 10 : null,
          new: coachesNew,
          newActive: coachesNewActive,
          newConversionRatePct: coachesNew ? Math.round((coachesNewActive / coachesNew) * 1000) / 10 : null
        },
        active: { dauByRole, wauByRole, mauByRole },
        profiles: {
          playerPublicRatePct: playerProfileCount ? Math.round((playerPublicCount / playerProfileCount) * 1000) / 10 : null,
          playerCompletion,
          coachCompletion,
          evaluatorCompletion
        }
      },
      evaluations: {
        submissions: { total: submissionsTotal, new: submissionsNew, byStatus: submissionsByStatus, backlogOpen: backlog, overdueHours, overdueCount: overdue },
        reports: { total: evaluationsTotal, completedNew: evaluationsCompletedNew },
        turnaround,
        evaluatorThroughput: throughputByEvaluator.map((r: any) => {
          const u = r._id ? throughputUserById.get(String(r._id)) : null;
          const name = u?.firstName ? `${u.firstName} ${u.lastName ?? ""}`.trim() : null;
          return {
            evaluatorUserId: r._id ? String(r._id) : null,
            evaluatorName: name,
            evaluatorEmail: u?.email ?? null,
            count: Number(r.count) || 0,
            avgGrade: r.avgGrade != null ? Math.round(Number(r.avgGrade) * 100) / 100 : null,
            stddev: r.stddev != null ? Math.round(Number(r.stddev) * 100) / 100 : null
          };
        })
      },
      engagement: {
        coachSearch: { total: coachSearchEvents, uniqueCoaches: coachSearchUnique.length },
        watchlist: { totalItems: watchlistTotalItems, addsNew: watchlistAdds },
        contactRequests: { total: contactRequests },
        messages: { sent: messagesSent },
        evaluationViews: { coachOpens: evaluationViewsCoach },
        coachFunnel: funnel
      },
      revenue: {
        stripe: stripeKpis,
        showcases: showcasePaidAgg.map((r: any) => ({
          currency: String(r._id?.currency ?? "usd"),
          paidCount: Number(r.count) || 0,
          revenueCents: Number(r.revenueCents) || 0
        }))
      },
      reliability: {
        email: { totals: emailTotals, failRatePct: emailFailRate, byType: emailByType },
        kb: {
          topViewed: kbTopViewed,
          feedback: { yes: kbFeedbackYes, no: kbFeedbackNo, total: kbFeedbackYes + kbFeedbackNo },
          mostNotHelpful: kbMostNotHelpful.map((a: any) => ({
            slug: a.slug,
            title: a.title,
            helpfulNoCount: a.helpfulNoCount ?? 0,
            helpfulYesCount: a.helpfulYesCount ?? 0
          }))
        },
        authRecovery: {
          usernameReminderEmails: emailByType["auth_username_reminder"]?.sent ?? 0,
          passwordResetEmails: emailByType["auth_password_reset"]?.sent ?? 0
        }
      }
      ,
      ops: {
        overdueHours,
        overdueItems: overdueItems.map((r: any) => ({
          id: String(r._id),
          title: r.title,
          status: r.status,
          createdAt: r.createdAt ?? null,
          assignedAt: r.assignedAt ?? null,
          assignedEvaluator: r.assignee?._id ? { id: String(r.assignee._id), email: r.assignee.email ?? null } : null,
          playerName: r.player?.firstName || r.player?.lastName ? `${r.player.firstName ?? ""} ${r.player.lastName ?? ""}`.trim() : null,
          playerSport: r.player?.sport ?? null,
          playerPosition: r.player?.position ?? null
        })),
        evaluatorWorkload
      }
    });
  } catch (err) {
    return next(err);
  }
});

adminMetricsRouter.get("/admin/metrics/trends", async (req, res, next) => {
  try {
    const weeksRaw = Number(req.query.weeks ?? 12);
    const weeks = Number.isFinite(weeksRaw) ? Math.max(4, Math.min(52, weeksRaw)) : 12;
    const now = new Date();
    const start = new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
    const startDay = dayKeyUtc(start);
    const rows = await AdminMetricsSnapshotModel.find({ day: { $gte: startDay } })
      .sort({ day: 1 })
      .select({ _id: 0, day: 1, mrrCents: 1, backlogOpen: 1, overdueOpen: 1, submissionsNew: 1, evaluationsCompletedNew: 1, emailFailRatePct: 1, coachSearchEvents: 1, coachConversionRatePct: 1 })
      .lean();

    // Bucket by ISO week (Mon start) using UTC.
    function weekKey(day: string) {
      const [y, m, d] = day.split("-").map((x) => Number(x));
      const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
      const dow = (dt.getUTCDay() + 6) % 7; // Mon=0
      dt.setUTCDate(dt.getUTCDate() - dow);
      return dayKeyUtc(dt);
    }

    const buckets = new Map<string, any>();
    for (const r of rows as any[]) {
      const wk = weekKey(String(r.day));
      if (!buckets.has(wk)) {
        buckets.set(wk, { week: wk, count: 0, sums: { submissionsNew: 0, evaluationsCompletedNew: 0, coachSearchEvents: 0 }, last: {} as any, emailFailRatePct: [] as number[], coachConversionRatePct: [] as number[] });
      }
      const b = buckets.get(wk);
      b.count += 1;
      b.sums.submissionsNew += Number(r.submissionsNew ?? 0);
      b.sums.evaluationsCompletedNew += Number(r.evaluationsCompletedNew ?? 0);
      b.sums.coachSearchEvents += Number(r.coachSearchEvents ?? 0);
      // Snapshot metrics: keep last seen for the week (end-of-week-ish)
      b.last.mrrCents = r.mrrCents ?? b.last.mrrCents ?? null;
      b.last.backlogOpen = r.backlogOpen ?? b.last.backlogOpen ?? null;
      b.last.overdueOpen = r.overdueOpen ?? b.last.overdueOpen ?? null;
      if (typeof r.emailFailRatePct === "number") b.emailFailRatePct.push(r.emailFailRatePct);
      if (typeof r.coachConversionRatePct === "number") b.coachConversionRatePct.push(r.coachConversionRatePct);
    }

    const weeksSorted = Array.from(buckets.values()).sort((a, b) => String(a.week).localeCompare(String(b.week))).slice(-weeks);
    const labels = weeksSorted.map((b) => b.week);
    const series = {
      submissionsNew: weeksSorted.map((b) => b.sums.submissionsNew),
      evaluationsCompletedNew: weeksSorted.map((b) => b.sums.evaluationsCompletedNew),
      coachSearchEvents: weeksSorted.map((b) => b.sums.coachSearchEvents),
      mrrCents: weeksSorted.map((b) => (typeof b.last.mrrCents === "number" ? b.last.mrrCents : null)),
      backlogOpen: weeksSorted.map((b) => (typeof b.last.backlogOpen === "number" ? b.last.backlogOpen : null)),
      overdueOpen: weeksSorted.map((b) => (typeof b.last.overdueOpen === "number" ? b.last.overdueOpen : null)),
      emailFailRatePct: weeksSorted.map((b) => {
        if (!b.emailFailRatePct.length) return null;
        const avg = b.emailFailRatePct.reduce((x: number, y: number) => x + y, 0) / b.emailFailRatePct.length;
        return Math.round(avg * 10) / 10;
      }),
      coachConversionRatePct: weeksSorted.map((b) => {
        if (!b.coachConversionRatePct.length) return null;
        const avg = b.coachConversionRatePct.reduce((x: number, y: number) => x + y, 0) / b.coachConversionRatePct.length;
        return Math.round(avg * 10) / 10;
      })
    };
    return res.json({ weeks: labels, series, note: "Trend charts build from daily snapshots (populates after deploy)." });
  } catch (err) {
    return next(err);
  }
});


