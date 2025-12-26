import { Router } from "express";
import mongoose from "mongoose";
import crypto from "node:crypto";

import { FILM_SUBMISSION_STATUS, RegisterSchema, ROLE } from "@goeducate/shared";
import { z } from "zod";

import { signAccessToken } from "../auth/jwt.js";
import { hashPassword } from "../auth/password.js";
import { getEnv } from "../env.js";
import { ApiError } from "../http/errors.js";
import { zodToBadRequest } from "../http/zod.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { EvaluatorInviteModel, generateInviteToken, hashInviteToken } from "../models/EvaluatorInvite.js";
import { COACH_SUBSCRIPTION_STATUS, UserModel } from "../models/User.js";
import { PlayerProfileModel } from "../models/PlayerProfile.js";
import { CoachProfileModel } from "../models/CoachProfile.js";
import { EvaluatorProfileModel } from "../models/EvaluatorProfile.js";
import { FilmSubmissionModel } from "../models/FilmSubmission.js";
import { EvaluationReportModel } from "../models/EvaluationReport.js";
import { EvaluationFormModel } from "../models/EvaluationForm.js";
import { WatchlistModel } from "../models/Watchlist.js";
import { NotificationModel } from "../models/Notification.js";
import { isInviteEmailConfigured, sendInviteEmail } from "../email/invites.js";
import nodemailer from "nodemailer";
import { normalizeUsStateToCode, US_STATES } from "../util/usStates.js";
import { logAdminAction } from "../audit/adminAudit.js";
import { EmailAuditLogModel, EMAIL_AUDIT_STATUS } from "../models/EmailAuditLog.js";
import { createTransporterOrThrow, isEmailConfigured } from "../email/mailer.js";
import { sendMailWithAudit } from "../email/audit.js";
import { EMAIL_AUDIT_TYPE } from "../models/EmailAuditLog.js";
import { AdminAuditLogModel } from "../models/AdminAuditLog.js";
import { AuditLogModel } from "../models/AuditLog.js";
import { AccessRequestModel } from "../models/AccessRequest.js";
import { isAccessRequestEmailConfigured, sendAccessRequestApprovedEmail, sendAccessRequestRejectedEmail } from "../email/accessRequests.js";
import { isNotificationEmailConfigured, sendNotificationEmail } from "../email/notifications.js";
import { isAuthRecoveryEmailConfigured, sendPasswordResetEmail } from "../email/authRecovery.js";

export const adminRouter = Router();

const adminEmailLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 30, keyPrefix: "admin_email" });
const adminDangerLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 20, keyPrefix: "admin_danger" });

async function createInvite(opts: { email: string; role: string; createdByUserId: any }) {
  const email = opts.email.trim().toLowerCase();
  const role = opts.role.trim().toLowerCase();

  const allowed = [ROLE.PLAYER, ROLE.COACH, ROLE.EVALUATOR, ROLE.ADMIN];
  if (!email || !email.includes("@")) {
    throw new ApiError({ status: 400, code: "BAD_REQUEST", message: "Valid email is required" });
  }
  if (!allowed.includes(role as any)) {
    throw new ApiError({ status: 400, code: "BAD_REQUEST", message: "Valid role is required" });
  }

  const existingUser = await UserModel.findOne({ email }).lean();
  if (existingUser) {
    throw new ApiError({ status: 409, code: "EMAIL_TAKEN", message: "Email already registered" });
  }

  const token = generateInviteToken();
  const tokenHash = hashInviteToken(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

  await EvaluatorInviteModel.create({
    email,
    role: role as any,
    tokenHash,
    createdByUserId: opts.createdByUserId,
    expiresAt
  });

  return {
    email,
    role,
    token,
    expiresAt: expiresAt.toISOString()
  };
}

// One-time bootstrap: create the first admin user (only if no admins exist yet).
// Guarded by BOOTSTRAP_ADMIN_KEY. Remove the key after bootstrapping.
adminRouter.post("/admin/bootstrap", async (req, res, next) => {
  const env = getEnv();
  if (!env.BOOTSTRAP_ADMIN_KEY) {
    return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Not found" }));
  }

  const providedKey = req.header("x-bootstrap-key") ?? "";
  if (providedKey !== env.BOOTSTRAP_ADMIN_KEY) {
    return next(new ApiError({ status: 401, code: "UNAUTHORIZED", message: "Invalid bootstrap key" }));
  }

  const parsed = RegisterSchema.safeParse({ ...req.body, role: ROLE.ADMIN });
  if (!parsed.success) return next(zodToBadRequest(parsed.error.flatten()));

  try {
    const adminCount = await UserModel.countDocuments({ role: ROLE.ADMIN });
    if (adminCount > 0) {
      return next(new ApiError({ status: 409, code: "ALREADY_BOOTSTRAPPED", message: "Admin already exists" }));
    }

    const existing = await UserModel.findOne({ email: parsed.data.email }).lean();
    if (existing) {
      return next(new ApiError({ status: 409, code: "EMAIL_TAKEN", message: "Email already registered" }));
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const user = await UserModel.create({ email: parsed.data.email, passwordHash, role: ROLE.ADMIN });
    const token = signAccessToken({ sub: String(user._id), role: user.role }, env.JWT_SECRET);

    return res.status(201).json({
      token,
      user: { id: String(user._id), email: user.email, role: user.role }
    });
  } catch (err) {
    return next(err);
  }
});

// Admin-only: create internal users (evaluator/admin). Players/coaches self-register.
adminRouter.post("/admin/users", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) return next(zodToBadRequest(parsed.error.flatten()));

  const { email, password, role, firstName, lastName } = parsed.data;
  if (role === ROLE.COACH && (!firstName || !lastName)) {
    return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Coach first and last name are required" }));
  }

  try {
    const existing = await UserModel.findOne({ email }).lean();
    if (existing) {
      return next(new ApiError({ status: 409, code: "EMAIL_TAKEN", message: "Email already registered" }));
    }

    const passwordHash = await hashPassword(password);
    const user = await UserModel.create({
      email,
      passwordHash,
      role,
      ...(firstName ? { firstName } : {}),
      ...(lastName ? { lastName } : {}),
      ...(role === ROLE.COACH ? { subscriptionStatus: COACH_SUBSCRIPTION_STATUS.INACTIVE } : {})
    });
    void logAdminAction({
      req,
      actorUserId: String(req.user!.id),
      action: "admin.users.create",
      targetType: "User",
      targetId: String(user._id),
      meta: { email: user.email, role: user.role }
    });
    return res.status(201).json({ user: { id: String(user._id), email: user.email, role: user.role } });
  } catch (err) {
    return next(err);
  }
});

