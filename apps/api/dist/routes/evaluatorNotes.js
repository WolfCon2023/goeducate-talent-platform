import { Router } from "express";
import mongoose from "mongoose";
import crypto from "node:crypto";
import { ROLE } from "@goeducate/shared";
import { ApiError } from "../http/errors.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { EvaluatorNotesDraftModel } from "../models/EvaluatorNotesDraft.js";
export const evaluatorNotesRouter = Router();
function norm(v) {
    return String(v ?? "").trim();
}
function normalizeSport(input) {
    const s = String(input ?? "").trim().toLowerCase();
    return s === "football" || s === "basketball" || s === "volleyball" || s === "soccer" || s === "track" || s === "other"
        ? s
        : "other";
}
// List recent drafts for the logged-in evaluator.
evaluatorNotesRouter.get("/evaluator/notes/drafts", requireAuth, requireRole([ROLE.EVALUATOR, ROLE.ADMIN]), async (req, res, next) => {
    try {
        const evaluatorUserId = new mongoose.Types.ObjectId(req.user.id);
        const key = norm(req.query.key);
        const qText = norm(req.query.q);
        const limit = Math.max(1, Math.min(50, req.query.limit ? Number(req.query.limit) : 20));
        const q = { evaluatorUserId };
        if (key)
            q.key = key;
        if (qText) {
            q.$or = [
                { title: { $regex: qText, $options: "i" } },
                { key: { $regex: qText, $options: "i" } }
            ];
        }
        const items = await EvaluatorNotesDraftModel.find(q).sort({ updatedAt: -1 }).limit(limit).lean();
        return res.json({
            items: items.map((d) => ({
                _id: String(d._id),
                evaluatorUserId: String(d.evaluatorUserId),
                key: d.key,
                title: d.title ?? null,
                sport: d.sport,
                filmSubmissionId: d.filmSubmissionId ? String(d.filmSubmissionId) : null,
                formId: d.formId ? String(d.formId) : null,
                payload: d.payload,
                createdAt: d.createdAt,
                updatedAt: d.updatedAt
            }))
        });
    }
    catch (err) {
        return next(err);
    }
});
// Upsert draft for the logged-in evaluator.
evaluatorNotesRouter.put("/evaluator/notes/drafts", requireAuth, requireRole([ROLE.EVALUATOR, ROLE.ADMIN]), async (req, res, next) => {
    try {
        const evaluatorUserId = new mongoose.Types.ObjectId(req.user.id);
        const key = norm(req.body?.key);
        if (!key)
            return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "key is required" }));
        const title = norm(req.body?.title) || undefined;
        const sport = normalizeSport(req.body?.sport);
        const filmSubmissionIdRaw = norm(req.body?.filmSubmissionId);
        const formIdRaw = norm(req.body?.formId);
        const payload = req.body?.payload;
        if (!payload || typeof payload !== "object") {
            return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "payload is required" }));
        }
        const filmSubmissionId = filmSubmissionIdRaw && mongoose.isValidObjectId(filmSubmissionIdRaw) ? new mongoose.Types.ObjectId(filmSubmissionIdRaw) : undefined;
        const formId = formIdRaw && mongoose.isValidObjectId(formIdRaw) ? new mongoose.Types.ObjectId(formIdRaw) : undefined;
        const updated = await EvaluatorNotesDraftModel.findOneAndUpdate({ evaluatorUserId, key }, {
            $set: {
                ...(title ? { title } : {}),
                sport,
                ...(filmSubmissionId ? { filmSubmissionId } : { filmSubmissionId: undefined }),
                ...(formId ? { formId } : { formId: undefined }),
                payload
            },
            $setOnInsert: { evaluatorUserId, key }
        }, { new: true, upsert: true }).lean();
        return res.json({
            _id: String(updated._id),
            evaluatorUserId: String(updated.evaluatorUserId),
            key: updated.key,
            title: updated.title ?? null,
            sport: updated.sport,
            filmSubmissionId: updated.filmSubmissionId ? String(updated.filmSubmissionId) : null,
            formId: updated.formId ? String(updated.formId) : null,
            payload: updated.payload,
            createdAt: updated.createdAt,
            updatedAt: updated.updatedAt
        });
    }
    catch (err) {
        return next(err);
    }
});
// Save a copy under a new key with a human-friendly title (for event workflows).
evaluatorNotesRouter.post("/evaluator/notes/drafts/save-as", requireAuth, requireRole([ROLE.EVALUATOR, ROLE.ADMIN]), async (req, res, next) => {
    try {
        const evaluatorUserId = new mongoose.Types.ObjectId(req.user.id);
        const titleRaw = norm(req.body?.title);
        if (!titleRaw)
            return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "title is required" }));
        const title = titleRaw.slice(0, 120);
        const sport = normalizeSport(req.body?.sport);
        const filmSubmissionIdRaw = norm(req.body?.filmSubmissionId);
        const formIdRaw = norm(req.body?.formId);
        const payload = req.body?.payload;
        if (!payload || typeof payload !== "object") {
            return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "payload is required" }));
        }
        const filmSubmissionId = filmSubmissionIdRaw && mongoose.isValidObjectId(filmSubmissionIdRaw) ? new mongoose.Types.ObjectId(filmSubmissionIdRaw) : undefined;
        const formId = formIdRaw && mongoose.isValidObjectId(formIdRaw) ? new mongoose.Types.ObjectId(formIdRaw) : undefined;
        const uuid = crypto.randomUUID();
        const key = `goeducate.evalNotesDraft:v1:named:${uuid}`;
        const created = await EvaluatorNotesDraftModel.create({
            evaluatorUserId,
            key,
            title,
            sport,
            ...(filmSubmissionId ? { filmSubmissionId } : {}),
            ...(formId ? { formId } : {}),
            payload
        });
        return res.status(201).json({
            _id: String(created._id),
            evaluatorUserId: String(created.evaluatorUserId),
            key: created.key,
            title: created.title ?? null,
            sport: created.sport,
            filmSubmissionId: created.filmSubmissionId ? String(created.filmSubmissionId) : null,
            formId: created.formId ? String(created.formId) : null,
            payload: created.payload,
            createdAt: created.createdAt,
            updatedAt: created.updatedAt
        });
    }
    catch (err) {
        return next(err);
    }
});
// Delete a draft (optional convenience).
evaluatorNotesRouter.delete("/evaluator/notes/drafts", requireAuth, requireRole([ROLE.EVALUATOR, ROLE.ADMIN]), async (req, res, next) => {
    try {
        const evaluatorUserId = new mongoose.Types.ObjectId(req.user.id);
        const key = norm(req.query.key);
        if (!key)
            return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "key is required" }));
        await EvaluatorNotesDraftModel.deleteOne({ evaluatorUserId, key });
        return res.status(204).send();
    }
    catch (err) {
        return next(err);
    }
});
//# sourceMappingURL=evaluatorNotes.js.map