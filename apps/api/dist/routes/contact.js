import { Router } from "express";
import mongoose from "mongoose";
import { ROLE } from "@goeducate/shared";
import { ApiError } from "../http/errors.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { PlayerProfileModel } from "../models/PlayerProfile.js";
import { COACH_SUBSCRIPTION_STATUS, UserModel } from "../models/User.js";
export const contactRouter = Router();
// Coach/Admin: fetch a player's contact info (subscription gated for coaches)
contactRouter.get("/contact/player/:userId", requireAuth, requireRole([ROLE.COACH, ROLE.ADMIN]), async (req, res, next) => {
    try {
        const requester = await UserModel.findById(req.user.id).lean();
        if (!requester)
            return next(new ApiError({ status: 401, code: "UNAUTHORIZED", message: "Not authenticated" }));
        if (requester.role === ROLE.COACH && requester.subscriptionStatus !== COACH_SUBSCRIPTION_STATUS.ACTIVE) {
            return next(new ApiError({ status: 402, code: "PAYMENT_REQUIRED", message: "Subscription required" }));
        }
        const userId = new mongoose.Types.ObjectId(req.params.userId);
        const profile = await PlayerProfileModel.findOne({ userId }).lean();
        if (!profile)
            return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Profile not found" }));
        return res.json({
            contactEmail: profile.contactEmail ?? null,
            contactPhone: profile.contactPhone ?? null
        });
    }
    catch (err) {
        return next(err);
    }
});
//# sourceMappingURL=contact.js.map