// Admin-only: high-level dashboard stats (submissions + evaluations + rating buckets)
adminRouter.get("/admin/stats", requireAuth, requireRole([ROLE.ADMIN]), async (_req, res, next) => {
  try {
    const submissionCountsRaw = await FilmSubmissionModel.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);
    const submissionCounts: Record<string, number> = Object.fromEntries(
      submissionCountsRaw.map((r) => [String(r._id), Number(r.count)])
    );
    const submissionsTotal = Object.values(submissionCounts).reduce((a, b) => a + b, 0);

    const evaluationsTotal = await EvaluationReportModel.countDocuments();

    const playersBySport = await PlayerProfileModel.aggregate([
      {
        $project: {
          sport: {
            $cond: [{ $or: [{ $eq: ["$sport", null] }, { $eq: ["$sport", ""] }] }, "unspecified", "$sport"]
          }
        }
      },
      { $group: { _id: "$sport", count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 25 },
      { $project: { _id: 0, sport: "$_id", count: 1 } }
    ]);

    const playersByPosition = await PlayerProfileModel.aggregate([
      {
        $project: {
          position: {
            $cond: [{ $or: [{ $eq: ["$position", null] }, { $eq: ["$position", ""] }] }, "unspecified", "$position"]
          }
        }
      },
      { $group: { _id: "$position", count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 25 },
      { $project: { _id: 0, position: "$_id", count: 1 } }
    ]);

    const submissionsBySport = await FilmSubmissionModel.aggregate([
      {
        $lookup: {
          from: "playerprofiles",
          localField: "userId",
          foreignField: "userId",
          as: "playerProfile"
        }
      },
      { $unwind: { path: "$playerProfile", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          sport: {
            $cond: [
              {
                $or: [
                  { $eq: ["$playerProfile.sport", null] },
                  { $eq: ["$playerProfile.sport", ""] }
                ]
              },
              "unspecified",
              "$playerProfile.sport"
            ]
          }
        }
      },
      { $group: { _id: "$sport", count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 25 },
      { $project: { _id: 0, sport: "$_id", count: 1 } }
    ]);

    const submissionsByPosition = await FilmSubmissionModel.aggregate([
      {
        $lookup: {
          from: "playerprofiles",
          localField: "userId",
          foreignField: "userId",
          as: "playerProfile"
        }
      },
      { $unwind: { path: "$playerProfile", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          position: {
            $cond: [
              {
                $or: [
                  { $eq: ["$playerProfile.position", null] },
                  { $eq: ["$playerProfile.position", ""] }
                ]
              },
              "unspecified",
              "$playerProfile.position"
            ]
          }
        }
      },
      { $group: { _id: "$position", count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 25 },
      { $project: { _id: 0, position: "$_id", count: 1 } }
    ]);

    // Queue KPIs (open submissions = not completed)
    const now = Date.now();
    const overdueHours = 72; // configurable later
    const overdueBefore = new Date(now - overdueHours * 60 * 60 * 1000);
    const openStatuses = [FILM_SUBMISSION_STATUS.SUBMITTED, FILM_SUBMISSION_STATUS.IN_REVIEW, FILM_SUBMISSION_STATUS.NEEDS_CHANGES];
    const openTotal = await FilmSubmissionModel.countDocuments({ status: { $in: openStatuses as any } });
    const overdueTotal = await FilmSubmissionModel.countDocuments({
      status: { $in: openStatuses as any },
      createdAt: { $lt: overdueBefore }
    });
    const avgOpenAge = await FilmSubmissionModel.aggregate([
      { $match: { status: { $in: openStatuses as any } } },
      {
        $project: {
          ageHours: {
            $cond: [{ $ne: ["$createdAt", null] }, { $divide: [{ $subtract: [new Date(), "$createdAt"] }, 1000 * 60 * 60] }, null]
          }
        }
      },
      { $group: { _id: null, avgAgeHours: { $avg: "$ageHours" } } }
    ]);

    // Group evaluations by overallGrade, include a few recent examples per grade.
    const evaluationsByGrade = await EvaluationReportModel.aggregate([
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: "filmsubmissions",
          localField: "filmSubmissionId",
          foreignField: "_id",
          as: "film"
        }
      },
      { $unwind: { path: "$film", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "playerprofiles",
          localField: "playerUserId",
          foreignField: "userId",
          as: "playerProfile"
        }
      },
      { $unwind: { path: "$playerProfile", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          createdAt: 1,
          overallGrade: 1,
          filmSubmissionId: 1,
          playerUserId: 1,
          filmTitle: "$film.title",
          playerFirstName: "$playerProfile.firstName",
          playerLastName: "$playerProfile.lastName"
        }
      },
      {
        $group: {
          _id: "$overallGrade",
          count: { $sum: 1 },
          items: {
            $push: {
              evaluationId: "$_id",
              createdAt: "$createdAt",
              filmSubmissionId: "$filmSubmissionId",
              filmTitle: "$filmTitle",
              playerUserId: "$playerUserId",
              playerFirstName: "$playerFirstName",
              playerLastName: "$playerLastName"
            }
          }
        }
      },
      { $project: { grade: "$_id", count: 1, items: { $slice: ["$items", 5] } } },
      { $sort: { grade: -1 } }
    ]);

    const evaluationsBySportPosition = await EvaluationReportModel.aggregate([
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: "filmsubmissions",
          localField: "filmSubmissionId",
          foreignField: "_id",
          as: "film"
        }
      },
      { $unwind: { path: "$film", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "playerprofiles",
          localField: "playerUserId",
          foreignField: "userId",
          as: "playerProfile"
        }
      },
      { $unwind: { path: "$playerProfile", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          effectiveSport: {
            $cond: [
              { $or: [{ $eq: ["$sport", null] }, { $eq: ["$sport", ""] }] },
              {
                $cond: [
                  { $or: [{ $eq: ["$playerProfile.sport", null] }, { $eq: ["$playerProfile.sport", ""] }] },
                  "unspecified",
                  "$playerProfile.sport"
                ]
              },
              "$sport"
            ]
          },
          effectivePosition: {
            $cond: [
              { $or: [{ $eq: ["$position", null] }, { $eq: ["$position", ""] }] },
              {
                $cond: [
                  { $or: [{ $eq: ["$playerProfile.position", null] }, { $eq: ["$playerProfile.position", ""] }] },
                  "unspecified",
                  "$playerProfile.position"
                ]
              },
              "$position"
            ]
          },
          turnaroundHours: {
            $cond: [
              {
                $and: [
                  { $ne: ["$film.createdAt", null] },
                  { $ne: ["$createdAt", null] }
                ]
              },
              {
                $divide: [{ $subtract: ["$createdAt", "$film.createdAt"] }, 1000 * 60 * 60]
              },
              null
            ]
          }
        }
      },
      {
        $group: {
          _id: { sport: "$effectiveSport", position: "$effectivePosition" },
          count: { $sum: 1 },
          avgGrade: { $avg: "$overallGrade" },
          avgTurnaroundHours: { $avg: "$turnaroundHours" }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 50 },
      {
        $project: {
          _id: 0,
          sport: "$_id.sport",
          position: "$_id.position",
          count: 1,
          avgGrade: { $round: ["$avgGrade", 2] },
          avgTurnaroundHours: { $round: ["$avgTurnaroundHours", 2] }
        }
      }
    ]);

    const evaluatorPerformance = await EvaluationReportModel.aggregate([
      {
        $lookup: {
          from: "filmsubmissions",
          localField: "filmSubmissionId",
          foreignField: "_id",
          as: "film"
        }
      },
      { $unwind: { path: "$film", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          turnaroundHours: {
            $cond: [
              {
                $and: [
                  { $ne: ["$film.createdAt", null] },
                  { $ne: ["$createdAt", null] }
                ]
              },
              {
                $divide: [{ $subtract: ["$createdAt", "$film.createdAt"] }, 1000 * 60 * 60]
              },
              null
            ]
          }
        }
      },
      {
        $group: {
          _id: "$evaluatorUserId",
          count: { $sum: 1 },
          avgTurnaroundHours: { $avg: "$turnaroundHours" },
          avgGrade: { $avg: "$overallGrade" }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 50 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user"
        }
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          evaluatorUserId: "$_id",
          count: 1,
          avgGrade: { $round: ["$avgGrade", 2] },
          avgTurnaroundHours: { $round: ["$avgTurnaroundHours", 2] },
          user: { id: "$user._id", email: "$user.email", role: "$user.role", firstName: "$user.firstName", lastName: "$user.lastName" }
        }
      }
    ]);

    return res.json({
      players: {
        total: await PlayerProfileModel.countDocuments(),
        bySport: playersBySport,
        byPosition: playersByPosition
      },
      submissions: {
        total: submissionsTotal,
        byStatus: submissionCounts,
        bySport: submissionsBySport,
        byPosition: submissionsByPosition,
        queue: {
          openTotal,
          overdueHours,
          overdueTotal,
          avgOpenAgeHours: Math.round(Number(avgOpenAge?.[0]?.avgAgeHours ?? 0) * 100) / 100
        }
      },
      evaluations: {
        total: evaluationsTotal,
        byGrade: evaluationsByGrade,
        bySportPosition: evaluationsBySportPosition,
        evaluators: evaluatorPerformance
      }
    });
  } catch (err) {
    return next(err);
  }
});

// Admin-only: list film submissions + evaluation status (search + filter + pagination)
// This powers the Admin "Evaluations" table and allows admins to pull up any evaluation (even if not completed).
adminRouter.get("/admin/evaluations", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
  try {
    const limitRaw = Number(req.query.limit ?? 25);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : 25;
    const skipRaw = Number(req.query.skip ?? 0);
    const skip = Number.isFinite(skipRaw) ? Math.max(0, Math.min(200_000, skipRaw)) : 0;

    const q = String(req.query.q ?? "").trim();
    const status = String(req.query.status ?? "").trim().toLowerCase();
    const hasEval = String(req.query.hasEval ?? "").trim(); // "1" | "0" | ""
    const hasAssigned = String(req.query.hasAssigned ?? "").trim(); // "1" | "0" | ""

    const match: any = {};
    if (status && Object.values(FILM_SUBMISSION_STATUS).includes(status as any)) {
      match.status = status;
    }
    if (hasAssigned === "1") match.assignedEvaluatorUserId = { $exists: true, $ne: null };
    if (hasAssigned === "0") match.$or = [{ assignedEvaluatorUserId: { $exists: false } }, { assignedEvaluatorUserId: null }];

    const qRegex = q ? new RegExp(escapeRegex(q), "i") : null;
    const overdueHours = 72; // keep consistent with /admin/stats (configurable later)
    const openStatuses = [FILM_SUBMISSION_STATUS.SUBMITTED, FILM_SUBMISSION_STATUS.IN_REVIEW, FILM_SUBMISSION_STATUS.NEEDS_CHANGES];
    const now = new Date();

    const base: any[] = [
      { $match: match },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: EvaluationReportModel.collection.name,
          localField: "_id",
          foreignField: "filmSubmissionId",
          as: "eval"
        }
      },
      { $addFields: { eval: { $arrayElemAt: ["$eval", 0] } } },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "playerUser"
        }
      },
      { $addFields: { playerUser: { $arrayElemAt: ["$playerUser", 0] } } },
      {
        $lookup: {
          from: "playerprofiles",
          localField: "userId",
          foreignField: "userId",
          as: "playerProfile"
        }
      },
      { $addFields: { playerProfile: { $arrayElemAt: ["$playerProfile", 0] } } },
      {
        $lookup: {
          from: "users",
          localField: "assignedEvaluatorUserId",
          foreignField: "_id",
          as: "assignedEvaluator"
        }
      },
      { $addFields: { assignedEvaluator: { $arrayElemAt: ["$assignedEvaluator", 0] } } },
      {
        $lookup: {
          from: "users",
          localField: "eval.evaluatorUserId",
          foreignField: "_id",
          as: "reportEvaluator"
        }
      },
      { $addFields: { reportEvaluator: { $arrayElemAt: ["$reportEvaluator", 0] } } }
    ];

    // Compute age/overdue flags for ops-ready KPIs + row highlighting.
    base.push({
      $addFields: {
        ageHours: {
          $cond: [{ $ne: ["$createdAt", null] }, { $divide: [{ $subtract: [now, "$createdAt"] }, 1000 * 60 * 60] }, null]
        },
        isOpen: { $in: ["$status", openStatuses] },
        isUnassigned: {
          $or: [{ $eq: ["$assignedEvaluatorUserId", null] }, { $not: ["$assignedEvaluatorUserId"] }]
        }
      }
    });
    base.push({
      $addFields: {
        isOverdue: {
          $and: [{ $eq: ["$isOpen", true] }, { $ne: ["$ageHours", null] }, { $gte: ["$ageHours", overdueHours] }]
        }
      }
    });

    // Filter by whether an evaluation report exists.
    if (hasEval === "1") base.push({ $match: { eval: { $ne: null } } });
    if (hasEval === "0") base.push({ $match: { eval: null } });

    // Search across film title, player name/email, evaluator email.
    if (qRegex) {
      base.push({
        $match: {
          $or: [
            { title: qRegex },
            { "playerUser.email": qRegex },
            { "playerProfile.firstName": qRegex },
            { "playerProfile.lastName": qRegex },
            { "assignedEvaluator.email": qRegex },
            { "reportEvaluator.email": qRegex }
          ]
        }
      });
    }

    // Build results + count in one query.
    const rows = await FilmSubmissionModel.aggregate([
      ...base,
      {
        $facet: {
          totalRows: [{ $count: "count" }],
          kpis: [
            {
              $group: {
                _id: null,
                open: { $sum: { $cond: ["$isOpen", 1, 0] } },
                unassigned: { $sum: { $cond: [{ $and: ["$isOpen", "$isUnassigned"] }, 1, 0] } },
                overdue: { $sum: { $cond: ["$isOverdue", 1, 0] } },
                avgOpenAgeHours: { $avg: { $cond: ["$isOpen", "$ageHours", null] } }
              }
            },
            { $project: { _id: 0, open: 1, unassigned: 1, overdue: 1, avgOpenAgeHours: 1 } }
          ],
          results: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                userId: 1,
                title: 1,
                opponent: 1,
                gameDate: 1,
                status: 1,
                createdAt: 1,
                updatedAt: 1,
                assignedAt: 1,
                assignedEvaluatorUserId: 1,
                ageHours: 1,
                isOverdue: 1,
                assignedEvaluator: {
                  id: "$assignedEvaluator._id",
                  email: "$assignedEvaluator.email"
                },
                player: {
                  id: "$playerUser._id",
                  email: "$playerUser.email",
                  firstName: "$playerProfile.firstName",
                  lastName: "$playerProfile.lastName",
                  sport: "$playerProfile.sport",
                  position: "$playerProfile.position"
                },
                evaluation: {
                  id: "$eval._id",
                  createdAt: "$eval.createdAt",
                  overallGrade: "$eval.overallGrade",
                  sport: "$eval.sport",
                  position: "$eval.position",
                  evaluatorUserId: "$eval.evaluatorUserId",
                  evaluatorEmail: {
                    $ifNull: ["$reportEvaluator.email", "$assignedEvaluator.email"]
                  }
                },
                reportEvaluator: {
                  id: "$reportEvaluator._id",
                  email: "$reportEvaluator.email"
                }
              }
            }
          ]
        }
      }
    ]);

    const total = Number(rows?.[0]?.totalRows?.[0]?.count ?? 0);
    const results = (rows?.[0]?.results ?? []).map((r: any) => ({
      ...r,
      _id: String(r._id),
      userId: String(r.userId)
    }));

    const k = rows?.[0]?.kpis?.[0] ?? null;
    const kpis = k
      ? {
          open: Number(k.open) || 0,
          unassigned: Number(k.unassigned) || 0,
          overdue: Number(k.overdue) || 0,
          avgOpenAgeHours: typeof k.avgOpenAgeHours === "number" ? Math.round(Number(k.avgOpenAgeHours) * 10) / 10 : null
        }
      : { open: 0, unassigned: 0, overdue: 0, avgOpenAgeHours: null };

    return res.json({ total, results, skip, limit, overdueHours, kpis });
  } catch (err) {
    return next(err);
  }
});

