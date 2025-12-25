import { Router } from "express";
import mongoose from "mongoose";
import { EvaluationReportCreateSchema, FILM_SUBMISSION_STATUS, ROLE } from "@goeducate/shared";
import { getEnv } from "../env.js";
import { ApiError } from "../http/errors.js";
import { zodToBadRequest } from "../http/zod.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { EvaluationReportModel } from "../models/EvaluationReport.js";
import { FilmSubmissionModel } from "../models/FilmSubmission.js";
import { NotificationModel, NOTIFICATION_TYPE } from "../models/Notification.js";
import { PlayerProfileModel } from "../models/PlayerProfile.js";
import { WatchlistModel } from "../models/Watchlist.js";
import { COACH_SUBSCRIPTION_STATUS, UserModel } from "../models/User.js";
import { isNotificationEmailConfigured, sendNotificationEmail } from "../email/notifications.js";
import { EvaluationFormModel } from "../models/EvaluationForm.js";
import { publishNotificationsChanged } from "../notifications/bus.js";
function computeGradeFromRubric(opts) {
    const rubric = opts.rubric;
    const form = opts.form;
    const categoriesDef = Array.isArray(form?.categories) ? form.categories : [];
    const categoriesResp = Array.isArray(rubric?.categories) ? rubric.categories : [];
    const byKey = new Map(categoriesResp.map((c) => [String(c.key), c]));
    const weightSum = categoriesDef.reduce((a, c) => a + (Number(c.weight) || 0), 0) || 100;
    let total = 0;
    let totalWeight = 0;
    for (const cDef of categoriesDef) {
        const cKey = String(cDef.key);
        const w = Number(cDef.weight) || 0;
        const cResp = byKey.get(cKey);
        const traitsDef = Array.isArray(cDef.traits) ? cDef.traits : [];
        const traitsResp = Array.isArray(cResp?.traits) ? cResp.traits : [];
        const traitsByKey = new Map(traitsResp.map((t) => [String(t.key), t]));
        const scores = [];
        for (const tDef of traitsDef) {
            const tKey = String(tDef.key);
            // Projection is derived from the overall average and should not influence scoring.
            if (tKey.toLowerCase().includes("projection"))
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
                    scores.push(s);
            }
            else {
                const n = Number(tResp.valueNumber);
                if (Number.isFinite(n))
                    scores.push(n);
            }
        }
        if (scores.length === 0)
            continue;
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        total += avg * (w / weightSum);
        totalWeight += w / weightSum;
    }
    const raw = totalWeight > 0 ? total / totalWeight : 7;
    const bounded = Math.max(1, Math.min(10, raw));
    const rounded = Math.max(1, Math.min(10, Math.round(bounded)));
    return { overallGradeRaw: bounded, overallGrade: rounded };
}
function suggestedProjectionFromAverage(avg) {
    if (avg >= 9)
        return { key: "elite_upside", label: "Elite Upside" };
    if (avg >= 7.5)
        return { key: "high_upside", label: "High Upside" };
    if (avg >= 6)
        return { key: "solid", label: "Solid" };
    return { key: "developmental", label: "Developmental" };
}
export const evaluationsRouter = Router();
// Evaluator/Admin: submit an evaluation report for a film submission.
// Creates one report per filmSubmissionId, and marks the film as COMPLETED.
evaluationsRouter.post("/evaluations", requireAuth, requireRole([ROLE.EVALUATOR, ROLE.ADMIN]), async (req, res, next) => {
    const parsed = EvaluationReportCreateSchema.safeParse(req.body);
    if (!parsed.success)
        return next(zodToBadRequest(parsed.error.flatten()));
    try {
        const evaluatorUserId = new mongoose.Types.ObjectId(req.user.id);
        const filmSubmissionId = new mongoose.Types.ObjectId(parsed.data.filmSubmissionId);
        const film = await FilmSubmissionModel.findById(filmSubmissionId);
        if (!film)
            return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Film submission not found" }));
        const playerUserId = new mongoose.Types.ObjectId(String(film.userId));
        // Enforce evaluator assignment:
        // - if assigned to someone else, evaluators cannot complete it
        // - if unassigned, auto-assign to the evaluator on first completion attempt
        if (req.user?.role === ROLE.EVALUATOR) {
            if (film.assignedEvaluatorUserId && String(film.assignedEvaluatorUserId) !== String(evaluatorUserId)) {
                return next(new ApiError({ status: 409, code: "ALREADY_ASSIGNED", message: "Assigned to another evaluator" }));
            }
            if (!film.assignedEvaluatorUserId) {
                film.assignedEvaluatorUserId = evaluatorUserId;
                film.assignedAt = new Date();
            }
            if (film.status === FILM_SUBMISSION_STATUS.SUBMITTED) {
                film.status = FILM_SUBMISSION_STATUS.IN_REVIEW;
            }
        }
        const existing = await EvaluationReportModel.findOne({ filmSubmissionId }).lean();
        if (existing)
            return next(new ApiError({ status: 409, code: "ALREADY_EXISTS", message: "Evaluation already exists" }));
        let overallGrade = parsed.data.overallGrade;
        let overallGradeRaw = undefined;
        let suggestedProjection = undefined;
        let formId = undefined;
        if (!overallGrade && parsed.data.rubric) {
            // Compute grade from rubric + active form (sport-specific)
            const sport = String(parsed.data.sport ?? "").trim().toLowerCase();
            const form = sport ? await EvaluationFormModel.findOne({ sport, isActive: true }).sort({ updatedAt: -1 }).lean() : null;
            if (form) {
                const g = computeGradeFromRubric({ rubric: parsed.data.rubric, form });
                overallGrade = g.overallGrade;
                overallGradeRaw = g.overallGradeRaw;
                suggestedProjection = suggestedProjectionFromAverage(overallGradeRaw);
                formId = new mongoose.Types.ObjectId(String(form._id));
            }
            else {
                // If no form exists, still allow submission but require an explicit grade.
                overallGrade = 7;
            }
        }
        if (!overallGrade) {
            return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "overallGrade is required when rubric is not provided" }));
        }
        const created = await EvaluationReportModel.create({
            filmSubmissionId,
            playerUserId,
            evaluatorUserId,
            sport: parsed.data.sport,
            position: parsed.data.position,
            positionOther: parsed.data.positionOther,
            overallGrade,
            ...(typeof overallGradeRaw === "number" ? { overallGradeRaw } : {}),
            ...(suggestedProjection ? { suggestedProjection: suggestedProjection.key, suggestedProjectionLabel: suggestedProjection.label } : {}),
            ...(parsed.data.rubric ? { rubric: parsed.data.rubric } : {}),
            ...(formId ? { formId } : {}),
            strengths: parsed.data.strengths,
            improvements: parsed.data.improvements,
            notes: parsed.data.notes
        });
        const prevStatus = film.status;
        film.status = FILM_SUBMISSION_STATUS.COMPLETED;
        film.history = Array.isArray(film.history) ? film.history : [];
        film.history.push({
            at: new Date(),
            byUserId: evaluatorUserId,
            action: "status_changed",
            fromStatus: prevStatus,
            toStatus: film.status
        });
        await film.save();
        // Player notification (in-app + email best-effort)
        await NotificationModel.create({
            userId: playerUserId,
            type: NOTIFICATION_TYPE.EVALUATION_COMPLETED,
            title: "Evaluation completed",
            message: `Your evaluation is ready for "${film.title}".`,
            href: `/player/film/${String(filmSubmissionId)}?view=evaluation`
        });
        publishNotificationsChanged(String(playerUserId));
        if (isNotificationEmailConfigured()) {
            const env = getEnv();
            const opsEmails = String(env.SUBMISSION_ALERT_EMAILS ?? "info@goeducateinc.org")
                .split(",")
                .map((s) => s.trim())
                .filter((s) => s.includes("@"));
            // Always ensure info@ is included for operational visibility.
            if (!opsEmails.some((e) => e.toLowerCase() === "info@goeducateinc.org")) {
                opsEmails.push("info@goeducateinc.org");
            }
            const playerUser = await UserModel.findById(playerUserId).lean();
            if (playerUser?.email) {
                const bcc = opsEmails.filter((e) => e.toLowerCase() !== String(playerUser.email).trim().toLowerCase());
                void sendNotificationEmail({
                    to: playerUser.email,
                    ...(bcc.length ? { bcc } : {}),
                    subject: "GoEducate Talent – Evaluation completed",
                    title: "Evaluation completed",
                    message: `Your evaluation is ready for "${film.title}".`,
                    href: `/player/film/${String(filmSubmissionId)}?view=evaluation`
                }).catch((err) => {
                    console.error("[email] evaluation completed (player) failed", err);
                });
            }
            else if (opsEmails.length) {
                // Still alert ops/info even if we don't have a player email.
                void sendNotificationEmail({
                    to: opsEmails[0],
                    ...(opsEmails.length > 1 ? { bcc: opsEmails.slice(1) } : {}),
                    subject: "GoEducate Talent – Evaluation completed (copy)",
                    title: "Evaluation completed",
                    message: `Evaluation completed for "${film.title}". Player email is missing on the user record.`,
                    href: `/player/film/${String(filmSubmissionId)}?view=evaluation`
                }).catch((err) => {
                    console.error("[email] evaluation completed (ops copy) failed", err);
                });
            }
        }
        // Coach watchlist notifications (subscribed coaches only)
        const playerProfile = await PlayerProfileModel.findOne({ userId: playerUserId }).lean();
        const playerName = playerProfile ? `${playerProfile.firstName} ${playerProfile.lastName}`.trim() : "A watchlisted player";
        const watchlistItems = await WatchlistModel.find({ playerUserId }).lean();
        const coachIds = [...new Set(watchlistItems.map((w) => String(w.coachUserId)))];
        if (coachIds.length > 0) {
            const coaches = await UserModel.find({ _id: { $in: coachIds }, role: ROLE.COACH }).lean();
            const subscribed = coaches.filter((c) => c.subscriptionStatus === COACH_SUBSCRIPTION_STATUS.ACTIVE);
            if (subscribed.length > 0) {
                await NotificationModel.insertMany(subscribed.map((c) => ({
                    userId: new mongoose.Types.ObjectId(String(c._id)),
                    type: NOTIFICATION_TYPE.WATCHLIST_EVAL_COMPLETED,
                    title: "New evaluation posted",
                    message: `A new evaluation was posted for ${playerName}.`,
                    href: `/coach/film/${String(filmSubmissionId)}?view=evaluation`
                })));
                for (const c of subscribed)
                    publishNotificationsChanged(String(c._id));
                if (isNotificationEmailConfigured()) {
                    await Promise.all(subscribed
                        .filter((c) => Boolean(c.email))
                        .map((c) => sendNotificationEmail({
                        to: c.email,
                        subject: "GoEducate Talent – New evaluation for your watchlist",
                        title: "New evaluation posted",
                        message: `A new evaluation was posted for ${playerName}.`,
                        href: `/coach/film/${String(filmSubmissionId)}?view=evaluation`
                    }).catch(() => { })));
                }
            }
        }
        return res.status(201).json(created);
    }
    catch (err) {
        return next(err);
    }
});
// Player/Coach/Evaluator/Admin: fetch evaluation report by film submission id.
evaluationsRouter.get("/evaluations/film/:filmSubmissionId", requireAuth, requireRole([ROLE.PLAYER, ROLE.COACH, ROLE.EVALUATOR, ROLE.ADMIN]), async (req, res, next) => {
    try {
        const filmSubmissionId = new mongoose.Types.ObjectId(req.params.filmSubmissionId);
        // Enforce access:
        // - players can only read evaluations for their own film submissions
        // - coaches/evaluators/admins are allowed for now (subscription gating later)
        if (req.user?.role === ROLE.PLAYER) {
            const film = await FilmSubmissionModel.findById(filmSubmissionId).lean();
            if (!film)
                return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Film submission not found" }));
            if (String(film.userId) !== String(req.user.id)) {
                return next(new ApiError({ status: 403, code: "FORBIDDEN", message: "Insufficient permissions" }));
            }
        }
        const report = await EvaluationReportModel.findOne({ filmSubmissionId }).lean();
        if (!report)
            return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Evaluation not found" }));
        return res.json(report);
    }
    catch (err) {
        return next(err);
    }
});
// Coach/Admin/Evaluator: list evaluation reports for a given player userId
// Player: may only list their own reports
evaluationsRouter.get("/evaluations/player/:userId", requireAuth, requireRole([ROLE.PLAYER, ROLE.COACH, ROLE.EVALUATOR, ROLE.ADMIN]), async (req, res, next) => {
    try {
        const playerUserId = new mongoose.Types.ObjectId(req.params.userId);
        if (req.user?.role === ROLE.PLAYER && String(playerUserId) !== String(req.user.id)) {
            return next(new ApiError({ status: 403, code: "FORBIDDEN", message: "Insufficient permissions" }));
        }
        const results = await EvaluationReportModel.find({ playerUserId }).sort({ createdAt: -1 }).limit(200).lean();
        return res.json({ results });
    }
    catch (err) {
        return next(err);
    }
});
//# sourceMappingURL=evaluations.js.map