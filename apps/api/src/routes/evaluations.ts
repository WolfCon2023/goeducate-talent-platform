import { Router } from "express";
import mongoose from "mongoose";

import { EvaluationReportCreateSchema, FILM_SUBMISSION_STATUS, ROLE } from "@goeducate/shared";

import { ApiError } from "../http/errors.js";
import { zodToBadRequest } from "../http/zod.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { EvaluationReportModel } from "../models/EvaluationReport.js";
import { FilmSubmissionModel } from "../models/FilmSubmission.js";

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