// Admin-only: player distribution map (counts by US state)
adminRouter.get("/admin/players/by-state", requireAuth, requireRole([ROLE.ADMIN]), async (_req, res, next) => {
  try {
    const raw = await PlayerProfileModel.aggregate([
      {
        $project: {
          state: {
            $cond: [{ $or: [{ $eq: ["$state", null] }, { $eq: ["$state", ""] }] }, null, "$state"]
          }
        }
      },
      { $group: { _id: "$state", count: { $sum: 1 } } }
    ]);

    const counts = new Map<string, number>();
    let unknown = 0;

    for (const r of raw as Array<{ _id: any; count: number }>) {
      const code = normalizeUsStateToCode(r._id);
      if (!code) {
        unknown += Number(r.count) || 0;
        continue;
      }
      counts.set(code, (counts.get(code) ?? 0) + (Number(r.count) || 0));
    }

    const byState = Array.from(counts.entries())
      .map(([code, count]) => ({ code, name: US_STATES.find((s) => s.code === code)?.name ?? code, count }))
      .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));

    return res.json({ byState, unknownCount: unknown });
  } catch (err) {
    return next(err);
  }
});

function guessStateFromCoachLocation(input: unknown): string | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;

  // Try full-string normalization first.
  const direct = normalizeUsStateToCode(raw);
  if (direct) return direct;

  // Common patterns: "City, ST" or "City, State"
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const tail = parts.length ? parts[parts.length - 1] : raw;
  const tailNorm = normalizeUsStateToCode(tail);
  if (tailNorm) return tailNorm;

  // Look for a 2-letter state code token anywhere.
  const codeMatch = raw.toUpperCase().match(/\b([A-Z]{2})\b/);
  if (codeMatch) {
    const maybe = normalizeUsStateToCode(codeMatch[1]);
    if (maybe) return maybe;
  }

  // Look for state name substring.
  const lower = raw.toLowerCase();
  for (const s of US_STATES) {
    if (lower.includes(s.name.toLowerCase())) return s.code;
  }

  return null;
}

// Admin-only: coach distribution map (counts by US state) based on institutionLocation/regions
adminRouter.get("/admin/coaches/by-state", requireAuth, requireRole([ROLE.ADMIN]), async (_req, res, next) => {
  try {
    const totalCoaches = await CoachProfileModel.countDocuments();
    const raw = await CoachProfileModel.aggregate([
      {
        $project: {
          state: {
            $cond: [{ $or: [{ $eq: ["$state", null] }, { $eq: ["$state", ""] }] }, null, "$state"]
          },
          institutionLocation: {
            $cond: [
              { $or: [{ $eq: ["$institutionLocation", null] }, { $eq: ["$institutionLocation", ""] }] },
              null,
              "$institutionLocation"
            ]
          },
          regions: { $ifNull: ["$regions", []] }
        }
      }
    ]);

    const counts = new Map<string, number>();
    let unknown = 0;
    let missingStateField = 0;

    for (const r of raw as Array<{ institutionLocation?: any; regions?: any[] }>) {
      const codes: string[] = [];
      const stateCode = normalizeUsStateToCode((r as any).state);
      if (!stateCode) missingStateField += 1;
      if (stateCode) codes.push(stateCode);
      const locCode = guessStateFromCoachLocation(r.institutionLocation);
      if (locCode) codes.push(locCode);
      const regions = Array.isArray(r.regions) ? r.regions : [];
      for (const v of regions) {
        const c = normalizeUsStateToCode(v);
        if (c) codes.push(c);
      }
      const unique = Array.from(new Set(codes));
      if (unique.length === 0) {
        unknown += 1;
        continue;
      }
      // If multiple regions, count the coach once per matched state (useful for "recruiting regions").
      for (const code of unique) counts.set(code, (counts.get(code) ?? 0) + 1);
    }

    const byState = Array.from(counts.entries())
      .map(([code, count]) => ({ code, name: US_STATES.find((s) => s.code === code)?.name ?? code, count }))
      .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));

    return res.json({
      byState,
      unknownCount: unknown,
      totalCoaches,
      missingStateCount: missingStateField,
      withStateCount: Math.max(0, totalCoaches - missingStateField)
    });
  } catch (err) {
    return next(err);
  }
});

// Admin-only: list coaches in a given state (best-effort matching against institutionLocation/regions)
adminRouter.get("/admin/coaches/by-state/:state", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
  try {
    const stateParam = String(req.params.state ?? "").trim();
    const code = normalizeUsStateToCode(stateParam);
    if (!code) {
      return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Valid US state is required" }));
    }
    const stateName = US_STATES.find((s) => s.code === code)?.name ?? code;

    const limitRaw = Number(req.query.limit ?? 25);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : 25;
    const skipRaw = Number(req.query.skip ?? 0);
    const skip = Number.isFinite(skipRaw) ? Math.max(0, Math.min(50_000, skipRaw)) : 0;

    // Best-effort: match either explicit regions OR institutionLocation containing the state code/name.
    const locRegexes: any[] = [
      { institutionLocation: { $regex: `\\b${escapeRegex(code)}\\b`, $options: "i" } }
    ];
    if (stateName && stateName !== code) {
      locRegexes.push({ institutionLocation: { $regex: escapeRegex(stateName), $options: "i" } });
    }

    const match: any = {
      $or: [
        { state: { $regex: `^${escapeRegex(code)}$`, $options: "i" } },
        { regions: { $elemMatch: { $regex: `^${escapeRegex(code)}$`, $options: "i" } } },
        ...locRegexes
      ]
    };

    const [total, coaches] = await Promise.all([
      CoachProfileModel.countDocuments(match),
      CoachProfileModel.aggregate([
        { $match: match },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user"
          }
        },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
        { $sort: { lastName: 1, firstName: 1, updatedAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $project: {
            _id: 0,
            userId: 1,
            firstName: 1,
            lastName: 1,
            title: 1,
            institutionName: 1,
            programLevel: 1,
            institutionLocation: 1,
            regions: 1,
            user: { id: "$user._id", email: "$user.email", role: "$user.role" }
          }
        }
      ])
    ]);

    return res.json({
      state: { code, name: stateName },
      total,
      skip,
      limit,
      coaches
    });
  } catch (err) {
    return next(err);
  }
});

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Admin-only: evaluator distribution map (counts by US state)
adminRouter.get("/admin/evaluators/by-state", requireAuth, requireRole([ROLE.ADMIN]), async (_req, res, next) => {
  try {
    const totalEvaluators = await EvaluatorProfileModel.countDocuments();
    const raw = await EvaluatorProfileModel.aggregate([
      {
        $project: {
          state: {
            $cond: [{ $or: [{ $eq: ["$state", null] }, { $eq: ["$state", ""] }] }, null, "$state"]
          }
        }
      },
      { $group: { _id: "$state", count: { $sum: 1 } } }
    ]);

    const counts = new Map<string, number>();
    let unknown = 0;
    let missingStateCount = 0;

    for (const r of raw as Array<{ _id: any; count: number }>) {
      const code = normalizeUsStateToCode(r._id);
      if (!code) {
        unknown += Number(r.count) || 0;
        missingStateCount += Number(r.count) || 0;
        continue;
      }
      counts.set(code, (counts.get(code) ?? 0) + (Number(r.count) || 0));
    }

    const byState = Array.from(counts.entries())
      .map(([code, count]) => ({ code, name: US_STATES.find((s) => s.code === code)?.name ?? code, count }))
      .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));

    return res.json({
      byState,
      unknownCount: unknown,
      totalEvaluators,
      missingStateCount,
      withStateCount: Math.max(0, totalEvaluators - missingStateCount)
    });
  } catch (err) {
    return next(err);
  }
});

