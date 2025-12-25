import mongoose from "mongoose";
import { DailyActiveUserModel } from "../models/DailyActiveUser.js";
function dayKeyUtc(d) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}
export async function trackDailyActive(req, _res, next) {
    try {
        if (!req.user?.id)
            return next();
        // Avoid noise from health checks/root.
        const p = String(req.path ?? "");
        if (p === "/" || p.startsWith("/health") || p.startsWith("/webhooks/"))
            return next();
        if (!mongoose.isValidObjectId(req.user.id))
            return next();
        const now = new Date();
        const day = dayKeyUtc(now);
        const userId = new mongoose.Types.ObjectId(req.user.id);
        // Upsert once per user/day; keep firstSeenAt stable and bump lastSeenAt.
        void DailyActiveUserModel.updateOne({ userId, day }, {
            $setOnInsert: { userId, role: req.user.role, day, firstSeenAt: now },
            $set: { role: req.user.role },
            $max: { lastSeenAt: now }
        }, { upsert: true }).catch(() => { });
    }
    catch {
        // best-effort only
    }
    return next();
}
//# sourceMappingURL=activity.js.map