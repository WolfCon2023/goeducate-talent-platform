import { Router } from "express";
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";

import { FILM_SUBMISSION_STATUS, FilmSubmissionCreateSchema, ROLE } from "@goeducate/shared";

import { ApiError } from "../http/errors.js";
import { zodToBadRequest } from "../http/zod.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { getEnv } from "../env.js";
import { FilmSubmissionModel } from "../models/FilmSubmission.js";
import { NotificationModel, NOTIFICATION_TYPE } from "../models/Notification.js";
import { UserModel } from "../models/User.js";
import { isNotificationEmailConfigured, sendNotificationEmail } from "../email/notifications.js";
import { PlayerProfileModel } from "../models/PlayerProfile.js";
import { publishNotificationsChanged } from "../notifications/bus.js";
import { EmailAuditLogModel, EMAIL_AUDIT_STATUS, EMAIL_AUDIT_TYPE } from "../models/EmailAuditLog.js";

export const filmSubmissionsRouter = Router();

// Player: create a film submission (manual upload MVP = URL placeholder + metadata)
filmSubmissionsRouter.post(
  "/film-submissions",
  requireAuth,
  requireRole([ROLE.PLAYER]),
  async (req, res, next) => {
    const parsed = FilmSubmissionCreateSchema.safeParse(req.body);
    if (!parsed.success) return next(zodToBadRequest(parsed.error.flatten()));

    try {
      const userId = new mongoose.Types.ObjectId(req.user!.id);
      const created = await FilmSubmissionModel.create({
        userId,
        title: parsed.data.title,
        opponent: parsed.data.opponent,
        gameDate: parsed.data.gameDate ? new Date(parsed.data.gameDate) : undefined,
        notes: parsed.data.notes,
        videoUrl: parsed.data.videoUrl,
        cloudinaryPublicId: parsed.data.cloudinaryPublicId,
        status: FILM_SUBMISSION_STATUS.SUBMITTED,
        history: [{ at: new Date(), byUserId: userId, action: "created", toStatus: FILM_SUBMISSION_STATUS.SUBMITTED }]
      });

      // In-app notification for the player (best-effort).
      await NotificationModel.create({
        userId,
        type: NOTIFICATION_TYPE.FILM_SUBMITTED,
        title: "Film submitted",
        message: `We received your submission: "${created.title}".`,
        href: "/player/film"
      });
      publishNotificationsChanged(String(userId));

      // Email notification for the player (best-effort).
      if (isNotificationEmailConfigured()) {
        const user = await UserModel.findById(userId).lean();
        if (user?.email) {
          void sendNotificationEmail({
            to: user.email,
            subject: "GoEducate Talent – Film submitted",
            title: "Film submitted",
            message: `We received your submission: "${created.title}".`,
            href: "/player/film"
          }).catch(() => {});
        }

        // Ops + evaluator alerts (best-effort, fire-and-forget).
        void (async () => {
          try {
            const env = getEnv();
            const profile = await PlayerProfileModel.findOne({ userId }).lean();
            const playerName = profile ? `${profile.firstName} ${profile.lastName}`.trim() : "A player";

            const evaluators = await UserModel.find({ role: ROLE.EVALUATOR }).select({ _id: 1, email: 1 }).lean();
            const evaluatorEmails = evaluators.map((e) => String(e.email ?? "").trim()).filter((e) => e.includes("@"));

            // In-app notifications for all evaluators + admins (so their Notifications badge isn't 0).
            const admins = await UserModel.find({ role: ROLE.ADMIN }).select({ _id: 1 }).lean();
            const internalIds = [
              ...evaluators.map((e) => String(e._id)).filter(Boolean),
              ...admins.map((a) => String(a._id)).filter(Boolean)
            ];
            const uniqueInternalIds = [...new Set(internalIds)].filter((id) => mongoose.isValidObjectId(id));
            if (uniqueInternalIds.length > 0) {
              await NotificationModel.insertMany(
                uniqueInternalIds.map((id) => ({
                  userId: new mongoose.Types.ObjectId(id),
                  type: NOTIFICATION_TYPE.QUEUE_NEW_SUBMISSION,
                  title: "New film submission received",
                  message: `${playerName} submitted: "${created.title}".`,
                  href: "/evaluator"
                }))
              );
              for (const id of uniqueInternalIds) publishNotificationsChanged(id);
            }

            const opsEmails = String(env.SUBMISSION_ALERT_EMAILS ?? "info@goeducateinc.org")
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s.includes("@"));

            const recipients = [...new Set([...evaluatorEmails, ...opsEmails])];
            if (recipients.length === 0) return;

            await Promise.all(
              recipients.map((to) =>
                sendNotificationEmail({
                  to,
                  subject: "GoEducate Talent – New film submission received",
                  title: "New film submission received",
                  message: `${playerName} submitted: "${created.title}".`,
                  href: "/evaluator"
                }).catch(() => {})
              )
            );
          } catch {
            // best-effort: ignore
          }
        })();
      }

      return res.status(201).json(created);
    } catch (err) {
      return next(err);
    }
  }
);