// Admin-only: list evaluators in a given state
adminRouter.get("/admin/evaluators/by-state/:state", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
  try {
    const stateParam = String(req.params.state ?? "").trim();
    const code = normalizeUsStateToCode(stateParam);
    if (!code) {
      return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Valid US state is required" }));
    }
    const stateName = US_STATES.find((s) => s.code === code)?.name ?? code;

    const limitRaw = Number(req.query.limit ?? 25);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : 25;
    const skipRaw = Number(req.query.skip ?? 0);
    const skip = Number.isFinite(skipRaw) ? Math.max(0, Math.min(50_000, skipRaw)) : 0;

    const match: any = { state: { $regex: `^${escapeRegex(code)}$`, $options: "i" } };

    const [total, evaluators] = await Promise.all([
      EvaluatorProfileModel.countDocuments(match),
      EvaluatorProfileModel.aggregate([
        { $match: match },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user"
          }
        },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
        { $sort: { lastName: 1, firstName: 1, updatedAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $project: {
            _id: 0,
            userId: 1,
            firstName: 1,
            lastName: 1,
            title: 1,
            location: 1,
            city: 1,
            state: 1,
            specialties: 1,
            experienceYears: 1,
            user: { id: "$user._id", email: "$user.email", role: "$user.role" }
          }
        }
      ])
    ]);

    return res.json({
      state: { code, name: stateName },
      total,
      skip,
      limit,
      evaluators
    });
  } catch (err) {
    return next(err);
  }
});

function isProjectionTraitKey(key: string) {
  return String(key ?? "").toLowerCase().includes("projection");
}

function computeRubricBreakdown(opts: { rubric: any; form: any }) {
  const rubric = opts.rubric;
  const form = opts.form;

  const categoriesDef: any[] = Array.isArray(form?.categories) ? form.categories : [];
  const categoriesResp: any[] = Array.isArray(rubric?.categories) ? rubric.categories : [];
  const byKey = new Map(categoriesResp.map((c) => [String(c.key), c]));

  const breakdown = categoriesDef.map((cDef) => {
    const cKey = String(cDef.key);
    const cResp = byKey.get(cKey);

    const traitsDef: any[] = Array.isArray(cDef?.traits) ? cDef.traits : [];
    const traitsResp: any[] = Array.isArray(cResp?.traits) ? cResp.traits : [];
    const traitsByKey = new Map(traitsResp.map((t) => [String(t.key), t]));

    const traitScores: Array<{ key: string; score?: number }> = [];
    for (const tDef of traitsDef) {
      const tKey = String(tDef?.key);
      if (!tKey) continue;
      if (isProjectionTraitKey(tKey)) continue;
      const tResp = traitsByKey.get(tKey);
      if (!tResp) continue;

      if (tDef.type === "select") {
        const optVal = String(tResp.valueOption ?? "");
        const options: any[] = Array.isArray(tDef.options) ? tDef.options : [];
        const opt = options.find((o) => String(o.value) === optVal);
        const s = Number(opt?.score);
        if (Number.isFinite(s)) traitScores.push({ key: tKey, score: s });
      } else {
        const n = Number(tResp.valueNumber);
        if (Number.isFinite(n)) traitScores.push({ key: tKey, score: n });
      }
    }

    const scores = traitScores.map((t) => t.score).filter((n): n is number => typeof n === "number" && Number.isFinite(n));
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    return {
      key: cKey,
      label: String(cDef?.label ?? cKey),
      weight: Number(cDef?.weight) || 0,
      average: avg != null ? Math.round(avg * 100) / 100 : null
    };
  });

  return breakdown;
}

// Admin-only: list players in a given state (includes latest evaluation grade + contact info)
adminRouter.get("/admin/players/by-state/:state", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
  try {
    const stateParam = String(req.params.state ?? "").trim();
    const code = normalizeUsStateToCode(stateParam);
    if (!code) {
      return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Valid US state is required" }));
    }
    const stateName = US_STATES.find((s) => s.code === code)?.name ?? code;

    const limitRaw = Number(req.query.limit ?? 25);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : 25;
    const skipRaw = Number(req.query.skip ?? 0);
    const skip = Number.isFinite(skipRaw) ? Math.max(0, Math.min(50_000, skipRaw)) : 0;

    const or: any[] = [{ state: { $regex: `^${escapeRegex(code)}$`, $options: "i" } }];
    if (stateName && stateName !== code) {
      or.push({ state: { $regex: `^${escapeRegex(stateName)}$`, $options: "i" } });
    }
    const match: any = { $or: or };

    const [total, players] = await Promise.all([
      PlayerProfileModel.countDocuments(match),
      PlayerProfileModel.aggregate([
        { $match: match },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user"
          }
        },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: EvaluationReportModel.collection.name,
            let: { uid: "$userId" },
            pipeline: [
              { $match: { $expr: { $eq: ["$playerUserId", "$$uid"] } } },
              { $sort: { createdAt: -1 } },
              { $limit: 1 },
              { $project: { _id: 0, createdAt: 1, overallGrade: 1 } }
            ],
            as: "latestEval"
          }
        },
        {
          $addFields: {
            latestEvaluationAt: { $arrayElemAt: ["$latestEval.createdAt", 0] },
            latestOverallGrade: { $arrayElemAt: ["$latestEval.overallGrade", 0] }
          }
        },
        { $sort: { lastName: 1, firstName: 1, updatedAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $project: {
            _id: 0,
            userId: 1,
            firstName: 1,
            lastName: 1,
            sport: 1,
            position: 1,
            city: 1,
            state: 1,
            contactEmail: 1,
            contactPhone: 1,
            hudlLink: 1,
            latestOverallGrade: 1,
            latestEvaluationAt: 1,
            user: { id: "$user._id", email: "$user.email", role: "$user.role" }
          }
        }
      ])
    ]);

    return res.json({
      state: { code, name: stateName },
      total,
      skip,
      limit,
      players
    });
  } catch (err) {
    return next(err);
  }
});

// Admin-only: email diagnostics
adminRouter.get("/admin/email/config", requireAuth, requireRole([ROLE.ADMIN]), async (_req, res, next) => {
  try {
    const env = getEnv();
    return res.json({
      configured: isEmailConfigured(),
      from: env.INVITE_FROM_EMAIL ?? null,
      host: env.SMTP_HOST ? String(env.SMTP_HOST) : null,
      port: env.SMTP_PORT ?? null,
      secure: env.SMTP_SECURE ?? (env.SMTP_PORT === 465 ? true : null),
      authMethod: env.SMTP_AUTH_METHOD ?? null,
      webAppUrl: env.WEB_APP_URL ?? null
    });
  } catch (err) {
    return next(err);
  }
});

// Admin-only: fetch an evaluation detail bundle (film + report + evaluator + form definition)
// Used by /admin/evaluations/[filmSubmissionId] UI.
adminRouter.get("/admin/evaluations/film/:filmSubmissionId", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.filmSubmissionId)) {
      return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Film submission not found" }));
    }
    const filmSubmissionId = new mongoose.Types.ObjectId(req.params.filmSubmissionId);

    const film = await FilmSubmissionModel.findById(filmSubmissionId).lean();
    if (!film) return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Film submission not found" }));

    const report = await EvaluationReportModel.findOne({ filmSubmissionId }).lean();

    let evaluator: any = null;
    let form: any = null;
    let rubricBreakdown: any[] | null = null;

    if (report) {
      evaluator = await UserModel.findById((report as any).evaluatorUserId)
        .select({ _id: 1, email: 1, role: 1, firstName: 1, lastName: 1 })
        .lean();

      const formId = (report as any).formId ?? (report as any)?.rubric?.formId ?? null;
      if (formId && mongoose.isValidObjectId(String(formId))) {
        form = await EvaluationFormModel.findById(String(formId)).lean();
      }
      if (!form) {
        const sport = String((report as any).sport ?? "").trim().toLowerCase();
        if (sport) {
          form = await EvaluationFormModel.findOne({ sport, isActive: true }).sort({ updatedAt: -1 }).lean();
        }
      }

      if (form && (report as any).rubric) {
        rubricBreakdown = computeRubricBreakdown({ rubric: (report as any).rubric, form });
      }
    }

    return res.json({
      film: { ...film, _id: String((film as any)._id), userId: String((film as any).userId) },
      report: report
        ? {
            ...report,
            _id: String((report as any)._id),
            filmSubmissionId: String((report as any).filmSubmissionId),
            playerUserId: String((report as any).playerUserId),
            evaluatorUserId: String((report as any).evaluatorUserId),
            formId: (report as any).formId ? String((report as any).formId) : null
          }
        : null,
      evaluator: evaluator
        ? {
            id: String((evaluator as any)._id),
            email: (evaluator as any).email ?? null,
            role: (evaluator as any).role ?? null,
            firstName: (evaluator as any).firstName ?? null,
            lastName: (evaluator as any).lastName ?? null
          }
        : null,
      form: form ? { ...form, _id: String((form as any)._id) } : null,
      rubricBreakdown
    });
  } catch (err) {
    return next(err);
  }
});

