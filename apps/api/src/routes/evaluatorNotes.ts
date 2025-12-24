import { Router } from "express";
import mongoose from "mongoose";

import { ROLE } from "@goeducate/shared";

import { ApiError } from "../http/errors.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { EvaluatorNotesDraftModel } from "../models/EvaluatorNotesDraft.js";

export const evaluatorNotesRouter = Router();

function norm(v: unknown) {
  return String(v ?? "").trim();
}

function normalizeSport(input: unknown) {
  const s = String(input ?? "").trim().toLowerCase();
  return s === "football" || s === "basketball" || s === "volleyball" || s === "soccer" || s === "track" || s === "other"
    ? s
    : "other";
}

// List recent drafts for the logged-in evaluator.
evaluatorNotesRouter.get("/evaluator/notes/drafts", requireAuth, requireRole([ROLE.EVALUATOR, ROLE.ADMIN]), async (req, res, next) => {
  try {
    const evaluatorUserId = new mongoose.Types.ObjectId(req.user!.id);
    const key = norm(req.query.key);
    const limit = Math.max(1, Math.min(50, req.query.limit ? Number(req.query.limit) : 20));

    const q: any = { evaluatorUserId };
    if (key) q.key = key;

    const items = await EvaluatorNotesDraftModel.find(q).sort({ updatedAt: -1 }).limit(limit).lean();
    return res.json({
      items: items.map((d: any) => ({
        _id: String(d._id),
        evaluatorUserId: String(d.evaluatorUserId),
        key: d.key,
        sport: d.sport,
        filmSubmissionId: d.filmSubmissionId ? String(d.filmSubmissionId) : null,
        formId: d.formId ? String(d.formId) : null,
        payload: d.payload,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt
      }))
    });
  } catch (err) {
    return next(err);
  }
});

// Upsert draft for the logged-in evaluator.
evaluatorNotesRouter.put("/evaluator/notes/drafts", requireAuth, requireRole([ROLE.EVALUATOR, ROLE.ADMIN]), async (req, res, next) => {
  try {
    const evaluatorUserId = new mongoose.Types.ObjectId(req.user!.id);
    const key = norm((req.body as any)?.key);
    if (!key) return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "key is required" }));

    const sport = normalizeSport((req.body as any)?.sport);
    const filmSubmissionIdRaw = norm((req.body as any)?.filmSubmissionId);
    const formIdRaw = norm((req.body as any)?.formId);
    const payload = (req.body as any)?.payload;
    if (!payload || typeof payload !== "object") {
      return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "payload is required" }));
    }

    const filmSubmissionId = filmSubmissionIdRaw && mongoose.isValidObjectId(filmSubmissionIdRaw) ? new mongoose.Types.ObjectId(filmSubmissionIdRaw) : undefined;
    const formId = formIdRaw && mongoose.isValidObjectId(formIdRaw) ? new mongoose.Types.ObjectId(formIdRaw) : undefined;

    const updated = await EvaluatorNotesDraftModel.findOneAndUpdate(
      { evaluatorUserId, key },
      {
        $set: {
          sport,
          ...(filmSubmissionId ? { filmSubmissionId } : { filmSubmissionId: undefined }),
          ...(formId ? { formId } : { formId: undefined }),
          payload
        },
        $setOnInsert: { evaluatorUserId, key }
      },
      { new: true, upsert: true }
    ).lean();

    return res.json({
      _id: String((updated as any)._id),
      evaluatorUserId: String((updated as any).evaluatorUserId),
      key: (updated as any).key,
      sport: (updated as any).sport,
      filmSubmissionId: (updated as any).filmSubmissionId ? String((updated as any).filmSubmissionId) : null,
      formId: (updated as any).formId ? String((updated as any).formId) : null,
      payload: (updated as any).payload,
      createdAt: (updated as any).createdAt,
      updatedAt: (updated as any).updatedAt
    });
  } catch (err) {
    return next(err);
  }
});

// Delete a draft (optional convenience).
evaluatorNotesRouter.delete("/evaluator/notes/drafts", requireAuth, requireRole([ROLE.EVALUATOR, ROLE.ADMIN]), async (req, res, next) => {
  try {
    const evaluatorUserId = new mongoose.Types.ObjectId(req.user!.id);
    const key = norm(req.query.key);
    if (!key) return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "key is required" }));
    await EvaluatorNotesDraftModel.deleteOne({ evaluatorUserId, key });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});


