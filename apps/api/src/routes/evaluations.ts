import { Router } from "express";
import mongoose from "mongoose";

import { EvaluationReportCreateSchema, FILM_SUBMISSION_STATUS, ROLE } from "@goeducate/shared";

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

export const evaluationsRouter = Router();

// Evaluator/Admin: submit an evaluation report for a film submission.
// Creates one report per filmSubmissionId, and marks the film as COMPLETED.
evaluationsRouter.post("/evaluations", requireAuth, requireRole([ROLE.EVALUATOR, ROLE.ADMIN]), async (req, res, next) => {
  const parsed = EvaluationReportCreateSchema.safeParse(req.body);
  if (!parsed.success) return next(zodToBadRequest(parsed.error.flatten()));

  try {
    const evaluatorUserId = new mongoose.Types.ObjectId(req.user!.id);
    const filmSubmissionId = new mongoose.Types.ObjectId(parsed.data.filmSubmissionId);

    const film = await FilmSubmissionModel.findById(filmSubmissionId);
    if (!film) return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Film submission not found" }));
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
    if (existing) return next(new ApiError({ status: 409, code: "ALREADY_EXISTS", message: "Evaluation already exists" }));

    const created = await EvaluationReportModel.create({
      filmSubmissionId,
      playerUserId,
      evaluatorUserId,
      overallGrade: parsed.data.overallGrade,
      strengths: parsed.data.strengths,
      improvements: parsed.data.improvements,
      notes: parsed.data.notes
    });

    film.status = FILM_SUBMISSION_STATUS.COMPLETED;
    await film.save();

    // Player notification (in-app + email best-effort)
    await NotificationModel.create({
      userId: playerUserId,
      type: NOTIFICATION_TYPE.EVALUATION_COMPLETED,
      title: "Evaluation completed",
      message: `Your evaluation is ready for "${film.title}".`,
      href: `/player/film/${String(filmSubmissionId)}`
    });

    if (isNotificationEmailConfigured()) {
      const playerUser = await UserModel.findById(playerUserId).lean();
      if (playerUser?.email) {
        void sendNotificationEmail({
          to: playerUser.email,
          subject: "GoEducate Talent – Evaluation completed",
          title: "Evaluation completed",
          message: `Your evaluation is ready for "${film.title}".`,
          href: `/player/film/${String(filmSubmissionId)}`
        }).catch(() => {});
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
        await NotificationModel.insertMany(
          subscribed.map((c) => ({
            userId: new mongoose.Types.ObjectId(String(c._id)),
            type: NOTIFICATION_TYPE.WATCHLIST_EVAL_COMPLETED,
            title: "New evaluation posted",
            message: `A new evaluation was posted for ${playerName}.`,
            href: `/coach/player/${String(playerUserId)}`
          }))
        );

        if (isNotificationEmailConfigured()) {
          await Promise.all(
            subscribed
              .filter((c) => Boolean(c.email))
              .map((c) =>
                sendNotificationEmail({
                  to: c.email,
                  subject: "GoEducate Talent – New evaluation for your watchlist",
                  title: "New evaluation posted",
                  message: `A new evaluation was posted for ${playerName}.`,
                  href: `/coach/player/${String(playerUserId)}`
                }).catch(() => {})
              )
          );
        }
      }
    }

    return res.status(201).json(created);
  } catch (err) {
    return next(err);
  }
});

// Player/Coach/Evaluator/Admin: fetch evaluation report by film submission id.
evaluationsRouter.get(
  "/evaluations/film/:filmSubmissionId",
  requireAuth,
  requireRole([ROLE.PLAYER, ROLE.COACH, ROLE.EVALUATOR, ROLE.ADMIN]),
  async (req, res, next) => {
    try {
      const filmSubmissionId = new mongoose.Types.ObjectId(req.params.filmSubmissionId);

      // Enforce access:
      // - players can only read evaluations for their own film submissions
      // - coaches/evaluators/admins are allowed for now (subscription gating later)
      if (req.user?.role === ROLE.PLAYER) {
        const film = await FilmSubmissionModel.findById(filmSubmissionId).lean();
        if (!film) return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Film submission not found" }));
        if (String(film.userId) !== String(req.user.id)) {
          return next(new ApiError({ status: 403, code: "FORBIDDEN", message: "Insufficient permissions" }));
        }
      }

      const report = await EvaluationReportModel.findOne({ filmSubmissionId }).lean();
      if (!report) return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Evaluation not found" }));
      return res.json(report);
    } catch (err) {
      return next(err);
    }
  }
);

// Coach/Admin/Evaluator: list evaluation reports for a given player userId
// Player: may only list their own reports
evaluationsRouter.get(
  "/evaluations/player/:userId",
  requireAuth,
  requireRole([ROLE.PLAYER, ROLE.COACH, ROLE.EVALUATOR, ROLE.ADMIN]),
  async (req, res, next) => {
    try {
      const playerUserId = new mongoose.Types.ObjectId(req.params.userId);

      if (req.user?.role === ROLE.PLAYER && String(playerUserId) !== String(req.user.id)) {
        return next(new ApiError({ status: 403, code: "FORBIDDEN", message: "Insufficient permissions" }));
      }

      const results = await EvaluationReportModel.find({ playerUserId }).sort({ createdAt: -1 }).limit(200).lean();
      return res.json({ results });
    } catch (err) {
      return next(err);
    }
  }
);