adminRouter.get("/admin/email/audit", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
  try {
    const limitRaw = Number(req.query.limit ?? 100);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 100;
    const skipRaw = Number(req.query.skip ?? 0);
    const skip = Number.isFinite(skipRaw) ? Math.max(0, Math.min(50_000, skipRaw)) : 0;
    const status = String(req.query.status ?? "").trim();
    const type = String(req.query.type ?? "").trim();
    const to = String(req.query.to ?? "").trim().toLowerCase();
    const sinceHoursRaw = Number(req.query.sinceHours ?? "");
    const sinceHours = Number.isFinite(sinceHoursRaw) ? Math.max(1, Math.min(24 * 30, sinceHoursRaw)) : null;
    const since = sinceHours ? new Date(Date.now() - sinceHours * 60 * 60 * 1000) : null;

    const q: any = {};
    if (status) q.status = status;
    if (type) q.type = type;
    if (to) q.to = to;
    if (since) q.createdAt = { $gte: since };

    const last24 = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [total, results, totalLast24, failedLast24] = await Promise.all([
      EmailAuditLogModel.countDocuments(q),
      EmailAuditLogModel.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      EmailAuditLogModel.countDocuments({ createdAt: { $gte: last24 } }),
      EmailAuditLogModel.countDocuments({ createdAt: { $gte: last24 }, status: EMAIL_AUDIT_STATUS.FAILED })
    ]);
    const failRateLast24hPct = totalLast24 ? Math.round((failedLast24 / totalLast24) * 1000) / 10 : 0;
    return res.json({
      total,
      results,
      skip,
      limit,
      sinceHours,
      kpis: { totalLast24: Number(totalLast24) || 0, failedLast24: Number(failedLast24) || 0, failRateLast24hPct }
    });
  } catch (err) {
    return next(err);
  }
});

// Admin-only: resend invite email (creates a fresh invite token)
adminRouter.post("/admin/email/resend-invite", adminEmailLimiter, requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
  try {
    const email = String((req.body as any)?.email ?? "").trim().toLowerCase();
    const role = String((req.body as any)?.role ?? "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Valid email is required" }));
    }
    if (!role) {
      return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Valid role is required" }));
    }
    if (!isInviteEmailConfigured()) {
      return next(new ApiError({ status: 501, code: "NOT_CONFIGURED", message: "Email is not configured" }));
    }

    const invite = await createInvite({ email, role, createdByUserId: req.user!.id as any });

    const env = getEnv();
    const base = String(env.WEB_APP_URL ?? "").replace(/\/+$/, "");
    await sendInviteEmail({
      to: invite.email,
      role: invite.role,
      code: invite.token,
      inviteUrl: base ? `${base}/invite` : "/invite",
      expiresAtIso: invite.expiresAt
    });

    await logAdminAction({
      req,
      actorUserId: String(req.user!.id),
      action: "email_resend_invite",
      targetType: "email",
      targetId: email,
      meta: { role }
    });

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

adminRouter.post("/admin/email/test", adminEmailLimiter, requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
  try {
    const to = String((req.body as any)?.to ?? "").trim().toLowerCase();
    if (!to || !to.includes("@")) {
      return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Valid 'to' email is required" }));
    }
    if (!isEmailConfigured()) {
      return next(new ApiError({ status: 501, code: "NOT_CONFIGURED", message: "Email is not configured" }));
    }

    const { env, transporter } = createTransporterOrThrow();
    const subject = `GoEducate Talent – Test email`;
    const text = `This is a test email from GoEducate Talent.\n\nTime: ${new Date().toISOString()}\nRequestId: ${(req as any).requestId ?? ""}\n`;
    const html = `<div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
  <h2 style="margin:0 0 12px 0;">Test email</h2>
  <p style="margin:0 0 12px 0;">This is a test email from GoEducate Talent.</p>
  <p style="margin:0 0 0 0;color:#51607F;">Time: ${new Date().toISOString()}</p>
</div>`;

    const info = await sendMailWithAudit({
      transporter,
      type: EMAIL_AUDIT_TYPE.TEST,
      mail: { from: env.INVITE_FROM_EMAIL, to, subject, text, html },
      related: { userId: req.user?.id }
    });

    return res.json({ ok: true, messageId: (info as any)?.messageId ?? null });
  } catch (err) {
    return next(err);
  }
});

// Admin-only: resend an email based on an audit log row (best-effort).
// Supports: invite, access request approved/rejected, notification (if meta contains payload).
adminRouter.post("/admin/email/resend", adminEmailLimiter, requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
  try {
    const id = String((req.body as any)?.id ?? "").trim();
    if (!id || !mongoose.isValidObjectId(id)) {
      return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Valid audit log id is required" }));
    }

    const row = await EmailAuditLogModel.findById(id).lean();
    if (!row) {
      return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Email audit log row not found" }));
    }

    // INVITE
    if (row.type === EMAIL_AUDIT_TYPE.INVITE) {
      const inviteRole = String((row as any)?.meta?.role ?? "").trim().toLowerCase();
      if (!inviteRole) {
        return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Missing invite role metadata on this row." }));
      }
      if (!isInviteEmailConfigured()) {
        return next(new ApiError({ status: 501, code: "NOT_CONFIGURED", message: "Email is not configured" }));
      }

      const invite = await createInvite({ email: row.to, role: inviteRole, createdByUserId: req.user!.id as any });
      const env = getEnv();
      const base = String(env.WEB_APP_URL ?? "").replace(/\/+$/, "");
      await sendInviteEmail({
        to: invite.email,
        role: invite.role,
        code: invite.token,
        inviteUrl: base ? `${base}/invite` : "/invite",
        expiresAtIso: invite.expiresAt
      });

      await logAdminAction({
        req,
        actorUserId: String(req.user!.id),
        action: "email_resend",
        targetType: "email_audit",
        targetId: String(row._id),
        meta: { type: row.type, to: row.to }
      });

      return res.json({ ok: true, supported: true });
    }

    // ACCESS REQUEST APPROVED/REJECTED
    if (row.type === EMAIL_AUDIT_TYPE.ACCESS_REQUEST_APPROVED || row.type === EMAIL_AUDIT_TYPE.ACCESS_REQUEST_REJECTED) {
      if (!isAccessRequestEmailConfigured()) {
        return next(new ApiError({ status: 501, code: "NOT_CONFIGURED", message: "Email is not configured" }));
      }

      const accessRequestId = (row as any).relatedAccessRequestId ? String((row as any).relatedAccessRequestId) : "";
      if (!accessRequestId || !mongoose.isValidObjectId(accessRequestId)) {
        return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "This email is missing relatedAccessRequestId." }));
      }

      const ar = await AccessRequestModel.findById(accessRequestId).lean();
      if (!ar) {
        return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Related access request not found" }));
      }

      if (row.type === EMAIL_AUDIT_TYPE.ACCESS_REQUEST_APPROVED) {
        const invite = await createInvite({ email: ar.email, role: ar.requestedRole, createdByUserId: req.user!.id as any });
        const env = getEnv();
        const base = String(env.WEB_APP_URL ?? "").replace(/\/+$/, "");
        const inviteUrl = base ? `${base}/invite` : "/invite";

        try {
          const info = await sendAccessRequestApprovedEmail({
            to: ar.email,
            inviteUrl,
            inviteCode: invite.token,
            expiresAtIso: invite.expiresAt
          });
          await EmailAuditLogModel.create({
            type: EMAIL_AUDIT_TYPE.ACCESS_REQUEST_APPROVED,
            status: EMAIL_AUDIT_STATUS.SENT,
            to: ar.email,
            subject: info.subject,
            relatedAccessRequestId: ar._id,
            relatedInviteEmail: ar.email,
            messageId: info.messageId,
            meta: { resendOf: String(row._id), role: ar.requestedRole }
          });
        } catch (err) {
          await EmailAuditLogModel.create({
            type: EMAIL_AUDIT_TYPE.ACCESS_REQUEST_APPROVED,
            status: EMAIL_AUDIT_STATUS.FAILED,
            to: ar.email,
            subject: "GoEducate Talent – Access request approved",
            relatedAccessRequestId: ar._id,
            relatedInviteEmail: ar.email,
            error: err instanceof Error ? { message: err.message, name: err.name, stack: err.stack } : err,
            meta: { resendOf: String(row._id), role: ar.requestedRole }
          });
          throw err;
        }
      } else {
        try {
          const info = await sendAccessRequestRejectedEmail({ to: ar.email });
          await EmailAuditLogModel.create({
            type: EMAIL_AUDIT_TYPE.ACCESS_REQUEST_REJECTED,
            status: EMAIL_AUDIT_STATUS.SENT,
            to: ar.email,
            subject: info.subject,
            relatedAccessRequestId: ar._id,
            relatedInviteEmail: ar.email,
            messageId: info.messageId,
            meta: { resendOf: String(row._id) }
          });
        } catch (err) {
          await EmailAuditLogModel.create({
            type: EMAIL_AUDIT_TYPE.ACCESS_REQUEST_REJECTED,
            status: EMAIL_AUDIT_STATUS.FAILED,
            to: ar.email,
            subject: "GoEducate Talent – Access request update",
            relatedAccessRequestId: ar._id,
            relatedInviteEmail: ar.email,
            error: err instanceof Error ? { message: err.message, name: err.name, stack: err.stack } : err,
            meta: { resendOf: String(row._id) }
          });
          throw err;
        }
      }

      await logAdminAction({
        req,
        actorUserId: String(req.user!.id),
        action: "email_resend",
        targetType: "email_audit",
        targetId: String(row._id),
        meta: { type: row.type, to: row.to, relatedAccessRequestId: accessRequestId }
      });

      return res.json({ ok: true, supported: true });
    }

    // NOTIFICATION (requires meta payload; older rows may not have enough info)
    if (row.type === EMAIL_AUDIT_TYPE.NOTIFICATION) {
      if (!isNotificationEmailConfigured()) {
        return next(new ApiError({ status: 501, code: "NOT_CONFIGURED", message: "Email is not configured" }));
      }
      const meta: any = (row as any).meta ?? {};
      const subject = String(meta.subject ?? row.subject ?? "").trim();
      const title = String(meta.title ?? "").trim();
      const message = String(meta.message ?? "").trim();
      const href = meta.href ? String(meta.href) : undefined;
      if (!subject || !title || !message) {
        return next(
          new ApiError({
            status: 400,
            code: "BAD_REQUEST",
            message: "This notification email is missing metadata required to resend (title/message/subject)."
          })
        );
      }

      await sendNotificationEmail({
        to: row.to,
        subject,
        title,
        message,
        href,
        cc: (row as any).cc ?? undefined,
        bcc: (row as any).bcc ?? undefined
      });

      await logAdminAction({
        req,
        actorUserId: String(req.user!.id),
        action: "email_resend",
        targetType: "email_audit",
        targetId: String(row._id),
        meta: { type: row.type, to: row.to }
      });

      return res.json({ ok: true, supported: true });
    }

    return res.json({ ok: true, supported: false, message: "Resend is not supported for this email type yet." });
  } catch (err) {
    return next(err);
  }
});

