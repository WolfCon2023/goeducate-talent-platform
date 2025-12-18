import { Router } from "express";
import mongoose from "mongoose";

import { PlayerProfileCreateSchema, PlayerProfileUpdateSchema, ROLE } from "@goeducate/shared";

import { ApiError } from "../http/errors.js";
import { zodToBadRequest } from "../http/zod.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { PlayerProfileModel } from "../models/PlayerProfile.js";

export const playerProfilesRouter = Router();

// Player: view own profile
playerProfilesRouter.get("/player-profiles/me", requireAuth, requireRole([ROLE.PLAYER]), async (req, res, next) => {
  try {
    const profile = await PlayerProfileModel.findOne({ userId: req.user!.id }).lean();
    if (!profile) return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Profile not found" }));
    return res.json(profile);
  } catch (err) {
    return next(err);
  }
});

// Player: create profile (one per user)
playerProfilesRouter.post("/player-profiles/me", requireAuth, requireRole([ROLE.PLAYER]), async (req, res, next) => {
  const parsed = PlayerProfileCreateSchema.safeParse({ ...req.body, userId: req.user!.id });
  if (!parsed.success) return next(zodToBadRequest(parsed.error.flatten()));

  try {
    const userId = new mongoose.Types.ObjectId(req.user!.id);
    const existing = await PlayerProfileModel.findOne({ userId }).lean();
    if (existing) return next(new ApiError({ status: 409, code: "ALREADY_EXISTS", message: "Profile already exists" }));

    const created = await PlayerProfileModel.create({ ...parsed.data, userId });
    return res.status(201).json(created);
  } catch (err) {
    return next(err);
  }
});

// Player: update profile
playerProfilesRouter.put("/player-profiles/me", requireAuth, requireRole([ROLE.PLAYER]), async (req, res, next) => {
  const parsed = PlayerProfileUpdateSchema.safeParse(req.body);
  if (!parsed.success) return next(zodToBadRequest(parsed.error.flatten()));

  try {
    const userId = new mongoose.Types.ObjectId(req.user!.id);
    const updated = await PlayerProfileModel.findOneAndUpdate(
      { userId },
      { $set: parsed.data },
      { new: true, upsert: true }
    );
    return res.json(updated);
  } catch (err) {
    return next(err);
  }
});

// Coach/Admin/Evaluator: fetch a player's profile by userId (for name + metadata)
playerProfilesRouter.get(
  "/player-profiles/player/:userId",
  requireAuth,
  requireRole([ROLE.COACH, ROLE.ADMIN, ROLE.EVALUATOR]),
  async (req, res, next) => {
    try {
      const userId = new mongoose.Types.ObjectId(req.params.userId);
      const profile = await PlayerProfileModel.findOne({ userId }).lean();
      if (!profile) return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Profile not found" }));
      return res.json(profile);
    } catch (err) {
      return next(err);
    }
  }
);

// Coach/Admin/Evaluator: search players (minimal MVP)
playerProfilesRouter.get(
  "/player-profiles",
  requireAuth,
  requireRole([ROLE.COACH, ROLE.ADMIN, ROLE.EVALUATOR]),
  async (req, res, next) => {
    try {
      const { position, gradYear, state, city, q } = req.query as Record<string, string | undefined>;
      const filter: Record<string, unknown> = {};

      if (position) filter.position = position;
      if (state) filter.state = state;
      if (city) filter.city = city;
      if (gradYear) filter.gradYear = Number(gradYear);

      if (q) {
        filter.$or = [
          { firstName: { $regex: q, $options: "i" } },
          { lastName: { $regex: q, $options: "i" } }
        ];
      }

      const results = await PlayerProfileModel.find(filter).limit(50).lean();
      return res.json({ results });
    } catch (err) {
      return next(err);
    }
  }
);


