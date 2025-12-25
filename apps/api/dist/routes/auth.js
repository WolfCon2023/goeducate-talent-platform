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
export const authRouter = Router();
const authLoginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 25, keyPrefix: "auth_login" });
const authRegisterLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, keyPrefix: "auth_register" });
const authRecoveryLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 8, keyPrefix: "auth_recovery" });
const authResetLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyPrefix: "auth_reset" });
function normalizeLoginId(input) {
    return String(input ?? "").trim().toLowerCase();
}
function generateResetToken() {
    // 32 bytes => 256-bit token
    return crypto.randomBytes(32).toString("base64url");
}
function sha256Hex(token) {
    return crypto.createHash("sha256").update(String(token ?? "")).digest("hex");
}
authRouter.post("/auth/register", authRegisterLimiter, async (req, res, next) => {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success)
        return next(zodToBadRequest(parsed.error.flatten()));
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
    }
    catch (err) {
        return next(err);
    }
});
authRouter.post("/auth/login", authLoginLimiter, async (req, res, next) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success)
        return next(zodToBadRequest(parsed.error.flatten()));
    const login = normalizeLoginId(parsed.data.login ?? parsed.data.email);
    const { password } = parsed.data;
    try {
        const user = await UserModel.findOne({
            $or: [{ email: login }, { username: login }]
        });
        if (!user)
            return next(new ApiError({ status: 401, code: "INVALID_CREDENTIALS", message: "Invalid credentials" }));
        if (user.isActive === false)
            return next(new ApiError({ status: 403, code: "DISABLED", message: "Account is disabled" }));
        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok)
            return next(new ApiError({ status: 401, code: "INVALID_CREDENTIALS", message: "Invalid credentials" }));
        const env = getEnv();
        const token = signAccessToken({ sub: String(user._id), role: user.role }, env.JWT_SECRET);
        return res.json({
            token,
            user: { id: String(user._id), email: user.email, role: user.role }
        });
    }
    catch (err) {
        return next(err);
    }
});
// Public: forgot username (generic success response; does not reveal if account exists)
authRouter.post("/auth/forgot-username", authRecoveryLimiter, async (req, res, next) => {
    const email = normalizeLoginId(req.body?.email);
    if (!email || !email.includes("@")) {
        return res.json({ ok: true });
    }
    try {
        const user = await UserModel.findOne({ email }).lean();
        if (user && user.isActive !== false && isAuthRecoveryEmailConfigured()) {
            const username = String(user.username ?? user.email);
            void sendUsernameReminderEmail({ to: user.email, username, loginEmail: user.email }).catch(() => { });
        }
        return res.json({ ok: true });
    }
    catch (err) {
        return next(err);
    }
});
// Public: forgot password (generic success response; does not reveal if account exists)
authRouter.post("/auth/forgot-password", authRecoveryLimiter, async (req, res, next) => {
    const login = normalizeLoginId(req.body?.login ?? req.body?.email ?? req.body?.username);
    if (!login)
        return res.json({ ok: true });
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
                void sendPasswordResetEmail({ to: user.email, resetToken: token }).catch(() => { });
            }
        }
        return res.json({ ok: true });
    }
    catch (err) {
        return next(err);
    }
});
// Public: validate reset token (safe; token itself is secret)
authRouter.get("/auth/reset-password/validate", authResetLimiter, async (req, res, next) => {
    const token = String(req.query?.token ?? "").trim();
    if (!token)
        return res.json({ valid: false });
    try {
        const tokenHash = sha256Hex(token);
        const user = await UserModel.findOne({ passwordResetTokenHash: tokenHash }).lean();
        const valid = !!user &&
            user.isActive !== false &&
            !user.passwordResetUsedAt &&
            user.passwordResetExpiresAt &&
            new Date(user.passwordResetExpiresAt).getTime() > Date.now();
        return res.json({ valid });
    }
    catch (err) {
        return next(err);
    }
});
// Public: reset password (consumes token)
authRouter.post("/auth/reset-password", authResetLimiter, async (req, res, next) => {
    const token = String(req.body?.token ?? "").trim();
    const newPassword = String(req.body?.password ?? "");
    if (!token || token.length < 20) {
        return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Reset token is required" }));
    }
    if (!newPassword || newPassword.length < 8) {
        return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Password must be at least 8 characters" }));
    }
    try {
        const tokenHash = sha256Hex(token);
        const user = await UserModel.findOne({ passwordResetTokenHash: tokenHash });
        if (!user ||
            user.isActive === false ||
            user.passwordResetUsedAt ||
            !user.passwordResetExpiresAt ||
            user.passwordResetExpiresAt.getTime() < Date.now()) {
            return next(new ApiError({ status: 400, code: "INVALID_TOKEN", message: "Invalid or expired reset token" }));
        }
        user.passwordHash = await hashPassword(newPassword);
        user.passwordResetUsedAt = new Date();
        user.passwordResetTokenHash = undefined;
        user.passwordResetExpiresAt = undefined;
        await user.save();
        return res.json({ ok: true });
    }
    catch (err) {
        return next(err);
    }
});
// Authenticated: change password
authRouter.post("/auth/change-password", requireAuth, authResetLimiter, async (req, res, next) => {
    const currentPassword = String(req.body?.currentPassword ?? "");
    const newPassword = String(req.body?.newPassword ?? "");
    if (!currentPassword)
        return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Current password is required" }));
    if (!newPassword || newPassword.length < 8) {
        return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Password must be at least 8 characters" }));
    }
    try {
        const user = await UserModel.findById(req.user.id);
        if (!user)
            return next(new ApiError({ status: 401, code: "UNAUTHORIZED", message: "Not authenticated" }));
        const ok = await verifyPassword(currentPassword, user.passwordHash);
        if (!ok)
            return next(new ApiError({ status: 401, code: "INVALID_CREDENTIALS", message: "Invalid credentials" }));
        user.passwordHash = await hashPassword(newPassword);
        await user.save();
        return res.json({ ok: true });
    }
    catch (err) {
        return next(err);
    }
});
authRouter.get("/auth/me", requireAuth, async (req, res, next) => {
    try {
        const user = await UserModel.findById(req.user.id).lean();
        if (!user)
            return next(new ApiError({ status: 401, code: "UNAUTHORIZED", message: "Not authenticated" }));
        let displayName = user.email;
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
    }
    catch (err) {
        return next(err);
    }
});
// Public: accept evaluator invite token and create evaluator account.
authRouter.post("/auth/accept-invite", async (req, res, next) => {
    const token = String(req.body.token ?? "").trim();
    const firstName = String(req.body.firstName ?? "").trim();
    const lastName = String(req.body.lastName ?? "").trim();
    const password = String(req.body.password ?? "");
    if (!token || token.length < 20) {
        return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invite token is required" }));
    }
    if (!password || password.length < 8) {
        return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Password must be at least 8 characters" }));
    }
    try {
        const tokenHash = hashInviteToken(token);
        const invite = await EvaluatorInviteModel.findOne({ tokenHash });
        if (!invite)
            return next(new ApiError({ status: 400, code: "INVALID_INVITE", message: "Invalid invite token" }));
        if (invite.usedAt)
            return next(new ApiError({ status: 409, code: "INVITE_USED", message: "Invite already used" }));
        if (invite.expiresAt.getTime() < Date.now()) {
            return next(new ApiError({ status: 410, code: "INVITE_EXPIRED", message: "Invite expired" }));
        }
        const email = invite.email;
        const existing = await UserModel.findOne({ email }).lean();
        if (existing)
            return next(new ApiError({ status: 409, code: "EMAIL_TAKEN", message: "Email already registered" }));
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
    }
    catch (err) {
        return next(err);
    }
});
//# sourceMappingURL=auth.js.map