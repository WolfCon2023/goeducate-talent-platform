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
import { normalizeUsStateToCode, US_STATES } from "../util/usStates.js";
import { logAdminAction } from "../audit/adminAudit.js";
export const adminRouter = Router();
async function createInvite(opts) {
    const email = opts.email.trim().toLowerCase();
    const role = opts.role.trim().toLowerCase();
    const allowed = [ROLE.PLAYER, ROLE.COACH, ROLE.EVALUATOR, ROLE.ADMIN];
    if (!email || !email.includes("@")) {
        throw new ApiError({ status: 400, code: "BAD_REQUEST", message: "Valid email is required" });
    }
    if (!allowed.includes(role)) {
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
        role: role,
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
    if (!parsed.success)
        return next(zodToBadRequest(parsed.error.flatten()));
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
    }
    catch (err) {
        return next(err);
    }
});
// Admin-only: create internal users (evaluator/admin). Players/coaches self-register.
adminRouter.post("/admin/users", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success)
        return next(zodToBadRequest(parsed.error.flatten()));
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
            actorUserId: String(req.user.id),
            action: "admin.users.create",
            targetType: "User",
            targetId: String(user._id),
            meta: { email: user.email, role: user.role }
        });
        return res.status(201).json({ user: { id: String(user._id), email: user.email, role: user.role } });
    }
    catch (err) {
        return next(err);
    }
});
// Admin-only: high-level dashboard stats (submissions + evaluations + rating buckets)
adminRouter.get("/admin/stats", requireAuth, requireRole([ROLE.ADMIN]), async (_req, res, next) => {
    try {
        const submissionCountsRaw = await FilmSubmissionModel.aggregate([
            { $group: { _id: "$status", count: { $sum: 1 } } }
        ]);
        const submissionCounts = Object.fromEntries(submissionCountsRaw.map((r) => [String(r._id), Number(r.count)]));
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
                byPosition: submissionsByPosition
            },
            evaluations: {
                total: evaluationsTotal,
                byGrade: evaluationsByGrade,
                bySportPosition: evaluationsBySportPosition,
                evaluators: evaluatorPerformance
            }
        });
    }
    catch (err) {
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
        const counts = new Map();
        let unknown = 0;
        for (const r of raw) {
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
    }
    catch (err) {
        return next(err);
    }
});
// Admin-only: notifications "queue" (latest notifications across all users)
adminRouter.get("/admin/notifications", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
    try {
        const unreadOnly = String(req.query.unreadOnly ?? "").trim() === "1";
        const limitRaw = Number(req.query.limit ?? 50);
        const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 50;
        const match = {};
        if (unreadOnly)
            match.readAt = { $exists: false };
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
    }
    catch (err) {
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
    }
    catch (err) {
        return next(err);
    }
});
// Admin-only: bulk delete notifications (all or unread-only)
adminRouter.delete("/admin/notifications", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
    try {
        const unreadOnly = String(req.query.unreadOnly ?? "").trim() === "1";
        const query = {};
        if (unreadOnly)
            query.readAt = { $exists: false };
        const result = await NotificationModel.deleteMany(query);
        return res.json({ deletedCount: result.deletedCount ?? 0 });
    }
    catch (err) {
        return next(err);
    }
});
// Admin-only: bulk mark notifications as read (all or unread-only)
adminRouter.patch("/admin/notifications/read", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
    try {
        const unreadOnly = String(req.query.unreadOnly ?? "").trim() === "1";
        const query = {};
        if (unreadOnly)
            query.readAt = { $exists: false };
        const result = await NotificationModel.updateMany(query, { $set: { readAt: new Date() } });
        return res.json({ modifiedCount: result.modifiedCount ?? 0 });
    }
    catch (err) {
        return next(err);
    }
});
// Admin-only: generate an invite code (one-time use, expires) for any role.
adminRouter.post("/admin/invites", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
    try {
        const email = String(req.body.email ?? "");
        const role = String(req.body.role ?? "");
        const invite = await createInvite({ email, role, createdByUserId: req.user.id });
        void logAdminAction({
            req,
            actorUserId: String(req.user.id),
            action: "admin.invites.create",
            targetType: "EvaluatorInvite",
            targetId: invite.email,
            meta: { email: invite.email, role: invite.role, expiresAt: invite.expiresAt }
        });
        // If email is configured, send the invite email.
        const emailConfigured = isInviteEmailConfigured();
        let emailSent = false;
        let emailError;
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
            }
            catch (err) {
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
    }
    catch (err) {
        return next(err);
    }
});
// Backwards compatible route name (evaluator only)
adminRouter.post("/admin/evaluator-invites", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
    try {
        const email = String(req.body.email ?? "");
        const invite = await createInvite({ email, role: ROLE.EVALUATOR, createdByUserId: req.user.id });
        const emailConfigured = isInviteEmailConfigured();
        let emailSent = false;
        let emailError;
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
            }
            catch (err) {
                emailSent = false;
                emailError = err instanceof Error ? err.message : "Failed to send invite email";
            }
        }
        return res.status(201).json({ invite, emailSent, ...(emailError ? { emailError } : {}) });
    }
    catch (err) {
        return next(err);
    }
});
// Admin-only: list users (basic search + filter)
adminRouter.get("/admin/users", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
    try {
        const role = String(req.query.role ?? "").trim().toLowerCase();
        const q = String(req.query.q ?? "").trim().toLowerCase();
        const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 100)));
        const filter = {};
        if (role && [ROLE.PLAYER, ROLE.COACH, ROLE.EVALUATOR, ROLE.ADMIN].includes(role))
            filter.role = role;
        if (q)
            filter.email = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
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
    }
    catch (err) {
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
        if (String(_id) === String(req.user.id)) {
            return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "You cannot delete your own account" }));
        }
        const user = await UserModel.findById(_id);
        if (!user)
            return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "User not found" }));
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
            actorUserId: String(req.user.id),
            action: "admin.users.delete",
            targetType: "User",
            targetId: String(_id),
            meta: { email: auditEmail, role: auditRole }
        });
        return res.status(204).send();
    }
    catch (err) {
        return next(err);
    }
});
// Admin-only: verify SMTP configuration and (optionally) send a test email.
adminRouter.post("/admin/email/test", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
    const env = getEnv();
    const to = String(req.body.to ?? "").trim();
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
    }
    catch (err) {
        // NOTE: Return 200 so PowerShell (WindowsPowerShell 5.1) prints the body without throwing.
        const e = err;
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
//# sourceMappingURL=admin.js.map