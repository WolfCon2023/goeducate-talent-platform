import { Router } from "express";
import mongoose from "mongoose";
import { PlayerProfileCreateSchema, PlayerProfileUpdateSchema, ROLE } from "@goeducate/shared";
import { ApiError } from "../http/errors.js";
import { zodToBadRequest } from "../http/zod.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { PlayerProfileModel } from "../models/PlayerProfile.js";
import { FilmSubmissionModel } from "../models/FilmSubmission.js";
import { EvaluationReportModel } from "../models/EvaluationReport.js";
function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
export const playerProfilesRouter = Router();
// Player: view own profile
playerProfilesRouter.get("/player-profiles/me", requireAuth, requireRole([ROLE.PLAYER]), async (req, res, next) => {
    try {
        const profile = await PlayerProfileModel.findOne({ userId: req.user.id }).lean();
        if (!profile)
            return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Profile not found" }));
        return res.json(profile);
    }
    catch (err) {
        return next(err);
    }
});
// Player: create profile (one per user)
playerProfilesRouter.post("/player-profiles/me", requireAuth, requireRole([ROLE.PLAYER]), async (req, res, next) => {
    const parsed = PlayerProfileCreateSchema.safeParse({ ...req.body, userId: req.user.id });
    if (!parsed.success)
        return next(zodToBadRequest(parsed.error.flatten()));
    try {
        const userId = new mongoose.Types.ObjectId(req.user.id);
        const existing = await PlayerProfileModel.findOne({ userId }).lean();
        if (existing)
            return next(new ApiError({ status: 409, code: "ALREADY_EXISTS", message: "Profile already exists" }));
        const created = await PlayerProfileModel.create({ ...parsed.data, userId });
        return res.status(201).json(created);
    }
    catch (err) {
        return next(err);
    }
});
// Player: update profile
playerProfilesRouter.put("/player-profiles/me", requireAuth, requireRole([ROLE.PLAYER]), async (req, res, next) => {
    const parsed = PlayerProfileUpdateSchema.safeParse(req.body);
    if (!parsed.success)
        return next(zodToBadRequest(parsed.error.flatten()));
    try {
        const userId = new mongoose.Types.ObjectId(req.user.id);
        const updated = await PlayerProfileModel.findOneAndUpdate({ userId }, { $set: parsed.data }, { new: true, upsert: true });
        return res.json(updated);
    }
    catch (err) {
        return next(err);
    }
});
// Coach/Admin/Evaluator: fetch a player's profile by userId (for name + metadata)
playerProfilesRouter.get("/player-profiles/player/:userId", requireAuth, requireRole([ROLE.COACH, ROLE.ADMIN, ROLE.EVALUATOR]), async (req, res, next) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.params.userId);
        const profile = await PlayerProfileModel.findOne({ userId }).lean();
        if (!profile)
            return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Profile not found" }));
        // Do not include contact fields here (subscription gated separately)
        const { contactEmail, contactPhone, ...rest } = profile;
        return res.json(rest);
    }
    catch (err) {
        return next(err);
    }
});
// Coach/Admin/Evaluator: search players (minimal MVP)
playerProfilesRouter.get("/player-profiles", requireAuth, requireRole([ROLE.COACH, ROLE.ADMIN, ROLE.EVALUATOR]), async (req, res, next) => {
    try {
        const { sport, position, state, city, q, gradYearMin, gradYearMax, heightInMin, heightInMax, weightLbMin, weightLbMax, sort } = req.query;
        const filter = {};
        const sportNorm = String(sport ?? "").trim().toLowerCase();
        const posNorm = String(position ?? "").trim();
        const stateNorm = String(state ?? "").trim().toUpperCase();
        const cityNorm = String(city ?? "").trim();
        if (sportNorm)
            filter.sport = sportNorm;
        if (posNorm)
            filter.position = { $regex: `^${escapeRegex(posNorm)}$`, $options: "i" };
        if (stateNorm)
            filter.state = { $regex: `^${escapeRegex(stateNorm)}$`, $options: "i" };
        if (cityNorm)
            filter.city = { $regex: `^${escapeRegex(cityNorm)}$`, $options: "i" };
        const gyMin = gradYearMin ? Number(gradYearMin) : undefined;
        const gyMax = gradYearMax ? Number(gradYearMax) : undefined;
        if (Number.isFinite(gyMin) || Number.isFinite(gyMax)) {
            filter.gradYear = {
                ...(Number.isFinite(gyMin) ? { $gte: gyMin } : {}),
                ...(Number.isFinite(gyMax) ? { $lte: gyMax } : {})
            };
        }
        const hMin = heightInMin ? Number(heightInMin) : undefined;
        const hMax = heightInMax ? Number(heightInMax) : undefined;
        if (Number.isFinite(hMin) || Number.isFinite(hMax)) {
            filter.heightIn = {
                ...(Number.isFinite(hMin) ? { $gte: hMin } : {}),
                ...(Number.isFinite(hMax) ? { $lte: hMax } : {})
            };
        }
        const wMin = weightLbMin ? Number(weightLbMin) : undefined;
        const wMax = weightLbMax ? Number(weightLbMax) : undefined;
        if (Number.isFinite(wMin) || Number.isFinite(wMax)) {
            filter.weightLb = {
                ...(Number.isFinite(wMin) ? { $gte: wMin } : {}),
                ...(Number.isFinite(wMax) ? { $lte: wMax } : {})
            };
        }
        if (q) {
            filter.$or = [
                { firstName: { $regex: q, $options: "i" } },
                { lastName: { $regex: q, $options: "i" } }
            ];
        }
        const sortKey = String(sort ?? "").trim();
        // Advanced sorts use aggregation to include "latest film" and "latest evaluation"
        if (sortKey === "newest_film" || sortKey === "newest_evaluation" || sortKey === "top_rated") {
            const results = await PlayerProfileModel.aggregate([
                { $match: filter },
                {
                    $lookup: {
                        from: FilmSubmissionModel.collection.name,
                        let: { uid: "$userId" },
                        pipeline: [
                            { $match: { $expr: { $eq: ["$userId", "$$uid"] } } },
                            { $sort: { createdAt: -1 } },
                            { $limit: 1 },
                            { $project: { _id: 0, createdAt: 1 } }
                        ],
                        as: "latestFilm"
                    }
                },
                {
                    $lookup: {
                        from: EvaluationReportModel.collection.name,
                        let: { uid: "$userId" },
                        pipeline: [
                            { $match: { $expr: { $eq: ["$playerUserId", "$$uid"] } } },
                            { $sort: { createdAt: -1 } },
                            { $limit: 1 },
                            { $project: { _id: 0, createdAt: 1, overallGrade: 1 } }
                        ],
                        as: "latestEval"
                    }
                },
                {
                    $addFields: {
                        latestFilmAt: { $arrayElemAt: ["$latestFilm.createdAt", 0] },
                        latestEvaluationAt: { $arrayElemAt: ["$latestEval.createdAt", 0] },
                        latestOverallGrade: { $arrayElemAt: ["$latestEval.overallGrade", 0] }
                    }
                },
                {
                    $sort: sortKey === "newest_film"
                        ? { latestFilmAt: -1, updatedAt: -1 }
                        : sortKey === "newest_evaluation"
                            ? { latestEvaluationAt: -1, updatedAt: -1 }
                            : { latestOverallGrade: -1, latestEvaluationAt: -1, updatedAt: -1 }
                },
                { $limit: 50 },
                { $project: { latestFilm: 0, latestEval: 0 } }
            ]);
            return res.json({ results });
        }
        const sortSpec = sortKey === "gradYear_asc"
            ? { gradYear: 1, lastName: 1, firstName: 1 }
            : sortKey === "gradYear_desc"
                ? { gradYear: -1, lastName: 1, firstName: 1 }
                : sortKey === "lastName_asc"
                    ? { lastName: 1, firstName: 1 }
                    : sortKey === "updated_desc"
                        ? { updatedAt: -1 }
                        : { updatedAt: -1 };
        const results = await PlayerProfileModel.find(filter).sort(sortSpec).limit(50).lean();
        return res.json({ results });
    }
    catch (err) {
        return next(err);
    }
});
//# sourceMappingURL=playerProfiles.js.map