import { Router } from "express";
import mongoose from "mongoose";
import { ROLE } from "@goeducate/shared";
import { ApiError } from "../http/errors.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { PlayerProfileModel } from "../models/PlayerProfile.js";
import { NotificationModel, NOTIFICATION_TYPE } from "../models/Notification.js";
import { COACH_SUBSCRIPTION_STATUS, UserModel } from "../models/User.js";
import { publishNotificationsChanged } from "../notifications/bus.js";
import { isNotificationEmailConfigured, sendNotificationEmail } from "../email/notifications.js";
import { logAppEvent } from "../util/appEvents.js";
import { APP_EVENT_TYPE } from "../models/AppEvent.js";
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
const contactRequestLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, keyPrefix: "coach_contact_request" });
// Coach: request contact from a player when subscription-gated (creates a notification + best-effort email to player).
contactRouter.post("/contact/player/:userId/request", contactRequestLimiter, requireAuth, requireRole([ROLE.COACH]), async (req, res, next) => {
    try {
        const requester = await UserModel.findById(req.user.id).lean();
        if (!requester)
            return next(new ApiError({ status: 401, code: "UNAUTHORIZED", message: "Not authenticated" }));
        // If coach is subscribed, they already have access to contact info.
        if (requester.subscriptionStatus === COACH_SUBSCRIPTION_STATUS.ACTIVE) {
            return next(new ApiError({ status: 409, code: "ALREADY_ALLOWED", message: "You already have access to contact info." }));
        }
        if (!mongoose.isValidObjectId(req.params.userId)) {
            return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Profile not found" }));
        }
        const playerUserId = new mongoose.Types.ObjectId(req.params.userId);
        const profile = await PlayerProfileModel.findOne({ userId: playerUserId }).lean();
        if (!profile)
            return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Profile not found" }));
        const coachEmail = String(requester.email ?? "").trim();
        const coachName = `${String(requester.firstName ?? "").trim()} ${String(requester.lastName ?? "").trim()}`.trim();
        const coachLabel = coachName ? `${coachName}${coachEmail ? ` (${coachEmail})` : ""}` : coachEmail || "A coach";
        const title = "Coach contact request";
        const message = `${coachLabel} requested to connect with you. If you want to connect, reply to them at ${coachEmail || "their email on file"}.`;
        await NotificationModel.create({
            userId: playerUserId,
            type: NOTIFICATION_TYPE.CONTACT_REQUEST,
            title,
            message,
            href: "/notifications"
        });
        publishNotificationsChanged(String(playerUserId));
        logAppEvent({
            type: APP_EVENT_TYPE.CONTACT_REQUEST,
            user: req.user,
            path: req.path,
            meta: { playerUserId: String(playerUserId) }
        });
        // Best-effort email to the player (uses user.email, not profile contactEmail)
        if (isNotificationEmailConfigured()) {
            const playerUser = await UserModel.findById(playerUserId).lean();
            if (playerUser?.email) {
                void sendNotificationEmail({
                    to: playerUser.email,
                    subject: "GoEducate Talent – Coach contact request",
                    title,
                    message,
                    href: "/notifications"
                }).catch(() => { });
            }
        }
        return res.json({ ok: true });
    }
    catch (err) {
        return next(err);
    }
});
//# sourceMappingURL=contact.js.map