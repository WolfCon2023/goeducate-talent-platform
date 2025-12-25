import { Router } from "express";
import mongoose from "mongoose";
import { CreateConversationSchema, ROLE, SendMessageSchema } from "@goeducate/shared";
import { ApiError } from "../http/errors.js";
import { zodToBadRequest } from "../http/zod.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ConversationModel, conversationKeyFor } from "../models/Conversation.js";
import { MessageModel } from "../models/Message.js";
import { UserModel } from "../models/User.js";
export const messagesRouter = Router();
function ensureObjectId(id) {
    if (!mongoose.isValidObjectId(id)) {
        throw new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid id" });
    }
    return new mongoose.Types.ObjectId(id);
}
function preview(text) {
    return String(text ?? "").trim().slice(0, 240);
}
// List your conversations
messagesRouter.get("/messages/conversations", requireAuth, requireRole([ROLE.PLAYER, ROLE.COACH, ROLE.ADMIN, ROLE.EVALUATOR]), async (req, res, next) => {
    try {
        const userId = ensureObjectId(req.user.id);
        const limitRaw = Number(req.query.limit ?? 50);
        const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : 50;
        const convs = await ConversationModel.find({ participantUserIds: userId })
            .sort({ lastMessageAt: -1, updatedAt: -1 })
            .limit(limit)
            .lean();
        const otherUserIds = convs
            .map((c) => (c.participantUserIds ?? []).find((p) => String(p) !== String(userId)))
            .filter(Boolean)
            .map((x) => String(x));
        const users = await UserModel.find({ _id: { $in: otherUserIds } }).lean();
        const userById = new Map(users.map((u) => [String(u._id), u]));
        return res.json({
            conversations: convs.map((c) => {
                const otherId = String((c.participantUserIds ?? []).find((p) => String(p) !== String(userId)) ?? "");
                const other = otherId ? userById.get(otherId) : null;
                const unread = (c.unreadCounts ?? {})[String(userId)] ?? 0;
                return {
                    id: String(c._id),
                    status: c.status,
                    lastMessageAt: c.lastMessageAt ?? null,
                    lastMessagePreview: c.lastMessagePreview ?? null,
                    unread,
                    other: other
                        ? { id: String(other._id), email: other.email, role: other.role, displayName: other.firstName ? `${other.firstName} ${other.lastName ?? ""}`.trim() : other.email }
                        : { id: otherId || null }
                };
            })
        });
    }
    catch (err) {
        return next(err);
    }
});
// Create a new conversation request (1:1) with an initial message.
messagesRouter.post("/messages/conversations", requireAuth, requireRole([ROLE.PLAYER, ROLE.COACH]), async (req, res, next) => {
    const parsed = CreateConversationSchema.safeParse(req.body);
    if (!parsed.success)
        return next(zodToBadRequest(parsed.error.flatten()));
    try {
        const actorId = ensureObjectId(req.user.id);
        const recipientId = ensureObjectId(parsed.data.recipientUserId);
        if (String(actorId) === String(recipientId)) {
            return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Cannot message yourself" }));
        }
        const key = conversationKeyFor(String(actorId), String(recipientId));
        let conv = await ConversationModel.findOne({ participantKey: key }).lean();
        if (!conv) {
            conv = await ConversationModel.create({
                participantUserIds: [actorId, recipientId],
                participantKey: key,
                createdByUserId: actorId,
                status: "pending",
                unreadCounts: { [String(actorId)]: 0, [String(recipientId)]: 1 },
                lastMessageAt: new Date(),
                lastMessagePreview: preview(parsed.data.message)
            }).then((d) => d.toObject());
        }
        else {
            // If conversation exists, treat as send message (subject to status rules in send endpoint).
        }
        await MessageModel.create({
            conversationId: conv._id,
            senderUserId: actorId,
            body: parsed.data.message
        });
        return res.json({ ok: true, conversationId: String(conv._id) });
    }
    catch (err) {
        // Handle duplicate participantKey race
        if (err?.code === 11000) {
            return res.status(409).json({ error: { code: "CONVERSATION_EXISTS", message: "Conversation already exists" } });
        }
        return next(err);
    }
});
// Accept a conversation request
messagesRouter.post("/messages/conversations/:id/accept", requireAuth, requireRole([ROLE.PLAYER, ROLE.COACH]), async (req, res, next) => {
    try {
        const userId = ensureObjectId(req.user.id);
        const convId = ensureObjectId(req.params.id);
        const conv = await ConversationModel.findById(convId);
        if (!conv)
            return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Conversation not found" }));
        if (!(conv.participantUserIds ?? []).some((p) => String(p) === String(userId))) {
            return next(new ApiError({ status: 403, code: "FORBIDDEN", message: "Not a participant" }));
        }
        if (conv.status === "blocked")
            return next(new ApiError({ status: 409, code: "BLOCKED", message: "Conversation is blocked" }));
        conv.status = "accepted";
        await conv.save();
        return res.json({ ok: true });
    }
    catch (err) {
        return next(err);
    }
});
// Decline a conversation request
messagesRouter.post("/messages/conversations/:id/decline", requireAuth, requireRole([ROLE.PLAYER, ROLE.COACH]), async (req, res, next) => {
    try {
        const userId = ensureObjectId(req.user.id);
        const convId = ensureObjectId(req.params.id);
        const conv = await ConversationModel.findById(convId);
        if (!conv)
            return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Conversation not found" }));
        if (!(conv.participantUserIds ?? []).some((p) => String(p) === String(userId))) {
            return next(new ApiError({ status: 403, code: "FORBIDDEN", message: "Not a participant" }));
        }
        conv.status = "declined";
        await conv.save();
        return res.json({ ok: true });
    }
    catch (err) {
        return next(err);
    }
});
// List messages in a conversation
messagesRouter.get("/messages/conversations/:id", requireAuth, requireRole([ROLE.PLAYER, ROLE.COACH, ROLE.ADMIN, ROLE.EVALUATOR]), async (req, res, next) => {
    try {
        const userId = ensureObjectId(req.user.id);
        const convId = ensureObjectId(req.params.id);
        const conv = await ConversationModel.findById(convId).lean();
        if (!conv)
            return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Conversation not found" }));
        if (!(conv.participantUserIds ?? []).some((p) => String(p) === String(userId))) {
            return next(new ApiError({ status: 403, code: "FORBIDDEN", message: "Not a participant" }));
        }
        const limitRaw = Number(req.query.limit ?? 50);
        const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 50;
        const before = req.query.before ? new Date(String(req.query.before)) : null;
        const match = { conversationId: convId };
        if (before && !Number.isNaN(before.getTime()))
            match.createdAt = { $lt: before };
        const messages = await MessageModel.find(match).sort({ createdAt: -1 }).limit(limit).lean();
        // Mark as read by resetting unread count
        await ConversationModel.updateOne({ _id: convId }, { $set: { [`unreadCounts.${String(userId)}`]: 0 } });
        return res.json({
            conversation: { id: String(conv._id), status: conv.status },
            messages: messages.reverse().map((m) => ({
                id: String(m._id),
                senderUserId: String(m.senderUserId),
                body: m.body,
                createdAt: m.createdAt
            }))
        });
    }
    catch (err) {
        return next(err);
    }
});
// Send a message (only if accepted, or allow creator to send while pending)
messagesRouter.post("/messages/conversations/:id/messages", requireAuth, requireRole([ROLE.PLAYER, ROLE.COACH]), async (req, res, next) => {
    const parsed = SendMessageSchema.safeParse(req.body);
    if (!parsed.success)
        return next(zodToBadRequest(parsed.error.flatten()));
    try {
        const userId = ensureObjectId(req.user.id);
        const convId = ensureObjectId(req.params.id);
        const conv = await ConversationModel.findById(convId);
        if (!conv)
            return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Conversation not found" }));
        if (!(conv.participantUserIds ?? []).some((p) => String(p) === String(userId))) {
            return next(new ApiError({ status: 403, code: "FORBIDDEN", message: "Not a participant" }));
        }
        if (conv.status === "blocked")
            return next(new ApiError({ status: 409, code: "BLOCKED", message: "Conversation is blocked" }));
        if (conv.status === "declined")
            return next(new ApiError({ status: 409, code: "DECLINED", message: "Conversation was declined" }));
        if (conv.status === "pending" && String(conv.createdByUserId) !== String(userId)) {
            return next(new ApiError({ status: 409, code: "PENDING", message: "Waiting for recipient to accept" }));
        }
        const body = parsed.data.body;
        await MessageModel.create({ conversationId: convId, senderUserId: userId, body });
        const other = (conv.participantUserIds ?? []).find((p) => String(p) !== String(userId));
        const otherKey = other ? String(other) : "";
        const update = {
            lastMessageAt: new Date(),
            lastMessagePreview: preview(body),
            $inc: { [`unreadCounts.${otherKey}`]: 1 },
            $set: { [`unreadCounts.${String(userId)}`]: 0 }
        };
        await ConversationModel.updateOne({ _id: convId }, update);
        return res.json({ ok: true });
    }
    catch (err) {
        return next(err);
    }
});
//# sourceMappingURL=messages.js.map