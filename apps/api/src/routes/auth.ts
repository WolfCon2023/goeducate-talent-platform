import { Router } from "express";
import crypto from "node:crypto";

import { LoginSchema, RegisterSchema, ROLE } from "@goeducate/shared";

import { hashPassword, verifyPassword } from "../auth/password.js";
import { signAccessToken } from "../auth/jwt.js";
import { getEnv } from "../env.js";
import { ApiError } from "../http/errors.js";
import { zodToBadRequest } from "../http/zod.js";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { EvaluatorInviteModel, hashInviteToken } from "../models/EvaluatorInvite.js";
import { PlayerProfileModel } from "../models/PlayerProfile.js";
import { UserModel } from "../models/User.js";
import { isAuthRecoveryEmailConfigured, sendPasswordResetEmail, sendUsernameReminderEmail } from "../email/authRecovery.js";
import { z } from "zod";
import bcrypt from "bcryptjs";

export const authRouter = Router();

const authLoginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 25, keyPrefix: "auth_login" });
const authRegisterLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, keyPrefix: "auth_register" });
const authRecoveryLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 8, keyPrefix: "auth_recovery" });
const authResetLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyPrefix: "auth_reset" });
const authSecQLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 12, keyPrefix: "auth_secq" });

function normalizeLoginId(input: string) {
  return String(input ?? "").trim().toLowerCase();
}

function generateResetToken() {
  // 32 bytes => 256-bit token
  return crypto.randomBytes(32).toString("base64url");
}

function sha256Hex(token: string) {
  return crypto.createHash("sha256").update(String(token ?? "")).digest("hex");
}

function normalizeAnswer(input: string) {
  return String(input ?? "").trim().toLowerCase();
}

const SecurityQuestionSchema = z.object({
  questionId: z.string().min(1).max(80),
  question: z.string().min(3).max(200),
  answer: z.string().min(1).max(200)
});

const SetRecoveryQuestionsSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  questions: z.array(SecurityQuestionSchema).min(3).max(3)
});

const RecoveryVerifySchema = z.object({
  login: z.string().min(2).max(254),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1).max(80),
        answer: z.string().min(1).max(200)
      })
    )
    .min(3)
    .max(3)
});

// Authenticated: get your configured recovery questions (no answers)
authRouter.get("/auth/recovery-questions/me", requireAuth, async (req, res, next) => {
  try {
    const user = await UserModel.findById(req.user!.id).lean();
    if (!user) return next(new ApiError({ status: 401, code: "UNAUTHORIZED", message: "Not authenticated" }));
    const qs = ((user as any).recoveryQuestions ?? []) as Array<{ questionId: string; question: string }>;
    return res.json({
      configured: qs.length > 0,
      questions: qs.map((q) => ({ questionId: q.questionId, question: q.question }))
    });
  } catch (err) {
    return next(err);
  }
});

