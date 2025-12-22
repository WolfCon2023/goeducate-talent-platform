import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";

import { ROLE } from "@goeducate/shared";

import { ApiError } from "../http/errors.js";
import { zodToBadRequest } from "../http/zod.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { SavedSearchModel } from "../models/SavedSearch.js";

export const savedSearchesRouter = Router();

const SavedSearchCreateSchema = z.object({
  name: z.string().min(2).max(80),
  params: z.record(z.string(), z.string()).default({})
});

savedSearchesRouter.get("/coach/saved-searches", requireAuth, requireRole([ROLE.COACH]), async (req, res, next) => {
  try {
    const coachUserId = new mongoose.Types.ObjectId(req.user!.id);
    const rows = await SavedSearchModel.find({ coachUserId }).sort({ createdAt: -1 }).limit(50).lean();
    return res.json({
      results: rows.map((r) => ({ id: String(r._id), name: r.name, params: r.params, createdAt: r.createdAt?.toISOString?.() }))
    });
  } catch (err) {
    return next(err);
  }
});

savedSearchesRouter.post("/coach/saved-searches", requireAuth, requireRole([ROLE.COACH]), async (req, res, next) => {
  const parsed = SavedSearchCreateSchema.safeParse(req.body);
  if (!parsed.success) return next(zodToBadRequest(parsed.error.flatten()));
  try {
    const coachUserId = new mongoose.Types.ObjectId(req.user!.id);
    const name = parsed.data.name.trim();
    const existing = await SavedSearchModel.findOne({ coachUserId, name }).lean();
    if (existing) {
      return next(new ApiError({ status: 409, code: "NAME_TAKEN", message: "Saved search name already exists" }));
    }
    const created = await SavedSearchModel.create({ coachUserId, name, params: parsed.data.params });
    return res.status(201).json({ savedSearch: { id: String(created._id), name: created.name, params: created.params } });
  } catch (err) {
    return next(err);
  }
});

savedSearchesRouter.delete("/coach/saved-searches/:id", requireAuth, requireRole([ROLE.COACH]), async (req, res, next) => {
  try {
    const id = String(req.params.id ?? "").trim();
    if (!mongoose.isValidObjectId(id)) return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Saved search not found" }));
    const coachUserId = new mongoose.Types.ObjectId(req.user!.id);
    const result = await SavedSearchModel.deleteOne({ _id: new mongoose.Types.ObjectId(id), coachUserId });
    if (!result.deletedCount) return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Saved search not found" }));
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});


