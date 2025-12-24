import { Router } from "express";
import mongoose from "mongoose";
import { FILM_SUBMISSION_STATUS, RegisterSchema, ROLE } from "@goeducate/shared";
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
import { EvaluationFormModel } from "../models/EvaluationForm.js";
import { WatchlistModel } from "../models/Watchlist.js";
import { NotificationModel } from "../models/Notification.js";
import { isInviteEmailConfigured, sendInviteEmail } from "../email/invites.js";
import nodemailer from "nodemailer";
import { normalizeUsStateToCode, US_STATES } from "../util/usStates.js";
import { logAdminAction } from "../audit/adminAudit.js";
import { EmailAuditLogModel } from "../models/EmailAuditLog.js";
import { createTransporterOrThrow, isEmailConfigured } from "../email/mailer.js";
import { sendMailWithAudit } from "../email/audit.js";
import { EMAIL_AUDIT_TYPE } from "../models/EmailAuditLog.js";
import { AdminAuditLogModel } from "../models/AdminAuditLog.js";
import { AuditLogModel } from "../models/AuditLog.js";
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
        const match = {};
        if (status && Object.values(FILM_SUBMISSION_STATUS).includes(status)) {
            match.status = status;
        }
        if (hasAssigned === "1")
            match.assignedEvaluatorUserId = { $exists: true, $ne: null };
        if (hasAssigned === "0")
            match.$or = [{ assignedEvaluatorUserId: { $exists: false } }, { assignedEvaluatorUserId: null }];
        const qRegex = q ? new RegExp(escapeRegex(q), "i") : null;
        const base = [
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
        // Filter by whether an evaluation report exists.
        if (hasEval === "1")
            base.push({ $match: { eval: { $ne: null } } });
        if (hasEval === "0")
            base.push({ $match: { eval: null } });
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
        const results = (rows?.[0]?.results ?? []).map((r) => ({
            ...r,
            _id: String(r._id),
            userId: String(r.userId)
        }));
        return res.json({ total, results, skip, limit });
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
function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function isProjectionTraitKey(key) {
    return String(key ?? "").toLowerCase().includes("projection");
}
function computeRubricBreakdown(opts) {
    const rubric = opts.rubric;
    const form = opts.form;
    const categoriesDef = Array.isArray(form?.categories) ? form.categories : [];
    const categoriesResp = Array.isArray(rubric?.categories) ? rubric.categories : [];
    const byKey = new Map(categoriesResp.map((c) => [String(c.key), c]));
    const breakdown = categoriesDef.map((cDef) => {
        const cKey = String(cDef.key);
        const cResp = byKey.get(cKey);
        const traitsDef = Array.isArray(cDef?.traits) ? cDef.traits : [];
        const traitsResp = Array.isArray(cResp?.traits) ? cResp.traits : [];
        const traitsByKey = new Map(traitsResp.map((t) => [String(t.key), t]));
        const traitScores = [];
        for (const tDef of traitsDef) {
            const tKey = String(tDef?.key);
            if (!tKey)
                continue;
            if (isProjectionTraitKey(tKey))
                continue;
            const tResp = traitsByKey.get(tKey);
            if (!tResp)
                continue;
            if (tDef.type === "select") {
                const optVal = String(tResp.valueOption ?? "");
                const options = Array.isArray(tDef.options) ? tDef.options : [];
                const opt = options.find((o) => String(o.value) === optVal);
                const s = Number(opt?.score);
                if (Number.isFinite(s))
                    traitScores.push({ key: tKey, score: s });
            }
            else {
                const n = Number(tResp.valueNumber);
                if (Number.isFinite(n))
                    traitScores.push({ key: tKey, score: n });
            }
        }
        const scores = traitScores.map((t) => t.score).filter((n) => typeof n === "number" && Number.isFinite(n));
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
        const limitRaw = Number(req.query.limit ?? 200);
        const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 200;
        const or = [{ state: { $regex: `^${escapeRegex(code)}$`, $options: "i" } }];
        if (stateName && stateName !== code) {
            or.push({ state: { $regex: `^${escapeRegex(stateName)}$`, $options: "i" } });
        }
        const match = { $or: or };
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
            players
        });
    }
    catch (err) {
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
    }
    catch (err) {
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
        if (!film)
            return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Film submission not found" }));
        const report = await EvaluationReportModel.findOne({ filmSubmissionId }).lean();
        let evaluator = null;
        let form = null;
        let rubricBreakdown = null;
        if (report) {
            evaluator = await UserModel.findById(report.evaluatorUserId)
                .select({ _id: 1, email: 1, role: 1, firstName: 1, lastName: 1 })
                .lean();
            const formId = report.formId ?? report?.rubric?.formId ?? null;
            if (formId && mongoose.isValidObjectId(String(formId))) {
                form = await EvaluationFormModel.findById(String(formId)).lean();
            }
            if (!form) {
                const sport = String(report.sport ?? "").trim().toLowerCase();
                if (sport) {
                    form = await EvaluationFormModel.findOne({ sport, isActive: true }).sort({ updatedAt: -1 }).lean();
                }
            }
            if (form && report.rubric) {
                rubricBreakdown = computeRubricBreakdown({ rubric: report.rubric, form });
            }
        }
        return res.json({
            film: { ...film, _id: String(film._id), userId: String(film.userId) },
            report: report
                ? {
                    ...report,
                    _id: String(report._id),
                    filmSubmissionId: String(report.filmSubmissionId),
                    playerUserId: String(report.playerUserId),
                    evaluatorUserId: String(report.evaluatorUserId),
                    formId: report.formId ? String(report.formId) : null
                }
                : null,
            evaluator: evaluator
                ? {
                    id: String(evaluator._id),
                    email: evaluator.email ?? null,
                    role: evaluator.role ?? null,
                    firstName: evaluator.firstName ?? null,
                    lastName: evaluator.lastName ?? null
                }
                : null,
            form: form ? { ...form, _id: String(form._id) } : null,
            rubricBreakdown
        });
    }
    catch (err) {
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
        const q = {};
        if (status)
            q.status = status;
        if (type)
            q.type = type;
        if (to)
            q.to = to;
        const [total, results] = await Promise.all([
            EmailAuditLogModel.countDocuments(q),
            EmailAuditLogModel.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).lean()
        ]);
        return res.json({ total, results, skip, limit });
    }
    catch (err) {
        return next(err);
    }
});
// Admin-only: resend invite email (creates a fresh invite token)
adminRouter.post("/admin/email/resend-invite", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
    try {
        const email = String(req.body?.email ?? "").trim().toLowerCase();
        const role = String(req.body?.role ?? "").trim().toLowerCase();
        if (!email || !email.includes("@")) {
            return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Valid email is required" }));
        }
        if (!role) {
            return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Valid role is required" }));
        }
        if (!isInviteEmailConfigured()) {
            return next(new ApiError({ status: 501, code: "NOT_CONFIGURED", message: "Email is not configured" }));
        }
        const invite = await createInvite({ email, role, createdByUserId: req.user.id });
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
            actorUserId: String(req.user.id),
            action: "email_resend_invite",
            targetType: "email",
            targetId: email,
            meta: { role }
        });
        return res.json({ ok: true });
    }
    catch (err) {
        return next(err);
    }
});
adminRouter.post("/admin/email/test", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
    try {
        const to = String(req.body?.to ?? "").trim().toLowerCase();
        if (!to || !to.includes("@")) {
            return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Valid 'to' email is required" }));
        }
        if (!isEmailConfigured()) {
            return next(new ApiError({ status: 501, code: "NOT_CONFIGURED", message: "Email is not configured" }));
        }
        const { env, transporter } = createTransporterOrThrow();
        const subject = `GoEducate Talent – Test email`;
        const text = `This is a test email from GoEducate Talent.\n\nTime: ${new Date().toISOString()}\nRequestId: ${req.requestId ?? ""}\n`;
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
        return res.json({ ok: true, messageId: info?.messageId ?? null });
    }
    catch (err) {
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
        const match = {};
        if (action)
            match.action = { $regex: action, $options: "i" };
        const basePipeline = [{ $match: match }, { $sort: { createdAt: -1 } }];
        basePipeline.push({
            $lookup: {
                from: "users",
                localField: "actorUserId",
                foreignField: "_id",
                as: "actor"
            }
        }, { $unwind: { path: "$actor", preserveNullAndEmptyArrays: true } });
        if (actorEmail)
            basePipeline.push({ $match: { "actor.email": actorEmail } });
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
    }
    catch (err) {
        return next(err);
    }
});
// Audit logs (profile-related). Admin only.
// GET /admin/audit-logs?action=PROFILE_VISIBILITY_CHANGED&limit=50
adminRouter.get("/admin/audit-logs", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
    try {
        const { action, limit } = req.query;
        const lim = Math.max(1, Math.min(200, limit ? Number(limit) : 50));
        const q = {};
        if (action)
            q.action = String(action);
        const items = await AuditLogModel.find(q).sort({ createdAt: -1 }).limit(lim).lean();
        return res.json({
            items: items.map((i) => ({
                ...i,
                _id: String(i._id),
                actorUserId: String(i.actorUserId),
                targetUserId: String(i.targetUserId)
            }))
        });
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
        const skipRaw = Number(req.query.skip ?? 0);
        const skip = Number.isFinite(skipRaw) ? Math.max(0, Math.min(50_000, skipRaw)) : 0;
        const match = {};
        if (unreadOnly)
            match.readAt = { $exists: false };
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