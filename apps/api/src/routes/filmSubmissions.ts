import { Router } from "express";
import mongoose from "mongoose";

import { FILM_SUBMISSION_STATUS, FilmSubmissionCreateSchema, ROLE } from "@goeducate/shared";

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

// Evaluator/Admin: basic evaluation queue (submitted)
filmSubmissionsRouter.get(
  "/film-submissions/queue",
  requireAuth,
  requireRole([ROLE.EVALUATOR, ROLE.ADMIN]),
  async (_req, res, next) => {
    try {
      const results = await FilmSubmissionModel.find({ status: FILM_SUBMISSION_STATUS.SUBMITTED })
        .sort({ createdAt: 1 })
        .limit(200)
        .lean();
      return res.json({ results });
    } catch (err) {
      return next(err);
    }
  }
);