// Admin-only: audit log (who did what)
adminRouter.get("/admin/audit", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
  try {
    const limitRaw = Number(req.query.limit ?? 100);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 100;
    const skipRaw = Number(req.query.skip ?? 0);
    const skip = Number.isFinite(skipRaw) ? Math.max(0, Math.min(50_000, skipRaw)) : 0;
    const action = String(req.query.action ?? "").trim();
    const actorEmail = String(req.query.actorEmail ?? "").trim().toLowerCase();

    const match: any = {};
    if (action) match.action = { $regex: action, $options: "i" };

    const basePipeline: any[] = [{ $match: match }, { $sort: { createdAt: -1 } }];
    basePipeline.push(
      {
        $lookup: {
          from: "users",
          localField: "actorUserId",
          foreignField: "_id",
          as: "actor"
        }
      },
      { $unwind: { path: "$actor", preserveNullAndEmptyArrays: true } }
    );
    if (actorEmail) basePipeline.push({ $match: { "actor.email": actorEmail } });

    const [totalRows, results] = await Promise.all([
      AdminAuditLogModel.aggregate([...basePipeline, { $count: "count" }]),
      AdminAuditLogModel.aggregate([
        ...basePipeline,
        { $skip: skip },
        { $limit: limit },
        {
          $project: {
            _id: 1,
            createdAt: 1,
            action: 1,
            targetType: 1,
            targetId: 1,
            ip: 1,
            userAgent: 1,
            meta: 1,
            actor: { id: "$actor._id", email: "$actor.email", role: "$actor.role" }
          }
        }
      ])
    ]);

    const total = Number(totalRows?.[0]?.count ?? 0);
    return res.json({ total, results, skip, limit });
  } catch (err) {
    return next(err);
  }
});

// Audit logs (profile-related). Admin only.
// GET /admin/audit-logs?action=PROFILE_VISIBILITY_CHANGED&limit=50
adminRouter.get("/admin/audit-logs", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
  try {
    const { action, limit } = req.query as Record<string, string | undefined>;
    const lim = Math.max(1, Math.min(200, limit ? Number(limit) : 50));
    const q: Record<string, any> = {};
    if (action) q.action = String(action);
    const items = await AuditLogModel.find(q).sort({ createdAt: -1 }).limit(lim).lean();
    return res.json({
      items: items.map((i: any) => ({
        ...i,
        _id: String(i._id),
        actorUserId: String(i.actorUserId),
        targetUserId: String(i.targetUserId)
      }))
    });
  } catch (err) {
    return next(err);
  }
});

// Admin-only: notifications "queue" (latest notifications across all users)
adminRouter.get("/admin/notifications", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
  try {
    const unreadOnly = String(req.query.unreadOnly ?? "").trim() === "1";
    const limitRaw = Number(req.query.limit ?? 50);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 50;
    const skipRaw = Number(req.query.skip ?? 0);
    const skip = Number.isFinite(skipRaw) ? Math.max(0, Math.min(50_000, skipRaw)) : 0;

    const match: any = {};
    if (unreadOnly) match.readAt = { $exists: false };

    const results = await NotificationModel.aggregate([
      { $match: match },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user"
        }
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          type: 1,
          title: 1,
          message: 1,
          href: 1,
          createdAt: 1,
          readAt: 1,
          user: { id: "$user._id", email: "$user.email", role: "$user.role" }
        }
      }
    ]);

    const total = await NotificationModel.countDocuments(match);
    return res.json({ total, results, skip, limit });
  } catch (err) {
    return next(err);
  }
});

// Admin-only: delete a notification by id (remove from queue)
adminRouter.delete("/admin/notifications/:id", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Notification not found" }));
    }
    const _id = new mongoose.Types.ObjectId(req.params.id);
    const deleted = await NotificationModel.deleteOne({ _id });
    if (!deleted.deletedCount) {
      return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Notification not found" }));
    }
    void logAdminAction({
      req,
      actorUserId: String(req.user!.id),
      action: "admin.notifications.delete",
      targetType: "Notification",
      targetId: String(_id),
      meta: {}
    });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

// Admin-only: bulk delete notifications (all or unread-only)
adminRouter.delete("/admin/notifications", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
  try {
    const unreadOnly = String(req.query.unreadOnly ?? "").trim() === "1";
    const query: any = {};
    if (unreadOnly) query.readAt = { $exists: false };

    const result = await NotificationModel.deleteMany(query);
    void logAdminAction({
      req,
      actorUserId: String(req.user!.id),
      action: "admin.notifications.bulk_delete",
      targetType: "Notification",
      targetId: unreadOnly ? "unreadOnly" : "all",
      meta: { unreadOnly, deletedCount: result.deletedCount ?? 0 }
    });
    return res.json({ deletedCount: result.deletedCount ?? 0 });
  } catch (err) {
    return next(err);
  }
});

// Admin-only: bulk mark notifications as read (all or unread-only)
adminRouter.patch("/admin/notifications/read", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
  try {
    const unreadOnly = String(req.query.unreadOnly ?? "").trim() === "1";
    const query: any = {};
    if (unreadOnly) query.readAt = { $exists: false };

    const result = await NotificationModel.updateMany(query, { $set: { readAt: new Date() } });
    void logAdminAction({
      req,
      actorUserId: String(req.user!.id),
      action: "admin.notifications.bulk_mark_read",
      targetType: "Notification",
      targetId: unreadOnly ? "unreadOnly" : "all",
      meta: { unreadOnly, modifiedCount: (result as any).modifiedCount ?? 0 }
    });
    return res.json({ modifiedCount: (result as any).modifiedCount ?? 0 });
  } catch (err) {
    return next(err);
  }
});

// Admin-only: generate an invite code (one-time use, expires) for any role.
adminRouter.post("/admin/invites", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
  try {
    const email = String((req.body as { email?: unknown }).email ?? "");
    const role = String((req.body as { role?: unknown }).role ?? "");
    const invite = await createInvite({ email, role, createdByUserId: req.user!.id as any });
    void logAdminAction({
      req,
      actorUserId: String(req.user!.id),
      action: "admin.invites.create",
      targetType: "EvaluatorInvite",
      targetId: invite.email,
      meta: { email: invite.email, role: invite.role, expiresAt: invite.expiresAt }
    });

    // If email is configured, send the invite email.
    const emailConfigured = isInviteEmailConfigured();
    let emailSent = false;
    let emailError: string | undefined;
    if (emailConfigured) {
      try {
        const env = getEnv();
        const baseUrl = (env.WEB_APP_URL ?? "").replace(/\/+$/, "");
        const inviteUrl = `${baseUrl}/invite`;
        await sendInviteEmail({
          to: invite.email,
          role: invite.role,
          code: invite.token,
          inviteUrl,
          expiresAtIso: invite.expiresAt
        });
        emailSent = true;
      } catch (err) {
        // Don't fail invite creation if SMTP fails. Return details so admin can copy/paste.
        emailSent = false;
        emailError = err instanceof Error ? err.message : "Failed to send invite email";
      }
    }

    return res.status(201).json({
      invite,
      emailSent,
      ...(emailError ? { emailError } : {})
    });
  } catch (err) {
    return next(err);
  }
});