// Player: list own submissions
filmSubmissionsRouter.get(
  "/film-submissions/me",
  requireAuth,
  requireRole([ROLE.PLAYER]),
  async (req, res, next) => {
    try {
      const userId = new mongoose.Types.ObjectId(req.user!.id);
      const results = await FilmSubmissionModel.find({ userId }).sort({ createdAt: -1 }).limit(100).lean();
      return res.json({ results });
    } catch (err) {
      return next(err);
    }
  }
);

// Coach/Admin/Evaluator: list submissions for a specific player userId
filmSubmissionsRouter.get(
  "/film-submissions/player/:userId",
  requireAuth,
  requireRole([ROLE.COACH, ROLE.ADMIN, ROLE.EVALUATOR]),
  async (req, res, next) => {
    try {
      const userId = new mongoose.Types.ObjectId(req.params.userId);
      const results = await FilmSubmissionModel.find({ userId }).sort({ createdAt: -1 }).limit(100).lean();
      return res.json({ results });
    } catch (err) {
      return next(err);
    }
  }
);

// Evaluator/Admin: basic evaluation queue (submitted)
filmSubmissionsRouter.get(
  "/film-submissions/queue",
  requireAuth,
  requireRole([ROLE.EVALUATOR, ROLE.ADMIN]),
  async (req, res, next) => {
    try {
      const mine = String(req.query.mine ?? "").trim() === "1";
      const evaluatorUserId = mine ? new mongoose.Types.ObjectId(req.user!.id) : null;

      // Include both new submissions and ones currently being worked.
      const results = await FilmSubmissionModel.aggregate([
        {
          $match: {
            status: { $in: [FILM_SUBMISSION_STATUS.SUBMITTED, FILM_SUBMISSION_STATUS.NEEDS_CHANGES, FILM_SUBMISSION_STATUS.IN_REVIEW] },
            ...(mine ? { assignedEvaluatorUserId: evaluatorUserId } : {})
          }
        },
        { $sort: { createdAt: 1 } },
        { $limit: 200 },
        {
          $lookup: {
            from: "playerprofiles",
            localField: "userId",
            foreignField: "userId",
            as: "playerProfile"
          }
        },
        {
          $unwind: {
            path: "$playerProfile",
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $lookup: {
            from: "users",
            localField: "assignedEvaluatorUserId",
            foreignField: "_id",
            as: "assignedEvaluator"
          }
        },
        {
          $unwind: {
            path: "$assignedEvaluator",
            preserveNullAndEmptyArrays: true
          }
        },
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
            assignedEvaluatorUserId: 1,
            assignedAt: 1,
            assignedEvaluator: {
              _id: "$assignedEvaluator._id",
              email: "$assignedEvaluator.email"
            },
            playerProfile: {
              firstName: "$playerProfile.firstName",
              lastName: "$playerProfile.lastName",
              position: "$playerProfile.position",
              gradYear: "$playerProfile.gradYear",
              city: "$playerProfile.city",
              state: "$playerProfile.state"
            }
          }
        }
      ]);
      return res.json({ results });
    } catch (err) {
      return next(err);
    }
  }
);

