import { Router } from "express";
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";

import { FILM_SUBMISSION_STATUS, FilmSubmissionCreateSchema, ROLE } from "@goeducate/shared";

import { ApiError } from "../http/errors.js";
import { zodToBadRequest } from "../http/zod.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { getEnv } from "../env.js";
import { FilmSubmissionModel } from "../models/FilmSubmission.js";

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
        status: FILM_SUBMISSION_STATUS.SUBMITTED
      });
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
  async (_req, res, next) => {
    try {
      // Include both new submissions and ones currently being worked.
      const results = await FilmSubmissionModel.aggregate([
        {
          $match: {
            status: { $in: [FILM_SUBMISSION_STATUS.SUBMITTED, FILM_SUBMISSION_STATUS.IN_REVIEW] }
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
          $project: {
            _id: 1,
            userId: 1,
            title: 1,
            opponent: 1,
            gameDate: 1,
            status: 1,
            createdAt: 1,
            updatedAt: 1,
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

// Evaluator/Admin: update status (submitted -> in_review -> completed)
filmSubmissionsRouter.patch(
  "/film-submissions/:id/status",
  requireAuth,
  requireRole([ROLE.EVALUATOR, ROLE.ADMIN]),
  async (req, res, next) => {
    const status = (req.body as { status?: string }).status;
    const allowed = [FILM_SUBMISSION_STATUS.SUBMITTED, FILM_SUBMISSION_STATUS.IN_REVIEW, FILM_SUBMISSION_STATUS.COMPLETED];
    if (!status || !allowed.includes(status as any)) {
      return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid status" }));
    }

    try {
      const _id = new mongoose.Types.ObjectId(req.params.id);
      const updated = await FilmSubmissionModel.findByIdAndUpdate(_id, { $set: { status } }, { new: true });
      if (!updated) return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Film submission not found" }));
      return res.json(updated);
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
      if (film.status !== FILM_SUBMISSION_STATUS.SUBMITTED) {
        return next(
          new ApiError({
            status: 409,
            code: "CANNOT_DELETE",
            message: "Can only delete submissions that are still in submitted status"
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