// Backwards compatible route name (evaluator only)
adminRouter.post("/admin/evaluator-invites", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
  try {
    const email = String((req.body as { email?: unknown }).email ?? "");
    const invite = await createInvite({ email, role: ROLE.EVALUATOR, createdByUserId: req.user!.id as any });

    const emailConfigured = isInviteEmailConfigured();
    let emailSent = false;
    let emailError: string | undefined;
    if (emailConfigured) {
      try {
        const env = getEnv();
        const baseUrl = (env.WEB_APP_URL ?? "").replace(/\/+$/, "");
        const inviteUrl = `${baseUrl}/invite`;
        await sendInviteEmail({
          to: invite.email,
          role: invite.role,
          code: invite.token,
          inviteUrl,
          expiresAtIso: invite.expiresAt
        });
        emailSent = true;
      } catch (err) {
        emailSent = false;
        emailError = err instanceof Error ? err.message : "Failed to send invite email";
      }
    }

    return res.status(201).json({ invite, emailSent, ...(emailError ? { emailError } : {}) });
  } catch (err) {
    return next(err);
  }
});

// Admin-only: list users (basic search + filter)
adminRouter.get("/admin/users", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
  try {
    const role = String((req.query as any).role ?? "").trim().toLowerCase();
    const q = String((req.query as any).q ?? "").trim().toLowerCase();
    const limit = Math.min(200, Math.max(1, Number((req.query as any).limit ?? 100)));

    const filter: any = {};
    if (role && [ROLE.PLAYER, ROLE.COACH, ROLE.EVALUATOR, ROLE.ADMIN].includes(role as any)) filter.role = role;
    if (q) {
      const rx = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
      filter.$or = [{ email: rx }, { username: rx }];
    }

    const results = await UserModel.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
    return res.json({
      results: results.map((u) => ({
        id: String(u._id),
        email: u.email,
        username: (u as any).username,
        role: u.role,
        firstName: u.firstName,
        lastName: u.lastName,
        subscriptionStatus: u.subscriptionStatus,
        isActive: (u as any).isActive !== false,
        createdAt: u.createdAt?.toISOString?.() ?? undefined
      }))
    });
  } catch (err) {
    return next(err);
  }
});

const AdminUserUpdateSchema = z.object({
  role: z.enum([ROLE.PLAYER, ROLE.COACH, ROLE.EVALUATOR, ROLE.ADMIN]).optional(),
  email: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
    z.string().email().max(254)
  ).optional(),
  username: z
    .preprocess((v) => (typeof v === "string" ? v.trim().toLowerCase() : v), z.string().min(3).max(40))
    .optional(),
  firstName: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.string().min(1).max(60)
  ).optional(),
  lastName: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.string().min(1).max(60)
  ).optional(),
  subscriptionStatus: z.enum([COACH_SUBSCRIPTION_STATUS.INACTIVE, COACH_SUBSCRIPTION_STATUS.ACTIVE]).optional(),
  isActive: z.boolean().optional(),
  // Profile visibility (role-specific)
  profilePublic: z.boolean().optional(),
  playerContactVisibleToSubscribedCoaches: z.boolean().optional(),
  profileCity: z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().min(1).max(80)).optional(),
  profileState: z.preprocess((v) => (typeof v === "string" ? v.trim().toUpperCase() : v), z.string().min(1).max(40)).optional(),
  // Admin-only direct password set (optional); prefer sending a reset link.
  newPassword: z.string().min(8).max(200).optional()
});

// Admin-only: update a user (role/name/subscription status).
adminRouter.patch("/admin/users/:id", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
  const parsed = AdminUserUpdateSchema.safeParse(req.body);
  if (!parsed.success) return next(zodToBadRequest(parsed.error.flatten()));

  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "User not found" }));
    }
    const _id = new mongoose.Types.ObjectId(req.params.id);
    const actorId = String(req.user!.id);

    const user = await UserModel.findById(_id);
    if (!user) return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "User not found" }));

    // Prevent locking yourself out.
    if (String(_id) === actorId && parsed.data.role && parsed.data.role !== ROLE.ADMIN) {
      return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "You cannot change your own role" }));
    }

    const before = {
      email: user.email,
      username: (user as any).username,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      subscriptionStatus: user.subscriptionStatus,
      isActive: (user as any).isActive !== false
    };

    const nextRole = parsed.data.role ?? user.role;

    // Prevent removing the last admin.
    if (user.role === ROLE.ADMIN && nextRole !== ROLE.ADMIN) {
      const adminCount = await UserModel.countDocuments({ role: ROLE.ADMIN });
      if (adminCount <= 1) {
        return next(new ApiError({ status: 409, code: "CANNOT_UPDATE", message: "Cannot remove the last admin" }));
      }
    }

    // If converting to coach, ensure we have names.
    const nextFirst = parsed.data.firstName ?? user.firstName;
    const nextLast = parsed.data.lastName ?? user.lastName;
    if (nextRole === ROLE.COACH && (!nextFirst || !nextLast)) {
      return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Coach first and last name are required" }));
    }

    // Email/username updates (optional)
    if (parsed.data.email && parsed.data.email !== user.email) {
      const existingEmail = await UserModel.findOne({ email: parsed.data.email }).lean();
      if (existingEmail && String(existingEmail._id) !== String(user._id)) {
        return next(new ApiError({ status: 409, code: "EMAIL_TAKEN", message: "Email already registered" }));
      }
      user.email = parsed.data.email;
    }
    if (typeof parsed.data.username === "string") {
      const uname = parsed.data.username.trim().toLowerCase();
      if (!/^[a-z0-9_][a-z0-9_.-]{1,38}[a-z0-9_]$/.test(uname)) {
        return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Username must be 3-40 chars (letters/numbers/._-), start/end alphanumeric/underscore" }));
      }
      const existingUsername = await UserModel.findOne({ username: uname }).lean();
      if (existingUsername && String(existingUsername._id) !== String(user._id)) {
        return next(new ApiError({ status: 409, code: "USERNAME_TAKEN", message: "Username already taken" }));
      }
      (user as any).username = uname;
    }
    if (typeof parsed.data.isActive === "boolean") {
      (user as any).isActive = parsed.data.isActive;
    }

    user.role = nextRole as any;
    if (parsed.data.firstName) user.firstName = parsed.data.firstName;
    if (parsed.data.lastName) user.lastName = parsed.data.lastName;

    if (nextRole === ROLE.COACH) {
      user.subscriptionStatus = parsed.data.subscriptionStatus ?? user.subscriptionStatus ?? COACH_SUBSCRIPTION_STATUS.INACTIVE;
    } else {
      user.subscriptionStatus = undefined;
    }

    if (parsed.data.newPassword) {
      user.passwordHash = await hashPassword(parsed.data.newPassword);
      (user as any).passwordResetTokenHash = undefined;
      (user as any).passwordResetExpiresAt = undefined;
      (user as any).passwordResetUsedAt = undefined;
    }

    await user.save();

    // Profile visibility updates (best-effort; only if the profile exists for that role)
    if (typeof parsed.data.profilePublic === "boolean") {
      if (nextRole === ROLE.PLAYER) {
        const profile = await PlayerProfileModel.findOne({ userId: _id }).lean();
        if (!profile) {
          return next(
            new ApiError({
              status: 409,
              code: "PROFILE_MISSING",
              message: "Player profile not created yet. The player must save their profile before it can be made public."
            })
          );
        }
        await PlayerProfileModel.updateOne({ userId: _id }, { $set: { isProfilePublic: parsed.data.profilePublic } });
      }
      if (nextRole === ROLE.COACH) {
        await CoachProfileModel.updateOne(
          { userId: _id },
          { $set: { isProfilePublic: parsed.data.profilePublic }, $setOnInsert: { userId: _id } },
          { upsert: true }
        );
      }
      if (nextRole === ROLE.EVALUATOR) {
        await EvaluatorProfileModel.updateOne(
          { userId: _id },
          { $set: { isProfilePublic: parsed.data.profilePublic }, $setOnInsert: { userId: _id } },
          { upsert: true }
        );
      }
    }
    if (typeof parsed.data.playerContactVisibleToSubscribedCoaches === "boolean" && nextRole === ROLE.PLAYER) {
      const profile = await PlayerProfileModel.findOne({ userId: _id }).lean();
      if (!profile) {
        return next(
          new ApiError({
            status: 409,
            code: "PROFILE_MISSING",
            message: "Player profile not created yet. The player must save their profile before contact visibility can be changed."
          })
        );
      }
      await PlayerProfileModel.updateOne(
        { userId: _id },
        { $set: { isContactVisibleToSubscribedCoaches: parsed.data.playerContactVisibleToSubscribedCoaches } }
      );
    }

    // City/State updates (role-specific)
    if (parsed.data.profileCity || parsed.data.profileState) {
      if (nextRole === ROLE.PLAYER) {
        const profile = await PlayerProfileModel.findOne({ userId: _id }).lean();
        if (!profile) {
          return next(
            new ApiError({
              status: 409,
              code: "PROFILE_MISSING",
              message: "Player profile not created yet. The player must save their profile before location can be changed."
            })
          );
        }
        const update: any = {};
        if (parsed.data.profileCity) update.city = parsed.data.profileCity;
        if (parsed.data.profileState) update.state = parsed.data.profileState;
        await PlayerProfileModel.updateOne({ userId: _id }, { $set: update });
      }
      if (nextRole === ROLE.COACH) {
        const update: any = {};
        if (parsed.data.profileCity) update.city = parsed.data.profileCity;
        if (parsed.data.profileState) update.state = parsed.data.profileState;
        await CoachProfileModel.updateOne({ userId: _id }, { $set: update, $setOnInsert: { userId: _id } }, { upsert: true });
      }
      if (nextRole === ROLE.EVALUATOR) {
        const update: any = {};
        if (parsed.data.profileCity) update.city = parsed.data.profileCity;
        if (parsed.data.profileState) update.state = parsed.data.profileState;
        await EvaluatorProfileModel.updateOne({ userId: _id }, { $set: update, $setOnInsert: { userId: _id } }, { upsert: true });
      }
    }

    // Keep coach/evaluator profile names in sync (best-effort).
    if (nextRole === ROLE.COACH) {
      await CoachProfileModel.updateOne(
        { userId: _id },
        { $set: { firstName: user.firstName, lastName: user.lastName }, $setOnInsert: { userId: _id, isProfilePublic: true } },
        { upsert: true }
      );
    }
    if (nextRole === ROLE.EVALUATOR) {
      await EvaluatorProfileModel.updateOne(
        { userId: _id },
        { $set: { firstName: user.firstName, lastName: user.lastName }, $setOnInsert: { userId: _id, isProfilePublic: true } },
        { upsert: true }
      );
    }

    const after = {
      email: user.email,
      username: (user as any).username,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      subscriptionStatus: user.subscriptionStatus,
      isActive: (user as any).isActive !== false
    };
    void logAdminAction({
      req,
      actorUserId: actorId,
      action: "admin.users.update",
      targetType: "User",
      targetId: String(_id),
      meta: { before, after }
    });

    return res.json({
      user: {
        id: String(user._id),
        email: user.email,
        username: (user as any).username,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        subscriptionStatus: user.subscriptionStatus,
        isActive: (user as any).isActive !== false
      }
    });
  } catch (err) {
    return next(err);
  }
});

