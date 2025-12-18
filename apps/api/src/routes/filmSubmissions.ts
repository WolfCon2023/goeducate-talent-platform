import { Router } from "express";
import mongoose from "mongoose";

import { FILM_SUBMISSION_STATUS, FilmSubmissionCreateSchema, ROLE } from "@goeducate/shared";

import { ApiError } from "../http/errors.js";
import { zodToBadRequest } from "../http/zod.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
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

// Fetch a specific film submission by id.
// - player can only fetch their own
// - coach/admin/evaluator can fetch any (subscription gating later)
filmSubmissionsRouter.get(
  "/film-submissions/:id([0-9a-fA-F]{24})",
  requireAuth,
  requireRole([ROLE.PLAYER, ROLE.COACH, ROLE.ADMIN, ROLE.EVALUATOR]),
  async (req, res, next) => {
    try {
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

// Evaluator/Admin: basic evaluation queue (submitted)
filmSubmissionsRouter.get(
  "/film-submissions/queue",
  requireAuth,
  requireRole([ROLE.EVALUATOR, ROLE.ADMIN]),
  async (_req, res, next) => {
    try {
      // Include both new submissions and ones currently being worked.
      const results = await FilmSubmissionModel.find({
        status: { $in: [FILM_SUBMISSION_STATUS.SUBMITTED, FILM_SUBMISSION_STATUS.IN_REVIEW] }
      })
        .sort({ createdAt: 1 })
        .limit(200)
        .lean();
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


