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

adminMetricsRouter.get("/admin/metrics/summary", async (req, res, next) => {
  try {
    const daysRaw = Number(req.query.days ?? 30);
    const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(365, daysRaw)) : 30;
    const now = new Date();
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

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

    // DAU/WAU/MAU from DailyActiveUser (populates after deploy).
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
    const overdueHours = 72;
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

    // Engagement
    const watchlistTotalItems = await WatchlistModel.countDocuments({});
    const watchlistAdds = await WatchlistModel.countDocuments({ createdAt: { $gte: start } });
    const contactRequests = await NotificationModel.countDocuments({ type: NOTIFICATION_TYPE.CONTACT_REQUEST, createdAt: { $gte: start } });
    const messagesSent = await MessageModel.countDocuments({ createdAt: { $gte: start } });

    const coachSearchEvents = await AppEventModel.countDocuments({ type: APP_EVENT_TYPE.COACH_SEARCH_PLAYERS, createdAt: { $gte: start } });
    const coachSearchUnique = await AppEventModel.distinct("userId", { type: APP_EVENT_TYPE.COACH_SEARCH_PLAYERS, createdAt: { $gte: start } });
    const evaluationViewsCoach = await AppEventModel.countDocuments({ type: APP_EVENT_TYPE.EVALUATION_VIEW_COACH, createdAt: { $gte: start } });

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

    return res.json({
      timeframe: { days, start: start.toISOString(), end: now.toISOString() },
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
        active: { dauByRole, wauByRole, mauByRole, note: "Active users start populating after this deploy." },
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
        evaluatorThroughput: throughputByEvaluator.map((r: any) => ({
          evaluatorUserId: r._id ? String(r._id) : null,
          count: Number(r.count) || 0,
          avgGrade: r.avgGrade != null ? Math.round(Number(r.avgGrade) * 100) / 100 : null,
          stddev: r.stddev != null ? Math.round(Number(r.stddev) * 100) / 100 : null
        }))
      },
      engagement: {
        coachSearch: { total: coachSearchEvents, uniqueCoaches: coachSearchUnique.length, note: "Search events are tracked after this deploy." },
        watchlist: { totalItems: watchlistTotalItems, addsNew: watchlistAdds },
        contactRequests: { total: contactRequests },
        messages: { sent: messagesSent },
        evaluationViews: { coachOpens: evaluationViewsCoach, note: "Evaluation view events are tracked after this deploy." }
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
    });
  } catch (err) {
    return next(err);
  }
});


