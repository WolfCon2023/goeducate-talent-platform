import { Router } from "express";
import { ROLE } from "@goeducate/shared";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { PlayerProfileModel } from "../models/PlayerProfile.js";
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
//# sourceMappingURL=search.js.map