import { Router } from "express";

import { RegisterSchema, ROLE } from "@goeducate/shared";

import { signAccessToken } from "../auth/jwt.js";
import { hashPassword } from "../auth/password.js";
import { getEnv } from "../env.js";
import { ApiError } from "../http/errors.js";
import { zodToBadRequest } from "../http/zod.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { EvaluatorInviteModel, generateInviteToken, hashInviteToken } from "../models/EvaluatorInvite.js";
import { COACH_SUBSCRIPTION_STATUS, UserModel } from "../models/User.js";

export const adminRouter = Router();

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

  const { email, password, role } = parsed.data;
  if (role !== ROLE.EVALUATOR && role !== ROLE.ADMIN) {
    return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Admin can only create evaluator/admin users" }));
  }

  try {
    const existing = await UserModel.findOne({ email }).lean();
    if (existing) {
      return next(new ApiError({ status: 409, code: "EMAIL_TAKEN", message: "Email already registered" }));
    }

    const passwordHash = await hashPassword(password);
    const user = await UserModel.create({ email, passwordHash, role });
    return res.status(201).json({ user: { id: String(user._id), email: user.email, role: user.role } });
  } catch (err) {
    return next(err);
  }
});

// Admin-only: generate an evaluator invite code (one-time use, expires).
adminRouter.post("/admin/evaluator-invites", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
  const email = String((req.body as { email?: unknown }).email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Valid email is required" }));
  }

  try {
    const existingUser = await UserModel.findOne({ email }).lean();
    if (existingUser) {
      return next(new ApiError({ status: 409, code: "EMAIL_TAKEN", message: "Email already registered" }));
    }

    const token = generateInviteToken();
    const tokenHash = hashInviteToken(token);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

    await EvaluatorInviteModel.create({
      email,
      role: ROLE.EVALUATOR,
      tokenHash,
      createdByUserId: req.user!.id as any,
      expiresAt
    });

    return res.status(201).json({
      invite: {
        email,
        role: ROLE.EVALUATOR,
        token,
        expiresAt: expiresAt.toISOString()
      }
    });
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
    const user = await UserModel.findById(req.params.userId);
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



