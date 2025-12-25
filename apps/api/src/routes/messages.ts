import { Router } from "express";
import mongoose from "mongoose";

import { CreateConversationSchema, ROLE, SendMessageSchema } from "@goeducate/shared";

import { ApiError } from "../http/errors.js";
import { zodToBadRequest } from "../http/zod.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ConversationModel, conversationKeyFor } from "../models/Conversation.js";
import { MessageModel } from "../models/Message.js";
import { UserModel } from "../models/User.js";
import { PlayerProfileModel } from "../models/PlayerProfile.js";
import { CoachProfileModel } from "../models/CoachProfile.js";
import { EvaluatorProfileModel } from "../models/EvaluatorProfile.js";

export const messagesRouter = Router();

function ensureObjectId(id: string) {
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid id" });
  }
  return new mongoose.Types.ObjectId(id);
}

function preview(text: string) {
  return String(text ?? "").trim().slice(0, 240);
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Recipient search (typeahead)
// Returns userIds + display labels so UI never needs raw Mongo IDs.
messagesRouter.get(
  "/messages/recipients",
  requireAuth,
  requireRole([ROLE.PLAYER, ROLE.COACH, ROLE.EVALUATOR, ROLE.ADMIN]),
  async (req, res, next) => {
  try {
    const q = String(req.query.q ?? "").trim();
    const role = String(req.query.role ?? "").trim().toLowerCase();
    const prefill = String(req.query.prefill ?? "") === "1";
    const limitRaw = Number(req.query.limit ?? 10);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(20, limitRaw)) : 10;
    // For "prefill" dropdowns, allow empty query but require a role filter to avoid huge result sets.
    if (!prefill && q.length < 2) return res.json({ results: [] });
    if (prefill && !role) return res.json({ results: [] });

    const rx = q ? new RegExp(escapeRegex(q), "i") : null;

    // Allowed recipients (exclude admins from being messaged by default).
    const allowedRecipientRoles = [ROLE.PLAYER, ROLE.COACH, ROLE.EVALUATOR];
    const roleFilter =
      role && [ROLE.PLAYER, ROLE.COACH, ROLE.EVALUATOR].includes(role as any) ? (role as any) : null;

    const userFind: any = { role: { $in: allowedRecipientRoles as any } };
    if (roleFilter) userFind.role = roleFilter;
    if (rx) userFind.$or = [{ email: rx }, { firstName: rx }, { lastName: rx }];

    const userHits = await UserModel.find(userFind)
      .select({ email: 1, role: 1, firstName: 1, lastName: 1 })
      .limit(limit)
      .lean();

    const ids = new Set<string>();
    for (const u of userHits) ids.add(String(u._id));

    const playerProfiles =
      !roleFilter || roleFilter === ROLE.PLAYER
        ? await PlayerProfileModel.find(
            rx ? { $or: [{ firstName: rx }, { lastName: rx }, { sport: rx }] } : {},
            { userId: 1, firstName: 1, lastName: 1, sport: 1 }
          )
            .limit(limit)
            .lean()
        : [];

    const coachProfiles =
      !roleFilter || roleFilter === ROLE.COACH
        ? await CoachProfileModel.find(
            rx ? { $or: [{ firstName: rx }, { lastName: rx }, { institutionName: rx }] } : {},
            { userId: 1, firstName: 1, lastName: 1, institutionName: 1, title: 1 }
          )
            .limit(limit)
            .lean()
        : [];

    const evaluatorProfiles =
      !roleFilter || roleFilter === ROLE.EVALUATOR
        ? await EvaluatorProfileModel.find(
            rx ? { $or: [{ firstName: rx }, { lastName: rx }, { location: rx }] } : {},
            { userId: 1, firstName: 1, lastName: 1, title: 1, location: 1 }
          )
            .limit(limit)
            .lean()
        : [];

    for (const p of playerProfiles) ids.add(String((p as any).userId));
    for (const c of coachProfiles) ids.add(String((c as any).userId));
    for (const e of evaluatorProfiles) ids.add(String((e as any).userId));

    const users = await UserModel.find({
      _id: { $in: Array.from(ids) },
      role: roleFilter ? roleFilter : { $in: allowedRecipientRoles as any }
    })
      .select({ email: 1, role: 1, firstName: 1, lastName: 1 })
      .limit(50)
      .lean();
    const userById = new Map(users.map((u) => [String(u._id), u]));
    const playerById = new Map(playerProfiles.map((p: any) => [String(p.userId), p]));
    const coachById = new Map(coachProfiles.map((c: any) => [String(c.userId), c]));
    const evaluatorById = new Map(evaluatorProfiles.map((e: any) => [String(e.userId), e]));

    const results = Array.from(ids)
      .map((id) => {
        const u = userById.get(id);
        if (!u) return null;
        const role = String((u as any).role);
        const email = String((u as any).email ?? "");

        let displayName = email;
        if (role === ROLE.PLAYER) {
          const p = playerById.get(id);
          if (p?.firstName && p?.lastName) displayName = `${p.firstName} ${p.lastName}`;
          else if ((u as any).firstName) displayName = `${(u as any).firstName} ${(u as any).lastName ?? ""}`.trim();
        } else if (role === ROLE.COACH) {
          const c = coachById.get(id);
          if (c?.firstName && c?.lastName) displayName = `${c.firstName} ${c.lastName}`;
          else if ((u as any).firstName) displayName = `${(u as any).firstName} ${(u as any).lastName ?? ""}`.trim();
        } else if (role === ROLE.EVALUATOR) {
          const e = evaluatorById.get(id);
          if (e?.firstName && e?.lastName) displayName = `${e.firstName} ${e.lastName}`;
          else if ((u as any).firstName) displayName = `${(u as any).firstName} ${(u as any).lastName ?? ""}`.trim();
        }

        const extra =
          role === ROLE.COACH
            ? coachById.get(id)?.institutionName
            : role === ROLE.PLAYER
              ? playerById.get(id)?.sport
              : role === ROLE.EVALUATOR
                ? evaluatorById.get(id)?.location
                : undefined;

        return { userId: id, role, email, displayName, extra: extra ?? null };
      })
      .filter(Boolean) as Array<{ userId: string; role: string; email: string; displayName: string; extra: string | null }>;

    // Rank: startsWith match on displayName/email first, then alphabetically.
    const qLower = q.toLowerCase();
    results.sort((a, b) => {
      const aKey = `${a.displayName} ${a.email}`.toLowerCase();
      const bKey = `${b.displayName} ${b.email}`.toLowerCase();
      const aStarts = aKey.startsWith(qLower) ? 0 : 1;
      const bStarts = bKey.startsWith(qLower) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return aKey.localeCompare(bKey);
    });

    return res.json({ results: results.slice(0, limit) });
  } catch (err) {
    return next(err);
  }
});

