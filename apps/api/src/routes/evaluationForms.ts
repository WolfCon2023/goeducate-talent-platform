import { Router } from "express";
import mongoose from "mongoose";

import { EvaluationFormCreateSchema, EvaluationFormDefinitionSchema, EvaluationFormUpdateSchema, ROLE } from "@goeducate/shared";

import { ApiError } from "../http/errors.js";
import { zodToBadRequest } from "../http/zod.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { EvaluationFormModel } from "../models/EvaluationForm.js";

export const evaluationFormsRouter = Router();

function defaultFormForSport(sport: string) {
  const s = String(sport).trim().toLowerCase();
  const normalized =
    s === "football" || s === "basketball" || s === "volleyball" || s === "soccer" || s === "track" || s === "other"
      ? s
      : "other";

  const base = {
    title: `Default ${normalized} evaluation form`,
    sport: normalized as any,
    isActive: true,
    version: 1,
    strengthsPrompt:
      "Provide 2–4 strengths with specific evidence (what you saw and where). Use bullet points.\n- Strength 1 (evidence)\n- Strength 2 (evidence)",
    improvementsPrompt:
      "Provide 2–4 improvements with actionable coaching points. Use bullet points.\n- Improvement 1 (how to improve)\n- Improvement 2 (how to improve)",
    notesHelp: "Optional: leave any additional context, caveats, or timecodes.",
    categories: [
      {
        key: "physical",
        label: "Physical",
        weight: 20,
        traits: [
          { key: "size_frame", label: "Size / frame", type: "slider", required: true, min: 1, max: 10, step: 1 },
          { key: "strength", label: "Functional strength", type: "slider", required: true, min: 1, max: 10, step: 1 },
          { key: "durability", label: "Durability / play through contact", type: "slider", required: true, min: 1, max: 10, step: 1 },
          {
            key: "body_control",
            label: "Body control",
            type: "slider",
            required: true,
            min: 1,
            max: 10,
            step: 1
          },
          {
            key: "physical_confidence",
            label: "Confidence (physical assessment)",
            type: "select",
            required: true,
            options: [
              { value: "low", label: "Low", score: 4 },
              { value: "medium", label: "Medium", score: 6 },
              { value: "high", label: "High", score: 8 }
            ]
          }
        ]
      },
      {
        key: "athletic",
        label: "Athletic",
        weight: 20,
        traits: [
          { key: "speed", label: "Speed", type: "slider", required: true, min: 1, max: 10, step: 1 },
          { key: "acceleration", label: "Acceleration", type: "slider", required: true, min: 1, max: 10, step: 1 },
          { key: "agility", label: "Agility / change of direction", type: "slider", required: true, min: 1, max: 10, step: 1 },
          { key: "explosiveness", label: "Explosiveness", type: "slider", required: true, min: 1, max: 10, step: 1 },
          {
            key: "athletic_confidence",
            label: "Confidence (athletic assessment)",
            type: "select",
            required: true,
            options: [
              { value: "low", label: "Low", score: 4 },
              { value: "medium", label: "Medium", score: 6 },
              { value: "high", label: "High", score: 8 }
            ]
          }
        ]
      },
      {
        key: "technical",
        label: "Technical",
        weight: 25,
        traits: [
          { key: "technique", label: "Technique fundamentals", type: "slider", required: true, min: 1, max: 10, step: 1 },
          { key: "footwork", label: "Footwork", type: "slider", required: true, min: 1, max: 10, step: 1 },
          { key: "execution", label: "Execution / skill application", type: "slider", required: true, min: 1, max: 10, step: 1 },
          { key: "consistency", label: "Consistency (rep-to-rep)", type: "slider", required: true, min: 1, max: 10, step: 1 },
          {
            key: "technical_confidence",
            label: "Confidence (technical assessment)",
            type: "select",
            required: true,
            options: [
              { value: "low", label: "Low", score: 4 },
              { value: "medium", label: "Medium", score: 6 },
              { value: "high", label: "High", score: 8 }
            ]
          }
        ]
      },
      {
        key: "mental",
        label: "Mental",
        weight: 20,
        traits: [
          { key: "processing", label: "Processing / speed of play", type: "slider", required: true, min: 1, max: 10, step: 1 },
          { key: "decision_making", label: "Decision-making", type: "slider", required: true, min: 1, max: 10, step: 1 },
          { key: "awareness", label: "Situational awareness", type: "slider", required: true, min: 1, max: 10, step: 1 },
          { key: "adaptability", label: "Learning / adaptability", type: "slider", required: true, min: 1, max: 10, step: 1 },
          {
            key: "mental_confidence",
            label: "Confidence (mental assessment)",
            type: "select",
            required: true,
            options: [
              { value: "low", label: "Low", score: 4 },
              { value: "medium", label: "Medium", score: 6 },
              { value: "high", label: "High", score: 8 }
            ]
          }
        ]
      },
      {
        key: "intangibles",
        label: "Intangibles",
        weight: 15,
        traits: [
          { key: "motor", label: "Motor / effort", type: "slider", required: true, min: 1, max: 10, step: 1 },
          { key: "competitiveness", label: "Competitiveness", type: "slider", required: true, min: 1, max: 10, step: 1 },
          { key: "coachability", label: "Coachability indicators", type: "slider", required: true, min: 1, max: 10, step: 1 },
          { key: "leadership", label: "Leadership / communication", type: "slider", required: true, min: 1, max: 10, step: 1 },
          {
            key: "intangibles_projection",
            label: "Projection",
            type: "slider",
            required: false,
            min: 1,
            max: 10,
            step: 1,
            description: "1–4 Developmental · 5–6 Solid · 7–8 High Upside · 9–10 Elite Upside"
          }
        ]
      }
    ]
  };

  // Validate shape to ensure defaults stay in sync with shared schema.
  const parsed = EvaluationFormDefinitionSchema.safeParse(base);
  if (!parsed.success) {
    throw new Error("Default evaluation form definition is invalid");
  }
  return parsed.data;
}

