import { Router } from "express";
import mongoose from "mongoose";
import { CoachProfileUpdateSchema, EvaluatorProfileUpdateSchema, PlayerProfileUpdateSchema, ROLE, buildPublicCoachProfile, buildPublicEvaluatorProfile, buildPublicPlayerProfile, computeCoachProfileCompletion, computeEvaluatorProfileCompletion, computePlayerProfileCompletion } from "@goeducate/shared";
import { ApiError } from "../http/errors.js";
import { zodToBadRequest } from "../http/zod.js";
import { maybeAuth, requireAuth } from "../middleware/auth.js";
import { UserModel } from "../models/User.js";
import { PlayerProfileModel } from "../models/PlayerProfile.js";
import { CoachProfileModel } from "../models/CoachProfile.js";
import { EvaluatorProfileModel } from "../models/EvaluatorProfile.js";
import { AUDIT_ACTION, AuditLogModel } from "../models/AuditLog.js";
import { normalizeUsStateToCode } from "../util/usStates.js";
export const profilesRouter = Router();
async function getRequesterForPublic(req) {
    if (!req.user)
        return null;
    const user = await UserModel.findById(new mongoose.Types.ObjectId(req.user.id)).lean();
    if (!user)
        return { id: req.user.id, role: req.user.role, subscriptionStatus: null };
    return { id: String(user._id), role: user.role, subscriptionStatus: user.subscriptionStatus ?? null };
}
// GET /profiles/me
profilesRouter.get("/profiles/me", requireAuth, async (req, res, next) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.user.id);
        const role = req.user.role;
        if (role === ROLE.PLAYER) {
            const profile = await PlayerProfileModel.findOne({ userId }).lean();
            if (!profile)
                return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Profile not found" }));
            const profileCompletion = computePlayerProfileCompletion(profile);
            return res.json({ profile, profileCompletion });
        }
        if (role === ROLE.COACH) {
            // Coaches can start with an empty profile; create on first view to avoid noisy 404s.
            const profile = await CoachProfileModel.findOneAndUpdate({ userId }, { $setOnInsert: { userId } }, { new: true, upsert: true }).lean();
            const profileCompletion = computeCoachProfileCompletion(profile);
            return res.json({ profile, profileCompletion });
        }
        if (role === ROLE.EVALUATOR) {
            // Evaluators can start with an empty profile; create on first view to avoid noisy 404s.
            const profile = await EvaluatorProfileModel.findOneAndUpdate({ userId }, { $setOnInsert: { userId } }, { new: true, upsert: true }).lean();
            const profileCompletion = computeEvaluatorProfileCompletion(profile);
            return res.json({ profile, profileCompletion });
        }
        return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Unsupported role for profiles/me" }));
    }
    catch (err) {
        return next(err);
    }
});
// PUT /profiles/me
profilesRouter.put("/profiles/me", requireAuth, async (req, res, next) => {
    try {
        const actorUserId = new mongoose.Types.ObjectId(req.user.id);
        const role = req.user.role;
        const ip = String(req.ip ?? "");
        const userAgent = String(req.header("user-agent") ?? "");
        if (role === ROLE.PLAYER) {
            const parsed = PlayerProfileUpdateSchema.safeParse({ ...req.body, userId: req.user.id });
            if (!parsed.success)
                return next(zodToBadRequest(parsed.error.flatten()));
            const before = await PlayerProfileModel.findOne({ userId: actorUserId }).lean();
            const updateDoc = { ...parsed.data };
            delete updateDoc.userId;
            const updated = await PlayerProfileModel.findOneAndUpdate({ userId: actorUserId }, { $set: updateDoc, $setOnInsert: { userId: actorUserId } }, { new: true, upsert: true }).lean();
            await AuditLogModel.create({
                actorUserId,
                targetUserId: actorUserId,
                action: AUDIT_ACTION.PROFILE_UPDATED,
                entityType: "playerProfile",
                before: before ?? null,
                after: updated ?? null,
                ip: ip || undefined,
                userAgent: userAgent || undefined
            });
            const beforeVis = before?.isProfilePublic ?? false;
            const afterVis = updated?.isProfilePublic ?? false;
            if (updated && beforeVis !== afterVis) {
                await AuditLogModel.create({
                    actorUserId,
                    targetUserId: actorUserId,
                    action: AUDIT_ACTION.PROFILE_VISIBILITY_CHANGED,
                    entityType: "playerProfile",
                    before: { isProfilePublic: beforeVis },
                    after: { isProfilePublic: afterVis },
                    ip: ip || undefined,
                    userAgent: userAgent || undefined
                });
            }
            const profileCompletion = computePlayerProfileCompletion(updated);
            return res.json({ profile: updated, profileCompletion });
        }
        if (role === ROLE.COACH) {
            const parsed = CoachProfileUpdateSchema.safeParse({ ...req.body, userId: req.user.id });
            if (!parsed.success)
                return next(zodToBadRequest(parsed.error.flatten()));
            const before = await CoachProfileModel.findOne({ userId: actorUserId }).lean();
            const updateDoc = { ...parsed.data };
            delete updateDoc.userId;
            // Backwards compatible: if state isn't provided, attempt to parse from institutionLocation.
            if (!updateDoc.state && updateDoc.institutionLocation) {
                const loc = String(updateDoc.institutionLocation ?? "");
                const parts = loc.split(",").map((s) => s.trim()).filter(Boolean);
                const tail = parts.length ? parts[parts.length - 1] : loc;
                const code = normalizeUsStateToCode(tail);
                if (code)
                    updateDoc.state = code;
                if (!updateDoc.city && parts.length >= 2)
                    updateDoc.city = parts[0];
            }
            const updated = await CoachProfileModel.findOneAndUpdate({ userId: actorUserId }, { $set: updateDoc, $setOnInsert: { userId: actorUserId } }, { new: true, upsert: true }).lean();
            await AuditLogModel.create({
                actorUserId,
                targetUserId: actorUserId,
                action: AUDIT_ACTION.PROFILE_UPDATED,
                entityType: "coachProfile",
                before: before ?? null,
                after: updated ?? null,
                ip: ip || undefined,
                userAgent: userAgent || undefined
            });
            const beforeVis = before?.isProfilePublic ?? true;
            const afterVis = updated?.isProfilePublic ?? true;
            if (updated && beforeVis !== afterVis) {
                await AuditLogModel.create({
                    actorUserId,
                    targetUserId: actorUserId,
                    action: AUDIT_ACTION.PROFILE_VISIBILITY_CHANGED,
                    entityType: "coachProfile",
                    before: { isProfilePublic: beforeVis },
                    after: { isProfilePublic: afterVis },
                    ip: ip || undefined,
                    userAgent: userAgent || undefined
                });
            }
            const profileCompletion = computeCoachProfileCompletion(updated);
            return res.json({ profile: updated, profileCompletion });
        }
        if (role === ROLE.EVALUATOR) {
            const parsed = EvaluatorProfileUpdateSchema.safeParse({ ...req.body, userId: req.user.id });
            if (!parsed.success)
                return next(zodToBadRequest(parsed.error.flatten()));
            const before = await EvaluatorProfileModel.findOne({ userId: actorUserId }).lean();
            const updateDoc = { ...parsed.data };
            delete updateDoc.userId;
            // Backwards compatible: if state isn't provided, attempt to parse from location ("City, State"/"City, ST").
            if (!updateDoc.state && updateDoc.location) {
                const loc = String(updateDoc.location ?? "");
                const parts = loc.split(",").map((s) => s.trim()).filter(Boolean);
                const tail = parts.length ? parts[parts.length - 1] : loc;
                const code = normalizeUsStateToCode(tail);
                if (code)
                    updateDoc.state = code;
                if (!updateDoc.city && parts.length >= 2)
                    updateDoc.city = parts[0];
            }
            const updated = await EvaluatorProfileModel.findOneAndUpdate({ userId: actorUserId }, { $set: updateDoc, $setOnInsert: { userId: actorUserId } }, { new: true, upsert: true }).lean();
            await AuditLogModel.create({
                actorUserId,
                targetUserId: actorUserId,
                action: AUDIT_ACTION.PROFILE_UPDATED,
                entityType: "evaluatorProfile",
                before: before ?? null,
                after: updated ?? null,
                ip: ip || undefined,
                userAgent: userAgent || undefined
            });
            const beforeVis = before?.isProfilePublic ?? true;
            const afterVis = updated?.isProfilePublic ?? true;
            if (updated && beforeVis !== afterVis) {
                await AuditLogModel.create({
                    actorUserId,
                    targetUserId: actorUserId,
                    action: AUDIT_ACTION.PROFILE_VISIBILITY_CHANGED,
                    entityType: "evaluatorProfile",
                    before: { isProfilePublic: beforeVis },
                    after: { isProfilePublic: afterVis },
                    ip: ip || undefined,
                    userAgent: userAgent || undefined
                });
            }
            const profileCompletion = computeEvaluatorProfileCompletion(updated);
            return res.json({ profile: updated, profileCompletion });
        }
        return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Unsupported role for profiles/me" }));
    }
    catch (err) {
        return next(err);
    }
});
// Public profile endpoints (auth optional)
profilesRouter.get("/profiles/player/:userId", maybeAuth, async (req, res, next) => {
    try {
        const profileUserId = new mongoose.Types.ObjectId(req.params.userId);
        const profile = await PlayerProfileModel.findOne({ userId: profileUserId }).lean();
        if (!profile)
            return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Profile not found" }));
        const requester = await getRequesterForPublic(req);
        const shaped = buildPublicPlayerProfile({ ...profile, userId: String(profile.userId) }, requester);
        if (!shaped)
            return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Profile not found" }));
        return res.json(shaped);
    }
    catch (err) {
        return next(err);
    }
});
profilesRouter.get("/profiles/coach/:userId", maybeAuth, async (req, res, next) => {
    try {
        const profileUserId = new mongoose.Types.ObjectId(req.params.userId);
        const profile = await CoachProfileModel.findOne({ userId: profileUserId }).lean();
        if (!profile)
            return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Profile not found" }));
        const requester = await getRequesterForPublic(req);
        const shaped = buildPublicCoachProfile({ ...profile, userId: String(profile.userId) }, requester);
        if (!shaped)
            return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Profile not found" }));
        return res.json(shaped);
    }
    catch (err) {
        return next(err);
    }
});
profilesRouter.get("/profiles/evaluator/:userId", maybeAuth, async (req, res, next) => {
    try {
        const profileUserId = new mongoose.Types.ObjectId(req.params.userId);
        const profile = await EvaluatorProfileModel.findOne({ userId: profileUserId }).lean();
        if (!profile)
            return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Profile not found" }));
        const requester = await getRequesterForPublic(req);
        const shaped = buildPublicEvaluatorProfile({ ...profile, userId: String(profile.userId) }, requester);
        if (!shaped)
            return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Profile not found" }));
        return res.json(shaped);
    }
    catch (err) {
        return next(err);
    }
});
//# sourceMappingURL=profiles.js.map