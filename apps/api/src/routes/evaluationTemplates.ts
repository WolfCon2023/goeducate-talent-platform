import { Router } from "express";
import mongoose from "mongoose";

import { EvaluationTemplateCreateSchema, EvaluationTemplateUpdateSchema, ROLE } from "@goeducate/shared";

import { ApiError } from "../http/errors.js";
import { zodToBadRequest } from "../http/zod.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { EvaluationTemplateModel } from "../models/EvaluationTemplate.js";

export const evaluationTemplatesRouter = Router();

function norm(v: unknown) {
  return String(v ?? "").trim();
}

// Evaluator/Admin: recommend best template for a given sport/position selection.
evaluationTemplatesRouter.get(
  "/evaluation-templates/recommend",
  requireAuth,
  requireRole([ROLE.EVALUATOR, ROLE.ADMIN]),
  async (req, res, next) => {
    try {
      const sportRaw = norm(req.query.sport).toLowerCase();
      const positionRaw = norm(req.query.position);
      const positionOtherRaw = norm(req.query.positionOther);

      const sport = sportRaw || "any";
      const effectivePosition =
        sport === "other" || positionRaw === "Other" ? positionOtherRaw || "any" : positionRaw || "any";

      const queries: Array<{ sport: string; position: string; match: string }> = [
        { sport, position: effectivePosition, match: "exact" },
        { sport, position: "any", match: "sport_anyPosition" },
        { sport: "any", position: effectivePosition, match: "anySport_position" },
        { sport: "any", position: "any", match: "anySport_anyPosition" }
      ];

      for (const q of queries) {
        const found = await EvaluationTemplateModel.findOne({
          sport: q.sport,
          position: q.position,
          isActive: true
        })
          .sort({ updatedAt: -1 })
          .lean();
        if (found) {
          return res.json({ match: q.match, template: found });
        }
      }

      return next(
        new ApiError({
          status: 404,
          code: "NOT_FOUND",
          message: "No active evaluation template found for this sport/position"
        })
      );
    } catch (err) {
      return next(err);
    }
  }
);

// Admin: list templates (with optional filters)
evaluationTemplatesRouter.get("/admin/evaluation-templates", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
  try {
    const sport = norm(req.query.sport).toLowerCase();
    const position = norm(req.query.position);
    const q = norm(req.query.q);
    const activeOnly = norm(req.query.activeOnly) === "1";

    const filter: any = {};
    if (sport) filter.sport = sport;
    if (position) filter.position = position;
    if (activeOnly) filter.isActive = true;
    if (q) {
      filter.$or = [{ title: { $regex: q, $options: "i" } }];
    }

    const results = await EvaluationTemplateModel.find(filter).sort({ updatedAt: -1 }).limit(200).lean();
    return res.json({ results });
  } catch (err) {
    return next(err);
  }
});

// Admin: create template
evaluationTemplatesRouter.post("/admin/evaluation-templates", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
  const parsed = EvaluationTemplateCreateSchema.safeParse(req.body);
  if (!parsed.success) return next(zodToBadRequest(parsed.error.flatten()));

  try {
    const created = await EvaluationTemplateModel.create({
      ...parsed.data,
      sport: String(parsed.data.sport ?? "any").toLowerCase(),
      position: String(parsed.data.position ?? "any").trim() || "any",
      createdByUserId: new mongoose.Types.ObjectId(req.user!.id)
    });
    return res.status(201).json(created);
  } catch (err) {
    return next(err);
  }
});

// Admin: update template
evaluationTemplatesRouter.patch(
  "/admin/evaluation-templates/:id",
  requireAuth,
  requireRole([ROLE.ADMIN]),
  async (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid id" }));
    }
    const parsed = EvaluationTemplateUpdateSchema.safeParse(req.body);
    if (!parsed.success) return next(zodToBadRequest(parsed.error.flatten()));

    try {
      const updated = await EvaluationTemplateModel.findByIdAndUpdate(
        req.params.id,
        {
          ...parsed.data,
          ...(parsed.data.sport ? { sport: String(parsed.data.sport).toLowerCase() } : {}),
          ...(parsed.data.position ? { position: String(parsed.data.position).trim() || "any" } : {})
        },
        { new: true }
      ).lean();
      if (!updated) return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Template not found" }));
      return res.json(updated);
    } catch (err) {
      return next(err);
    }
  }
);

// Admin: delete template
evaluationTemplatesRouter.delete(
  "/admin/evaluation-templates/:id",
  requireAuth,
  requireRole([ROLE.ADMIN]),
  async (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid id" }));
    }
    try {
      const deleted = await EvaluationTemplateModel.findByIdAndDelete(req.params.id).lean();
      if (!deleted) return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Template not found" }));
      return res.status(204).send();
    } catch (err) {
      return next(err);
    }
  }
);