// List your conversations
messagesRouter.get("/messages/conversations", requireAuth, requireRole([ROLE.PLAYER, ROLE.COACH, ROLE.ADMIN, ROLE.EVALUATOR]), async (req, res, next) => {
  try {
    const userId = ensureObjectId(req.user!.id);
    const limitRaw = Number(req.query.limit ?? 50);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : 50;

    const convs = await ConversationModel.find({ participantUserIds: userId })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .limit(limit)
      .lean();

    const otherUserIds = convs
      .map((c) => (c.participantUserIds ?? []).find((p: any) => String(p) !== String(userId)))
      .filter(Boolean)
      .map((x: any) => String(x));

    const users = await UserModel.find({ _id: { $in: otherUserIds } }).lean();
    const userById = new Map(users.map((u) => [String(u._id), u]));

    return res.json({
      conversations: convs.map((c: any) => {
        const otherId = String((c.participantUserIds ?? []).find((p: any) => String(p) !== String(userId)) ?? "");
        const other = otherId ? userById.get(otherId) : null;
        const unread = (c.unreadCounts ?? {})[String(userId)] ?? 0;
        return {
          id: String(c._id),
          status: c.status,
          lastMessageAt: c.lastMessageAt ?? null,
          lastMessagePreview: c.lastMessagePreview ?? null,
          unread,
          other: other
            ? { id: String(other._id), email: other.email, role: other.role, displayName: (other as any).firstName ? `${(other as any).firstName} ${(other as any).lastName ?? ""}`.trim() : other.email }
            : { id: otherId || null }
        };
      })
    });
  } catch (err) {
    return next(err);
  }
});

// Create a new conversation request (1:1) with an initial message.
messagesRouter.post(
  "/messages/conversations",
  requireAuth,
  requireRole([ROLE.PLAYER, ROLE.COACH, ROLE.EVALUATOR, ROLE.ADMIN]),
  async (req, res, next) => {
  const parsed = CreateConversationSchema.safeParse(req.body);
  if (!parsed.success) return next(zodToBadRequest(parsed.error.flatten()));

  try {
    const actorId = ensureObjectId(req.user!.id);
    const recipientId = ensureObjectId(parsed.data.recipientUserId);
    if (String(actorId) === String(recipientId)) {
      return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Cannot message yourself" }));
    }

    const recipientUser = await UserModel.findById(recipientId).select({ role: 1 }).lean();
    if (!recipientUser) return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Recipient not found" }));
    if (String((recipientUser as any).role) === ROLE.ADMIN) {
      return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Cannot message admins" }));
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
    } else {
      // If conversation exists, treat as send message (subject to status rules in send endpoint).
    }

    await MessageModel.create({
      conversationId: conv._id,
      senderUserId: actorId,
      body: parsed.data.message
    });

    return res.json({ ok: true, conversationId: String(conv._id) });
  } catch (err) {
    // Handle duplicate participantKey race
    if ((err as any)?.code === 11000) {
      return res.status(409).json({ error: { code: "CONVERSATION_EXISTS", message: "Conversation already exists" } });
    }
    return next(err);
  }
});

