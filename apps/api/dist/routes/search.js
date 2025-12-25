import { Router } from "express";
import { ROLE } from "@goeducate/shared";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { PlayerProfileModel } from "../models/PlayerProfile.js";
import { EvaluationReportModel } from "../models/EvaluationReport.js";
import { normalizeUsStateToCode, US_STATES } from "../util/usStates.js";
import { logAppEvent } from "../util/appEvents.js";
import { APP_EVENT_TYPE } from "../models/AppEvent.js";
function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
export const searchRouter = Router();
// MVP search for public player profiles only.
// GET /search/players
searchRouter.get("/search/players", requireAuth, requireRole([ROLE.COACH, ROLE.ADMIN, ROLE.EVALUATOR]), async (req, res, next) => {
    try {
        const { q, sport, position, state, gradYearMin, gradYearMax, limit } = req.query;
        const filter = { isProfilePublic: true };
        if (req.user?.role === ROLE.COACH) {
            logAppEvent({
                type: APP_EVENT_TYPE.COACH_SEARCH_PLAYERS,
                user: req.user,
                path: req.path,
                meta: { q: q ?? null, sport: sport ?? null, position: position ?? null, state: state ?? null, gradYearMin: gradYearMin ?? null, gradYearMax: gradYearMax ?? null }
            });
        }
        const sportNorm = String(sport ?? "").trim().toLowerCase();
        const posNorm = String(position ?? "").trim();
        const stateNorm = String(state ?? "").trim().toUpperCase();
        if (sportNorm)
            filter.sport = sportNorm;
        if (posNorm)
            filter.position = { $regex: `^${escapeRegex(posNorm)}$`, $options: "i" };
        if (stateNorm)
            filter.state = { $regex: `^${escapeRegex(stateNorm)}$`, $options: "i" };
        const gyMin = gradYearMin ? Number(gradYearMin) : undefined;
        const gyMax = gradYearMax ? Number(gradYearMax) : undefined;
        if (Number.isFinite(gyMin) || Number.isFinite(gyMax)) {
            filter.gradYear = {
                ...(Number.isFinite(gyMin) ? { $gte: gyMin } : {}),
                ...(Number.isFinite(gyMax) ? { $lte: gyMax } : {})
            };
        }
        if (q) {
            const qNorm = String(q).trim();
            if (qNorm) {
                filter.$or = [
                    { firstName: { $regex: qNorm, $options: "i" } },
                    { lastName: { $regex: qNorm, $options: "i" } },
                    { position: { $regex: qNorm, $options: "i" } },
                    { city: { $regex: qNorm, $options: "i" } },
                    { school: { $regex: qNorm, $options: "i" } }
                ];
            }
        }
        const lim = Math.max(1, Math.min(50, limit ? Number(limit) : 25));
        const results = await PlayerProfileModel.find(filter)
            .sort({ updatedAt: -1 })
            .limit(lim)
            .select({
            _id: 0,
            userId: 1,
            firstName: 1,
            lastName: 1,
            sport: 1,
            position: 1,
            gradYear: 1,
            school: 1,
            city: 1,
            state: 1,
            highlightPhotoUrl: 1
        })
            .lean();
        return res.json({
            results: results.map((r) => ({ ...r, userId: String(r.userId) }))
        });
    }
    catch (err) {
        return next(err);
    }
});
// Coach/Admin: player distribution map (counts by US state) for PUBLIC player profiles only.
searchRouter.get("/search/players/by-state", requireAuth, requireRole([ROLE.COACH, ROLE.ADMIN]), async (_req, res, next) => {
    try {
        const raw = await PlayerProfileModel.aggregate([
            { $match: { isProfilePublic: true } },
            {
                $project: {
                    state: {
                        $cond: [{ $or: [{ $eq: ["$state", null] }, { $eq: ["$state", ""] }] }, null, "$state"]
                    }
                }
            },
            { $group: { _id: "$state", count: { $sum: 1 } } }
        ]);
        const counts = new Map();
        let unknown = 0;
        for (const r of raw) {
            const code = normalizeUsStateToCode(r._id);
            if (!code) {
                unknown += Number(r.count) || 0;
                continue;
            }
            counts.set(code, (counts.get(code) ?? 0) + (Number(r.count) || 0));
        }
        const byState = Array.from(counts.entries())
            .map(([code, count]) => ({ code, name: US_STATES.find((s) => s.code === code)?.name ?? code, count }))
            .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
        return res.json({ byState, unknownCount: unknown });
    }
    catch (err) {
        return next(err);
    }
});
// Coach/Admin: list public players in a given state (includes latest evaluation grade)
searchRouter.get("/search/players/by-state/:state", requireAuth, requireRole([ROLE.COACH, ROLE.ADMIN]), async (req, res, next) => {
    try {
        const stateParam = String(req.params.state ?? "").trim();
        const code = normalizeUsStateToCode(stateParam);
        if (!code) {
            return next(new Error("Valid US state is required"));
        }
        const stateName = US_STATES.find((s) => s.code === code)?.name ?? code;
        const limitRaw = Number(req.query.limit ?? 25);
        const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : 25;
        const skipRaw = Number(req.query.skip ?? 0);
        const skip = Number.isFinite(skipRaw) ? Math.max(0, Math.min(50_000, skipRaw)) : 0;
        const or = [
            { state: { $regex: `^${escapeRegex(code)}$`, $options: "i" } },
            { state: { $regex: `^${escapeRegex(stateName)}$`, $options: "i" } }
        ];
        const match = { isProfilePublic: true, $or: or };
        const [total, players] = await Promise.all([
            PlayerProfileModel.countDocuments(match),
            PlayerProfileModel.aggregate([
                { $match: match },
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
                        latestEvaluationAt: { $arrayElemAt: ["$latestEval.createdAt", 0] },
                        latestOverallGrade: { $arrayElemAt: ["$latestEval.overallGrade", 0] }
                    }
                },
                { $sort: { lastName: 1, firstName: 1, updatedAt: -1 } },
                { $skip: skip },
                { $limit: limit },
                {
                    $project: {
                        _id: 0,
                        userId: 1,
                        firstName: 1,
                        lastName: 1,
                        sport: 1,
                        position: 1,
                        city: 1,
                        state: 1,
                        latestOverallGrade: 1,
                        latestEvaluationAt: 1,
                        highlightPhotoUrl: 1
                    }
                }
            ])
        ]);
        return res.json({
            state: { code, name: stateName },
            total,
            skip,
            limit,
            players: players.map((p) => ({ ...p, userId: String(p.userId) }))
        });
    }
    catch (err) {
        return next(err);
    }
});
//# sourceMappingURL=search.js.map