// Evaluator/Admin: assignment controls (assign-to-me / unassign)
filmSubmissionsRouter.patch(
  "/film-submissions/:id/assignment",
  requireAuth,
  requireRole([ROLE.EVALUATOR, ROLE.ADMIN]),
  async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Film submission not found" }));
      }

      const action = String((req.body as { action?: unknown }).action ?? "").trim();
      const force = Boolean((req.body as { force?: unknown }).force);
      if (action !== "assign_to_me" && action !== "unassign") {
        return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid action" }));
      }

      const _id = new mongoose.Types.ObjectId(req.params.id);
      const evaluatorUserId = new mongoose.Types.ObjectId(req.user!.id);
      const isAdmin = req.user?.role === ROLE.ADMIN;

      const film = await FilmSubmissionModel.findById(_id);
      if (!film) return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Film submission not found" }));
      if (film.status === FILM_SUBMISSION_STATUS.COMPLETED) {
        return next(new ApiError({ status: 409, code: "CANNOT_ASSIGN", message: "Cannot assign a completed submission" }));
      }

      if (action === "assign_to_me") {
        const prevStatus = film.status;
        if (film.assignedEvaluatorUserId && String(film.assignedEvaluatorUserId) !== String(evaluatorUserId)) {
          if (!isAdmin || !force) {
            return next(
              new ApiError({
                status: 409,
                code: "ALREADY_ASSIGNED",
                message: "Already assigned to another evaluator"
              })
            );
          }
        }
        film.assignedEvaluatorUserId = evaluatorUserId;
        film.assignedAt = new Date();
        if (film.status === FILM_SUBMISSION_STATUS.SUBMITTED) {
          film.status = FILM_SUBMISSION_STATUS.IN_REVIEW;
        }
        film.history = film.history ?? [];
        film.history.push({ at: new Date(), byUserId: evaluatorUserId, action: "assigned" });
        if (prevStatus !== film.status) {
          film.history.push({
            at: new Date(),
            byUserId: evaluatorUserId,
            action: "status_changed",
            fromStatus: prevStatus,
            toStatus: film.status
          });
        }
        await film.save();
        return res.json(film);
      }

      // unassign
      if (film.assignedEvaluatorUserId && String(film.assignedEvaluatorUserId) !== String(evaluatorUserId) && !isAdmin) {
        return next(new ApiError({ status: 403, code: "FORBIDDEN", message: "Insufficient permissions" }));
      }
      film.assignedEvaluatorUserId = undefined;
      film.assignedAt = undefined;
      const prevStatus = film.status;
      if (film.status === FILM_SUBMISSION_STATUS.IN_REVIEW) {
        film.status = FILM_SUBMISSION_STATUS.SUBMITTED;
      }
      film.history = film.history ?? [];
      film.history.push({ at: new Date(), byUserId: evaluatorUserId, action: "unassigned" });
      if (prevStatus !== film.status) {
        film.history.push({
          at: new Date(),
          byUserId: evaluatorUserId,
          action: "status_changed",
          fromStatus: prevStatus,
          toStatus: film.status
        });
      }
      await film.save();
      return res.json(film);
    } catch (err) {
      return next(err);
    }
  }
);

// Evaluator/Admin: update status (submitted -> in_review -> completed)
filmSubmissionsRouter.patch(
  "/film-submissions/:id/status",
  requireAuth,
  requireRole([ROLE.EVALUATOR, ROLE.ADMIN]),
  async (req, res, next) => {
    const status = String((req.body as { status?: string }).status ?? "").trim();
    const note = String((req.body as { note?: string }).note ?? "").trim();
    const allowed = [
      FILM_SUBMISSION_STATUS.SUBMITTED,
      FILM_SUBMISSION_STATUS.IN_REVIEW,
      FILM_SUBMISSION_STATUS.NEEDS_CHANGES,
      FILM_SUBMISSION_STATUS.COMPLETED
    ];
    if (!status || !allowed.includes(status as any)) {
      return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid status" }));
    }

    try {
      const _id = new mongoose.Types.ObjectId(req.params.id);
      const film = await FilmSubmissionModel.findById(_id);
      if (!film) return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Film submission not found" }));

      const prev = film.status;
      film.status = status as any;
      film.history = film.history ?? [];
      film.history.push({
        at: new Date(),
        byUserId: new mongoose.Types.ObjectId(req.user!.id),
        action: "status_changed",
        fromStatus: prev,
        toStatus: film.status,
        ...(note ? { note: note.slice(0, 2000) } : {})
      });

      // If we return for edits, unassign so it doesn't stay stuck in a queue.
      if (film.status === FILM_SUBMISSION_STATUS.NEEDS_CHANGES) {
        film.assignedEvaluatorUserId = undefined;
        film.assignedAt = undefined;
      }

      await film.save();

      // Notify player when returned for edits (best-effort).
      if (film.status === FILM_SUBMISSION_STATUS.NEEDS_CHANGES) {
        await NotificationModel.create({
          userId: film.userId,
          type: NOTIFICATION_TYPE.FILM_SUBMITTED,
          title: "Film needs changes",
          message: note ? `Update requested: ${note}` : "An evaluator requested changes to your submission. Please review and resubmit film if needed.",
          href: "/player/film"
        });
        publishNotificationsChanged(String(film.userId));

        // Email the player as well (best-effort).
        const user = await UserModel.findById(film.userId).lean();
        const profile = await PlayerProfileModel.findOne({ userId: film.userId }).lean();
        const to = String(user?.email ?? profile?.contactEmail ?? "")
          .trim()
          .toLowerCase();
        const subject = "GoEducate Talent – Film needs changes";

        if (!to || !to.includes("@")) {
          // Don't attempt email if we don't have a valid destination.
          await EmailAuditLogModel.create({
            type: EMAIL_AUDIT_TYPE.FILM_NEEDS_CHANGES,
            status: EMAIL_AUDIT_STATUS.SKIPPED,
            to: to || "(missing)",
            subject
          });
        } else if (!isNotificationEmailConfigured()) {
          await EmailAuditLogModel.create({
            type: EMAIL_AUDIT_TYPE.FILM_NEEDS_CHANGES,
            status: EMAIL_AUDIT_STATUS.SKIPPED,
            to,
            subject
          });
        } else {
          void (async () => {
            try {
              await sendNotificationEmail({
                to,
                subject,
                title: "Film needs changes",
                message: note
                  ? `An evaluator requested changes to your submission. Notes: ${note}`
                  : "An evaluator requested changes to your submission. Please review the notes and resubmit.",
                href: "/player/film"
              });
              await EmailAuditLogModel.create({
                type: EMAIL_AUDIT_TYPE.FILM_NEEDS_CHANGES,
                status: EMAIL_AUDIT_STATUS.SENT,
                to,
                subject
              });
            } catch (err) {
              await EmailAuditLogModel.create({
                type: EMAIL_AUDIT_TYPE.FILM_NEEDS_CHANGES,
                status: EMAIL_AUDIT_STATUS.FAILED,
                to,
                subject,
                error: err
              });
            }
          })();
        }
      }

      return res.json(film);
    } catch (err) {
      return next(err);
    }
  }
);