// Admin-only: user detail (includes role-specific profile city/state so admin can edit in a modal)
adminRouter.get("/admin/users/:id/detail", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "User not found" }));
    }
    const _id = new mongoose.Types.ObjectId(req.params.id);
    const user = await UserModel.findById(_id).lean();
    if (!user) return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "User not found" }));

    let profile: any = null;
    if (user.role === ROLE.PLAYER) {
      profile = await PlayerProfileModel.findOne({ userId: _id }).lean();
      profile = profile
        ? {
            profileExists: true,
            city: (profile as any).city,
            state: (profile as any).state,
            profilePublic: Boolean((profile as any).isProfilePublic),
            playerContactVisibleToSubscribedCoaches: Boolean((profile as any).isContactVisibleToSubscribedCoaches)
          }
        : { profileExists: false };
    } else if (user.role === ROLE.COACH) {
      const p = await CoachProfileModel.findOne({ userId: _id }).lean();
      profile = p
        ? {
            profileExists: true,
            city: (p as any).city,
            state: (p as any).state,
            profilePublic: Boolean((p as any).isProfilePublic),
            institutionName: (p as any).institutionName ?? null
          }
        : { profileExists: false };
    } else if (user.role === ROLE.EVALUATOR) {
      const p = await EvaluatorProfileModel.findOne({ userId: _id }).lean();
      profile = p
        ? {
            profileExists: true,
            city: (p as any).city,
            state: (p as any).state,
            profilePublic: Boolean((p as any).isProfilePublic),
            location: (p as any).location ?? null
          }
        : { profileExists: false };
    } else {
      profile = { profileExists: false };
    }

    return res.json({
      user: {
        id: String((user as any)._id),
        email: (user as any).email,
        username: (user as any).username,
        role: (user as any).role,
        firstName: (user as any).firstName,
        lastName: (user as any).lastName,
        subscriptionStatus: (user as any).subscriptionStatus,
        isActive: (user as any).isActive !== false
      },
      profile
    });
  } catch (err) {
    return next(err);
  }
});

// Admin-only: send a password reset email to a user (generic ok; audited by email log)
adminRouter.post("/admin/users/:id/send-password-reset", adminEmailLimiter, requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "User not found" }));
    }
    const _id = new mongoose.Types.ObjectId(req.params.id);
    const user = await UserModel.findById(_id);
    if (!user) return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "User not found" }));

    // Always return ok (avoid leaking info via admin tooling? still fine; admin already has list)
    if (user.isActive === false) return res.json({ ok: true });

    // Generate + store reset token
    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    user.passwordResetTokenHash = tokenHash;
    user.passwordResetExpiresAt = new Date(Date.now() + 1000 * 60 * 60);
    user.passwordResetUsedAt = undefined;
    user.passwordResetRequestedAt = new Date();
    await user.save();

    if (isAuthRecoveryEmailConfigured()) {
      void sendPasswordResetEmail({ to: user.email, resetToken: token }).catch(() => {});
    }

    void logAdminAction({
      req,
      actorUserId: String(req.user!.id),
      action: "admin.users.send_password_reset",
      targetType: "User",
      targetId: String(_id),
      meta: { email: user.email }
    });

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

// Admin-only: fetch a user's profile visibility flags (to drive admin UI toggles).
adminRouter.get("/admin/users/:id/profile-visibility", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "User not found" }));
    }
    const _id = new mongoose.Types.ObjectId(req.params.id);
    const user = await UserModel.findById(_id).lean();
    if (!user) return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "User not found" }));

    if (user.role === ROLE.PLAYER) {
      const profile = await PlayerProfileModel.findOne({ userId: _id }).lean();
      return res.json({
        role: user.role,
        profileExists: !!profile,
        profilePublic: profile ? Boolean((profile as any).isProfilePublic) : false,
        playerContactVisibleToSubscribedCoaches: profile ? Boolean((profile as any).isContactVisibleToSubscribedCoaches) : false
      });
    }
    if (user.role === ROLE.COACH) {
      const profile = await CoachProfileModel.findOne({ userId: _id }).lean();
      return res.json({
        role: user.role,
        profileExists: !!profile,
        profilePublic: profile ? Boolean((profile as any).isProfilePublic) : false
      });
    }
    if (user.role === ROLE.EVALUATOR) {
      const profile = await EvaluatorProfileModel.findOne({ userId: _id }).lean();
      return res.json({
        role: user.role,
        profileExists: !!profile,
        profilePublic: profile ? Boolean((profile as any).isProfilePublic) : false
      });
    }
    return res.json({ role: user.role, profileExists: false, profilePublic: false });
  } catch (err) {
    return next(err);
  }
});

// Admin-only: delete a user (with basic cascade cleanup). Prevent deleting yourself or the last admin.
adminRouter.delete("/admin/users/:id", adminDangerLimiter, requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "User not found" }));
    }
    const _id = new mongoose.Types.ObjectId(req.params.id);

    if (String(_id) === String(req.user!.id)) {
      return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "You cannot delete your own account" }));
    }

    const user = await UserModel.findById(_id);
    if (!user) return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "User not found" }));

    if (user.role === ROLE.ADMIN) {
      const adminCount = await UserModel.countDocuments({ role: ROLE.ADMIN });
      if (adminCount <= 1) {
        return next(new ApiError({ status: 409, code: "CANNOT_DELETE", message: "Cannot delete the last admin" }));
      }
    }

    // Capture fields for audit before deletion
    const auditEmail = user.email;
    const auditRole = user.role;

    // Cascade cleanup (best-effort)
    if (user.role === ROLE.PLAYER) {
      await PlayerProfileModel.deleteMany({ userId: _id });
      await FilmSubmissionModel.deleteMany({ userId: _id });
      await EvaluationReportModel.deleteMany({ playerUserId: _id });
      await WatchlistModel.deleteMany({ playerUserId: String(_id) });
    }
    if (user.role === ROLE.COACH) {
      await WatchlistModel.deleteMany({ coachUserId: _id });
    }
    if (user.role === ROLE.EVALUATOR) {
      await EvaluationReportModel.deleteMany({ evaluatorUserId: _id });
    }

    await user.deleteOne();
    void logAdminAction({
      req,
      actorUserId: String(req.user!.id),
      action: "admin.users.delete",
      targetType: "User",
      targetId: String(_id),
      meta: { email: auditEmail, role: auditRole }
    });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

// Admin-only: verify SMTP configuration and (optionally) send a test email.
adminRouter.post("/admin/email/test", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
  const env = getEnv();
  const to = String((req.body as { to?: unknown }).to ?? "").trim();
  if (!env.SMTP_HOST || !env.SMTP_PORT || !env.SMTP_USER || !env.SMTP_PASS || !env.INVITE_FROM_EMAIL) {
    return next(new ApiError({ status: 501, code: "NOT_CONFIGURED", message: "SMTP is not configured" }));
  }

  const host = String(env.SMTP_HOST).trim().replace(/^["']|["']$/g, "");
  const user = String(env.SMTP_USER).trim().replace(/^["']|["']$/g, "");
  const secure = env.SMTP_SECURE ?? Number(env.SMTP_PORT) === 465;

  const transport = {
    host,
    port: env.SMTP_PORT,
    secure,
    user,
    authMethod: env.SMTP_AUTH_METHOD ?? null
  };

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: Number(env.SMTP_PORT),
      secure,
      auth: {
        user,
        pass: String(env.SMTP_PASS).trim().replace(/^["']|["']$/g, "")
      },
      ...(env.SMTP_AUTH_METHOD ? { authMethod: env.SMTP_AUTH_METHOD } : {}),
      tls: { minVersion: "TLSv1.2", servername: host }
    });

    await transporter.verify();

    if (to) {
      await transporter.sendMail({
        from: env.INVITE_FROM_EMAIL,
        to,
        subject: "GoEducate Talent – SMTP test",
        text: "This is a test email from GoEducate Talent. SMTP configuration is working."
      });
    }

    return res.json({
      ok: true,
      emailConfigured: isInviteEmailConfigured(),
      sentTo: to || null,
      transport
    });
  } catch (err) {
    // NOTE: Return 200 so PowerShell (WindowsPowerShell 5.1) prints the body without throwing.
    const e = err as any;
    return res.json({
      ok: false,
      emailConfigured: isInviteEmailConfigured(),
      sentTo: to || null,
      transport,
      error: {
        message: e?.message ?? "SMTP error",
        name: e?.name,
        code: e?.code,
        command: e?.command,
        responseCode: e?.responseCode,
        response: e?.response,
        rejected: e?.rejected,
        rejectedErrors: e?.rejectedErrors
      }
    });
  }
});

