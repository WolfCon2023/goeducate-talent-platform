import { Router } from "express";
import mongoose from "mongoose";

import { ROLE } from "@goeducate/shared";

import { ApiError } from "../http/errors.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { NotificationModel } from "../models/Notification.js";

export const notificationsRouter = Router();

// Authenticated: list your notifications
notificationsRouter.get(
  "/notifications/me",
  requireAuth,
  requireRole([ROLE.PLAYER, ROLE.COACH, ROLE.EVALUATOR, ROLE.ADMIN]),
  async (req, res, next) => {
    try {
      const userId = new mongoose.Types.ObjectId(req.user!.id);
      const unreadOnly = String(req.query.unreadOnly ?? "").trim() === "1";
      const limitRaw = Number(req.query.limit ?? 50);
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, limitRaw)) : 50;

      const query: any = { userId };
      if (unreadOnly) query.readAt = { $exists: false };

      const results = await NotificationModel.find(query).sort({ createdAt: -1 }).limit(limit).lean();
      return res.json({ results });
    } catch (err) {
      return next(err);
    }
  }
);

// Authenticated: unread count
notificationsRouter.get(
  "/notifications/unread-count",
  requireAuth,
  requireRole([ROLE.PLAYER, ROLE.COACH, ROLE.EVALUATOR, ROLE.ADMIN]),
  async (req, res, next) => {
    try {
      const userId = new mongoose.Types.ObjectId(req.user!.id);
      const count = await NotificationModel.countDocuments({ userId, readAt: { $exists: false } });
      return res.json({ count });
    } catch (err) {
      return next(err);
    }
  }
);

// Authenticated: mark one notification as read
notificationsRouter.patch(
  "/notifications/:id/read",
  requireAuth,
  requireRole([ROLE.PLAYER, ROLE.COACH, ROLE.EVALUATOR, ROLE.ADMIN]),
  async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Notification not found" }));
      }
      const _id = new mongoose.Types.ObjectId(req.params.id);
      const userId = new mongoose.Types.ObjectId(req.user!.id);

      const updated = await NotificationModel.findOneAndUpdate(
        { _id, userId, readAt: { $exists: false } },
        { $set: { readAt: new Date() } },
        { new: true }
      ).lean();

      if (!updated) return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Notification not found" }));
      return res.json(updated);
    } catch (err) {
      return next(err);
    }
  }
);

// Authenticated: delete one of your notifications
notificationsRouter.delete(
  "/notifications/:id",
  requireAuth,
  requireRole([ROLE.PLAYER, ROLE.COACH, ROLE.EVALUATOR, ROLE.ADMIN]),
  async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Notification not found" }));
      }
      const _id = new mongoose.Types.ObjectId(req.params.id);
      const userId = new mongoose.Types.ObjectId(req.user!.id);

      const deleted = await NotificationModel.deleteOne({ _id, userId });
      if (!deleted.deletedCount) {
        return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Notification not found" }));
      }
      return res.status(204).send();
    } catch (err) {
      return next(err);
    }
  }
);

// Authenticated: bulk delete your notifications (all or unread-only)
notificationsRouter.delete(
  "/notifications/me",
  requireAuth,
  requireRole([ROLE.PLAYER, ROLE.COACH, ROLE.EVALUATOR, ROLE.ADMIN]),
  async (req, res, next) => {
    try {
      const userId = new mongoose.Types.ObjectId(req.user!.id);
      const unreadOnly = String(req.query.unreadOnly ?? "").trim() === "1";
      const query: any = { userId };
      if (unreadOnly) query.readAt = { $exists: false };

      const result = await NotificationModel.deleteMany(query);
      return res.json({ deletedCount: result.deletedCount ?? 0 });
    } catch (err) {
      return next(err);
    }
  }
);


