import { Router } from "express";
import mongoose from "mongoose";

import { RegisterSchema, ROLE } from "@goeducate/shared";

import { signAccessToken } from "../auth/jwt.js";
import { hashPassword } from "../auth/password.js";
import { getEnv } from "../env.js";
import { ApiError } from "../http/errors.js";
import { zodToBadRequest } from "../http/zod.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { EvaluatorInviteModel, generateInviteToken, hashInviteToken } from "../models/EvaluatorInvite.js";
import { COACH_SUBSCRIPTION_STATUS, UserModel } from "../models/User.js";
import { PlayerProfileModel } from "../models/PlayerProfile.js";
import { FilmSubmissionModel } from "../models/FilmSubmission.js";
import { EvaluationReportModel } from "../models/EvaluationReport.js";
import { WatchlistModel } from "../models/Watchlist.js";
import { NotificationModel } from "../models/Notification.js";
import { isInviteEmailConfigured, sendInviteEmail } from "../email/invites.js";
import nodemailer from "nodemailer";

export const adminRouter = Router();

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

    return res.json({
      submissions: {
        total: submissionsTotal,
        byStatus: submissionCounts
      },
      evaluations: {
        total: evaluationsTotal,
        byGrade: evaluationsByGrade
      }
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

    const match: any = {};
    if (unreadOnly) match.readAt = { $exists: false };

    const results = await NotificationModel.aggregate([
      { $match: match },
      { $sort: { createdAt: -1 } },
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

    return res.json({ results });
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
    if (q) filter.email = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };

    const results = await UserModel.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
    return res.json({
      results: results.map((u) => ({
        id: String(u._id),
        email: u.email,
        role: u.role,
        firstName: u.firstName,
        lastName: u.lastName,
        subscriptionStatus: u.subscriptionStatus,
        createdAt: u.createdAt?.toISOString?.() ?? undefined
      }))
    });
  } catch (err) {
    return next(err);
  }
});

// Admin-only: delete a user (with basic cascade cleanup). Prevent deleting yourself or the last admin.
adminRouter.delete("/admin/users/:id", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
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

// Admin-only: set a coach subscription status (scaffold for Stripe later)
adminRouter.patch("/admin/coaches/:userId/subscription", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
  const status = String((req.body as { status?: unknown }).status ?? "").trim();
  if (status !== COACH_SUBSCRIPTION_STATUS.ACTIVE && status !== COACH_SUBSCRIPTION_STATUS.INACTIVE) {
    return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid status" }));
  }
  try {
    const key = String(req.params.userId ?? "").trim();
    const user = mongoose.isValidObjectId(key)
      ? await UserModel.findById(key)
      : await UserModel.findOne({ email: key.toLowerCase() });
    if (!user) return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "User not found" }));
    if (user.role !== ROLE.COACH) {
      return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "User is not a coach" }));
    }
    user.subscriptionStatus = status as any;
    await user.save();
    return res.json({ user: { id: String(user._id), email: user.email, role: user.role, subscriptionStatus: user.subscriptionStatus } });
  } catch (err) {
    return next(err);
  }
});