// Fetch a specific film submission by id.
// Keep this AFTER more specific routes like /queue to avoid route collisions.
// - player can only fetch their own
// - coach/admin/evaluator can fetch any (subscription gating later)
filmSubmissionsRouter.get(
  "/film-submissions/:id",
  requireAuth,
  requireRole([ROLE.PLAYER, ROLE.COACH, ROLE.ADMIN, ROLE.EVALUATOR]),
  async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Film submission not found" }));
      }
      const _id = new mongoose.Types.ObjectId(req.params.id);
      const film = await FilmSubmissionModel.findById(_id).lean();
      if (!film) return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Film submission not found" }));

      if (req.user?.role === ROLE.PLAYER && String(film.userId) !== String(req.user.id)) {
        return next(new ApiError({ status: 403, code: "FORBIDDEN", message: "Insufficient permissions" }));
      }

      return res.json(film);
    } catch (err) {
      return next(err);
    }
  }
);

// Player: delete own submission (submitted only). Also deletes Cloudinary asset if we have public_id.
filmSubmissionsRouter.delete(
  "/film-submissions/:id",
  requireAuth,
  requireRole([ROLE.PLAYER]),
  async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Film submission not found" }));
      }
      const _id = new mongoose.Types.ObjectId(req.params.id);
      const film = await FilmSubmissionModel.findById(_id);
      if (!film) return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Film submission not found" }));

      if (String(film.userId) !== String(req.user!.id)) {
        return next(new ApiError({ status: 403, code: "FORBIDDEN", message: "Insufficient permissions" }));
      }
      if (film.status !== FILM_SUBMISSION_STATUS.SUBMITTED && film.status !== FILM_SUBMISSION_STATUS.NEEDS_CHANGES) {
        return next(
          new ApiError({
            status: 409,
            code: "CANNOT_DELETE",
            message: "Can only delete submissions that are still in submitted/needs_changes status"
          })
        );
      }

      // Best-effort Cloudinary delete (do not block DB delete if Cloudinary isn't configured).
      if (film.cloudinaryPublicId) {
        const env = getEnv();
        if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
          cloudinary.config({
            cloud_name: env.CLOUDINARY_CLOUD_NAME,
            api_key: env.CLOUDINARY_API_KEY,
            api_secret: env.CLOUDINARY_API_SECRET
          });
          try {
            await cloudinary.uploader.destroy(film.cloudinaryPublicId, { resource_type: "video" });
          } catch {
            // ignore Cloudinary errors; we still delete from our DB
          }
        }
      }

      await film.deleteOne();
      return res.status(204).send();
    } catch (err) {
      return next(err);
    }
  }
);