// Accept a conversation request
messagesRouter.post(
  "/messages/conversations/:id/accept",
  requireAuth,
  requireRole([ROLE.PLAYER, ROLE.COACH, ROLE.EVALUATOR, ROLE.ADMIN]),
  async (req, res, next) => {
  try {
    const userId = ensureObjectId(req.user!.id);
    const convId = ensureObjectId(req.params.id);
    const conv = await ConversationModel.findById(convId);
    if (!conv) return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Conversation not found" }));
    if (!(conv.participantUserIds ?? []).some((p) => String(p) === String(userId))) {
      return next(new ApiError({ status: 403, code: "FORBIDDEN", message: "Not a participant" }));
    }
    if (conv.status === "blocked") return next(new ApiError({ status: 409, code: "BLOCKED", message: "Conversation is blocked" }));
    conv.status = "accepted";
    await conv.save();
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

// Decline a conversation request
messagesRouter.post(
  "/messages/conversations/:id/decline",
  requireAuth,
  requireRole([ROLE.PLAYER, ROLE.COACH, ROLE.EVALUATOR, ROLE.ADMIN]),
  async (req, res, next) => {
  try {
    const userId = ensureObjectId(req.user!.id);
    const convId = ensureObjectId(req.params.id);
    const conv = await ConversationModel.findById(convId);
    if (!conv) return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Conversation not found" }));
    if (!(conv.participantUserIds ?? []).some((p) => String(p) === String(userId))) {
      return next(new ApiError({ status: 403, code: "FORBIDDEN", message: "Not a participant" }));
    }
    conv.status = "declined";
    await conv.save();
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

// List messages in a conversation
messagesRouter.get("/messages/conversations/:id", requireAuth, requireRole([ROLE.PLAYER, ROLE.COACH, ROLE.ADMIN, ROLE.EVALUATOR]), async (req, res, next) => {
  try {
    const userId = ensureObjectId(req.user!.id);
    const convId = ensureObjectId(req.params.id);
    const conv = await ConversationModel.findById(convId).lean();
    if (!conv) return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Conversation not found" }));
    if (!(conv.participantUserIds ?? []).some((p: any) => String(p) === String(userId))) {
      return next(new ApiError({ status: 403, code: "FORBIDDEN", message: "Not a participant" }));
    }

    const limitRaw = Number(req.query.limit ?? 50);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 50;
    const before = req.query.before ? new Date(String(req.query.before)) : null;
    const match: any = { conversationId: convId };
    if (before && !Number.isNaN(before.getTime())) match.createdAt = { $lt: before };

    const messages = await MessageModel.find(match).sort({ createdAt: -1 }).limit(limit).lean();

    // Mark as read by resetting unread count
    await ConversationModel.updateOne(
      { _id: convId },
      { $set: { [`unreadCounts.${String(userId)}`]: 0 } }
    );

    return res.json({
      conversation: { id: String(conv._id), status: (conv as any).status },
      messages: messages.reverse().map((m: any) => ({
        id: String(m._id),
        senderUserId: String(m.senderUserId),
        body: m.body,
        createdAt: m.createdAt
      }))
    });
  } catch (err) {
    return next(err);
  }
});

// Send a message (only if accepted, or allow creator to send while pending)
messagesRouter.post(
  "/messages/conversations/:id/messages",
  requireAuth,
  requireRole([ROLE.PLAYER, ROLE.COACH, ROLE.EVALUATOR, ROLE.ADMIN]),
  async (req, res, next) => {
  const parsed = SendMessageSchema.safeParse(req.body);
  if (!parsed.success) return next(zodToBadRequest(parsed.error.flatten()));

  try {
    const userId = ensureObjectId(req.user!.id);
    const convId = ensureObjectId(req.params.id);
    const conv = await ConversationModel.findById(convId);
    if (!conv) return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Conversation not found" }));
    if (!(conv.participantUserIds ?? []).some((p) => String(p) === String(userId))) {
      return next(new ApiError({ status: 403, code: "FORBIDDEN", message: "Not a participant" }));
    }
    if (conv.status === "blocked") return next(new ApiError({ status: 409, code: "BLOCKED", message: "Conversation is blocked" }));
    if (conv.status === "declined") return next(new ApiError({ status: 409, code: "DECLINED", message: "Conversation was declined" }));
    if (conv.status === "pending" && String(conv.createdByUserId) !== String(userId)) {
      return next(new ApiError({ status: 409, code: "PENDING", message: "Waiting for recipient to accept" }));
    }

    const body = parsed.data.body;
    await MessageModel.create({ conversationId: convId, senderUserId: userId, body });

    const other = (conv.participantUserIds ?? []).find((p) => String(p) !== String(userId));
    const otherKey = other ? String(other) : "";
    const update: any = {
      lastMessageAt: new Date(),
      lastMessagePreview: preview(body),
      $inc: { [`unreadCounts.${otherKey}`]: 1 },
      $set: { [`unreadCounts.${String(userId)}`]: 0 }
    };
    await ConversationModel.updateOne({ _id: convId }, update);

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});