// Evaluator/Admin: fetch the active form for a sport. If none exists, create a default.
evaluationFormsRouter.get("/evaluation-forms/active", requireAuth, requireRole([ROLE.EVALUATOR, ROLE.ADMIN]), async (req, res, next) => {
  try {
    const sport = String(req.query.sport ?? "").trim().toLowerCase();
    if (!sport) return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "sport is required" }));

    const existing = await EvaluationFormModel.findOne({ sport, isActive: true }).sort({ updatedAt: -1 }).lean();
    if (existing) return res.json(existing);

    const def = defaultFormForSport(sport);
    const created = await EvaluationFormModel.create({
      title: def.title,
      sport: def.sport,
      version: def.version,
      isActive: true,
      strengthsPrompt: def.strengthsPrompt,
      improvementsPrompt: def.improvementsPrompt,
      notesHelp: def.notesHelp,
      categories: def.categories
    });
    return res.json(created);
  } catch (err) {
    return next(err);
  }
});

// Admin: list forms
evaluationFormsRouter.get("/admin/evaluation-forms", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
  try {
    const sport = String(req.query.sport ?? "").trim().toLowerCase();
    const activeOnly = String(req.query.activeOnly ?? "").trim() === "1";
    const filter: any = {};
    if (sport) filter.sport = sport;
    if (activeOnly) filter.isActive = true;
    const results = await EvaluationFormModel.find(filter).sort({ updatedAt: -1 }).limit(200).lean();
    return res.json({ results });
  } catch (err) {
    return next(err);
  }
});

// Admin: create form
evaluationFormsRouter.post("/admin/evaluation-forms", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
  const parsed = EvaluationFormCreateSchema.safeParse(req.body);
  if (!parsed.success) return next(zodToBadRequest(parsed.error.flatten()));

  try {
    const created = await EvaluationFormModel.create({
      ...parsed.data,
      sport: String(parsed.data.sport).toLowerCase(),
      categories: parsed.data.categories,
      createdByUserId: new mongoose.Types.ObjectId(req.user!.id)
    });

    if (created.isActive) {
      await EvaluationFormModel.updateMany(
        { _id: { $ne: created._id }, sport: created.sport, isActive: true },
        { $set: { isActive: false } }
      );
    }

    return res.status(201).json(created);
  } catch (err) {
    return next(err);
  }
});

// Admin: update form
evaluationFormsRouter.patch("/admin/evaluation-forms/:id", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid id" }));
  }
  const parsed = EvaluationFormUpdateSchema.safeParse(req.body);
  if (!parsed.success) return next(zodToBadRequest(parsed.error.flatten()));

  try {
    const updated = await EvaluationFormModel.findByIdAndUpdate(
      req.params.id,
      {
        ...parsed.data,
        ...(parsed.data.sport ? { sport: String(parsed.data.sport).toLowerCase() } : {}),
        ...(parsed.data.categories ? { categories: parsed.data.categories } : {})
      },
      { new: true }
    ).lean();
    if (!updated) return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Form not found" }));

    if (updated.isActive) {
      await EvaluationFormModel.updateMany(
        { _id: { $ne: updated._id }, sport: updated.sport, isActive: true },
        { $set: { isActive: false } }
      );
    }

    return res.json(updated);
  } catch (err) {
    return next(err);
  }
});

// Admin: delete form
evaluationFormsRouter.delete("/admin/evaluation-forms/:id", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid id" }));
  }
  try {
    const deleted = await EvaluationFormModel.findByIdAndDelete(req.params.id).lean();
    if (!deleted) return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Form not found" }));
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});


