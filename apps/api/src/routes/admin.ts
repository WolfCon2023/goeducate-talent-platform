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
import { isInviteEmailConfigured, sendInviteEmail } from "../email/invites.js";

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