// Authenticated: set/replace your recovery questions (requires current password)
authRouter.put("/auth/recovery-questions/me", requireAuth, authSecQLimiter, async (req, res, next) => {
  const parsed = SetRecoveryQuestionsSchema.safeParse(req.body);
  if (!parsed.success) return next(zodToBadRequest(parsed.error.flatten()));
  try {
    const user = await UserModel.findById(req.user!.id);
    if (!user) return next(new ApiError({ status: 401, code: "UNAUTHORIZED", message: "Not authenticated" }));

    const ok = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
    if (!ok) return next(new ApiError({ status: 401, code: "INVALID_CREDENTIALS", message: "Invalid credentials" }));

    const ids = parsed.data.questions.map((q) => q.questionId);
    if (new Set(ids).size !== ids.length) {
      return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Questions must be unique" }));
    }

    const nextQs = await Promise.all(
      parsed.data.questions.map(async (q) => ({
        questionId: q.questionId,
        question: q.question,
        answerHash: await bcrypt.hash(normalizeAnswer(q.answer), 12)
      }))
    );

    (user as any).recoveryQuestions = nextQs;
    await user.save();
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

async function constantTimeDummyCompare() {
  // Do a few compares to reduce timing signals when user doesn't exist.
  const dummyHash = await bcrypt.hash("dummy", 10);
  await bcrypt.compare("x", dummyHash);
  await bcrypt.compare("y", dummyHash);
  await bcrypt.compare("z", dummyHash);
}

async function verifySecurityAnswers(user: any, answers: Array<{ questionId: string; answer: string }>) {
  const stored = ((user as any).recoveryQuestions ?? []) as Array<{ questionId: string; answerHash: string }>;
  if (!stored.length || stored.length !== answers.length) return false;

  const map = new Map(stored.map((q) => [q.questionId, q.answerHash]));
  for (const a of answers) {
    const hash = map.get(a.questionId);
    if (!hash) return false;
    const ok = await bcrypt.compare(normalizeAnswer(a.answer), hash);
    if (!ok) return false;
  }
  return true;
}

// Public: recover username using security questions (generic ok, no enumeration)
authRouter.post("/auth/recover/username", authSecQLimiter, async (req, res, next) => {
  const parsed = RecoveryVerifySchema.safeParse(req.body);
  if (!parsed.success) return res.json({ ok: true });
  try {
    const login = normalizeLoginId(parsed.data.login);
    const user = await UserModel.findOne({ $or: [{ email: login }, { username: login }] });
    if (!user || user.isActive === false) {
      await constantTimeDummyCompare();
      return res.json({ ok: true });
    }

    const ok = await verifySecurityAnswers(user, parsed.data.answers);
    if (ok && isAuthRecoveryEmailConfigured()) {
      const username = String((user as any).username ?? user.email);
      void sendUsernameReminderEmail({ to: user.email, username, loginEmail: user.email }).catch(() => {});
    }
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

// Public: recover password using security questions (generic ok, no enumeration)
authRouter.post("/auth/recover/password", authSecQLimiter, async (req, res, next) => {
  const parsed = RecoveryVerifySchema.safeParse(req.body);
  if (!parsed.success) return res.json({ ok: true });
  try {
    const login = normalizeLoginId(parsed.data.login);
    const user = await UserModel.findOne({ $or: [{ email: login }, { username: login }] });
    if (!user || user.isActive === false) {
      await constantTimeDummyCompare();
      return res.json({ ok: true });
    }

    const ok = await verifySecurityAnswers(user, parsed.data.answers);
    if (ok) {
      const token = generateResetToken();
      const tokenHash = sha256Hex(token);
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60);
      user.passwordResetTokenHash = tokenHash;
      user.passwordResetExpiresAt = expiresAt;
      user.passwordResetUsedAt = undefined;
      user.passwordResetRequestedAt = new Date();
      await user.save();

      if (isAuthRecoveryEmailConfigured()) {
        void sendPasswordResetEmail({ to: user.email, resetToken: token }).catch(() => {});
      }
    }
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

authRouter.post("/auth/register", authRegisterLimiter, async (req, res, next) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) return next(zodToBadRequest(parsed.error.flatten()));

  const { email, password, role, firstName, lastName } = parsed.data;
  if (role !== ROLE.PLAYER && role !== ROLE.COACH) {
    return next(new ApiError({ status: 403, code: "FORBIDDEN", message: "Role is not available for public registration" }));
  }
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
      ...(role === ROLE.COACH ? { firstName, lastName, subscriptionStatus: "inactive" } : {})
    });

    const env = getEnv();
    const token = signAccessToken({ sub: String(user._id), role: user.role }, env.JWT_SECRET);

    return res.status(201).json({
      token,
      user: { id: String(user._id), email: user.email, role: user.role }
    });
  } catch (err) {
    return next(err);
  }
});

authRouter.post("/auth/login", authLoginLimiter, async (req, res, next) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return next(zodToBadRequest(parsed.error.flatten()));

  const login = normalizeLoginId((parsed.data as any).login ?? (parsed.data as any).email);
  const { password } = parsed.data;

  try {
    const user = await UserModel.findOne({
      $or: [{ email: login }, { username: login }]
    });
    if (!user) return next(new ApiError({ status: 401, code: "INVALID_CREDENTIALS", message: "Invalid credentials" }));
    if (user.isActive === false) return next(new ApiError({ status: 403, code: "DISABLED", message: "Account is disabled" }));

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return next(new ApiError({ status: 401, code: "INVALID_CREDENTIALS", message: "Invalid credentials" }));

    const env = getEnv();
    const token = signAccessToken({ sub: String(user._id), role: user.role }, env.JWT_SECRET);

    return res.json({
      token,
      user: { id: String(user._id), email: user.email, role: user.role }
    });
  } catch (err) {
    return next(err);
  }
});

// Public: forgot username (generic success response; does not reveal if account exists)
authRouter.post("/auth/forgot-username", authRecoveryLimiter, async (req, res, next) => {
  const email = normalizeLoginId((req.body as any)?.email);
  if (!email || !email.includes("@")) {
    return res.json({ ok: true });
  }
  try {
    const user = await UserModel.findOne({ email }).lean();
    if (user && user.isActive !== false && isAuthRecoveryEmailConfigured()) {
      const username = String((user as any).username ?? user.email);
      void sendUsernameReminderEmail({ to: user.email, username, loginEmail: user.email }).catch(() => {});
    }
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

// Public: forgot password (generic success response; does not reveal if account exists)
authRouter.post("/auth/forgot-password", authRecoveryLimiter, async (req, res, next) => {
  const login = normalizeLoginId((req.body as any)?.login ?? (req.body as any)?.email ?? (req.body as any)?.username);
  if (!login) return res.json({ ok: true });
  try {
    const user = await UserModel.findOne({ $or: [{ email: login }, { username: login }] });
    if (user && user.isActive !== false) {
      const token = generateResetToken();
      const tokenHash = sha256Hex(token);
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 60 minutes
      user.passwordResetTokenHash = tokenHash;
      user.passwordResetExpiresAt = expiresAt;
      user.passwordResetUsedAt = undefined;
      user.passwordResetRequestedAt = new Date();
      await user.save();

      if (isAuthRecoveryEmailConfigured()) {
        void sendPasswordResetEmail({ to: user.email, resetToken: token }).catch(() => {});
      }
    }
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

// Public: validate reset token (safe; token itself is secret)
authRouter.get("/auth/reset-password/validate", authResetLimiter, async (req, res, next) => {
  const token = String((req.query as any)?.token ?? "").trim();
  if (!token) return res.json({ valid: false });
  try {
    const tokenHash = sha256Hex(token);
    const user = await UserModel.findOne({ passwordResetTokenHash: tokenHash }).lean();
    const valid =
      !!user &&
      (user as any).isActive !== false &&
      !(user as any).passwordResetUsedAt &&
      (user as any).passwordResetExpiresAt &&
      new Date((user as any).passwordResetExpiresAt).getTime() > Date.now();
    return res.json({ valid });
  } catch (err) {
    return next(err);
  }
});

// Public: reset password (consumes token)
authRouter.post("/auth/reset-password", authResetLimiter, async (req, res, next) => {
  const token = String((req.body as any)?.token ?? "").trim();
  const newPassword = String((req.body as any)?.password ?? "");
  if (!token || token.length < 20) {
    return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Reset token is required" }));
  }
  if (!newPassword || newPassword.length < 8) {
    return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Password must be at least 8 characters" }));
  }
  try {
    const tokenHash = sha256Hex(token);
    const user = await UserModel.findOne({ passwordResetTokenHash: tokenHash });
    if (
      !user ||
      user.isActive === false ||
      user.passwordResetUsedAt ||
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt.getTime() < Date.now()
    ) {
      return next(new ApiError({ status: 400, code: "INVALID_TOKEN", message: "Invalid or expired reset token" }));
    }

    user.passwordHash = await hashPassword(newPassword);
    user.passwordResetUsedAt = new Date();
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiresAt = undefined;
    await user.save();
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

// Authenticated: change password
authRouter.post("/auth/change-password", requireAuth, authResetLimiter, async (req, res, next) => {
  const currentPassword = String((req.body as any)?.currentPassword ?? "");
  const newPassword = String((req.body as any)?.newPassword ?? "");
  if (!currentPassword) return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Current password is required" }));
  if (!newPassword || newPassword.length < 8) {
    return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Password must be at least 8 characters" }));
  }
  try {
    const user = await UserModel.findById(req.user!.id);
    if (!user) return next(new ApiError({ status: 401, code: "UNAUTHORIZED", message: "Not authenticated" }));
    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) return next(new ApiError({ status: 401, code: "INVALID_CREDENTIALS", message: "Invalid credentials" }));
    user.passwordHash = await hashPassword(newPassword);
    await user.save();
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

authRouter.get("/auth/me", requireAuth, async (req, res, next) => {
  try {
    const user = await UserModel.findById(req.user!.id).lean();
    if (!user) return next(new ApiError({ status: 401, code: "UNAUTHORIZED", message: "Not authenticated" }));

    let displayName: string = user.email;
    if (user.role === ROLE.PLAYER) {
      const profile = await PlayerProfileModel.findOne({ userId: user._id }).lean();
      if (profile?.firstName && profile?.lastName) {
        displayName = `${profile.firstName} ${profile.lastName}`;
      }
    }
    if (user.role === ROLE.COACH && user.firstName && user.lastName) {
      displayName = `${user.firstName} ${user.lastName}`;
    }

    return res.json({
      user: {
        id: String(user._id),
        email: user.email,
        role: user.role,
        displayName,
        profilePhotoUrl: user.profilePhotoPath ? `/uploads/${user.profilePhotoPath}` : undefined,
        subscriptionStatus: user.role === ROLE.COACH ? (user.subscriptionStatus ?? "inactive") : undefined
      }
    });
  } catch (err) {
    return next(err);
  }
});

// Public: accept evaluator invite token and create evaluator account.
authRouter.post("/auth/accept-invite", async (req, res, next) => {
  const token = String((req.body as { token?: unknown }).token ?? "").trim();
  const firstName = String((req.body as { firstName?: unknown }).firstName ?? "").trim();
  const lastName = String((req.body as { lastName?: unknown }).lastName ?? "").trim();
  const password = String((req.body as { password?: unknown }).password ?? "");

  if (!token || token.length < 20) {
    return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invite token is required" }));
  }
  if (!password || password.length < 8) {
    return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Password must be at least 8 characters" }));
  }

  try {
    const tokenHash = hashInviteToken(token);
    const invite = await EvaluatorInviteModel.findOne({ tokenHash });
    if (!invite) return next(new ApiError({ status: 400, code: "INVALID_INVITE", message: "Invalid invite token" }));
    if (invite.usedAt) return next(new ApiError({ status: 409, code: "INVITE_USED", message: "Invite already used" }));
    if (invite.expiresAt.getTime() < Date.now()) {
      return next(new ApiError({ status: 410, code: "INVITE_EXPIRED", message: "Invite expired" }));
    }

    const email = invite.email;
    const existing = await UserModel.findOne({ email }).lean();
    if (existing) return next(new ApiError({ status: 409, code: "EMAIL_TAKEN", message: "Email already registered" }));

    // Name requirements:
    // - coach/evaluator/admin must provide first + last name
    // - player may omit (they can fill athlete profile later)
    if (invite.role === ROLE.COACH || invite.role === ROLE.EVALUATOR || invite.role === ROLE.ADMIN) {
      if (!firstName || !lastName) {
        return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "First and last name are required" }));
      }
    }

    const passwordHash = await hashPassword(password);
    const user = await UserModel.create({
      email,
      passwordHash,
      role: invite.role,
      ...(firstName ? { firstName } : {}),
      ...(lastName ? { lastName } : {}),
      ...(invite.role === ROLE.COACH ? { subscriptionStatus: "inactive" } : {})
    });

    invite.usedAt = new Date();
    await invite.save();

    const env = getEnv();
    const jwt = signAccessToken({ sub: String(user._id), role: user.role }, env.JWT_SECRET);

    return res.status(201).json({
      token: jwt,
      user: { id: String(user._id), email: user.email, role: user.role }
    });
  } catch (err) {
    return next(err);
  }
});


