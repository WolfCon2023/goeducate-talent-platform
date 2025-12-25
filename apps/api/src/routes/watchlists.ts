import { Router } from "express";
import mongoose from "mongoose";

import { ROLE } from "@goeducate/shared";

import { ApiError } from "../http/errors.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { WatchlistModel } from "../models/Watchlist.js";
import { logAppEvent } from "../util/appEvents.js";
import { APP_EVENT_TYPE } from "../models/AppEvent.js";

export const watchlistsRouter = Router();

// Coach/Admin: list current coach's watchlist with player profile summary
watchlistsRouter.get("/watchlists", requireAuth, requireRole([ROLE.COACH, ROLE.ADMIN]), async (req, res, next) => {
  try {
    const coachUserId = new mongoose.Types.ObjectId(req.user!.id);

    const results = await WatchlistModel.aggregate([
      { $match: { coachUserId } },
      { $sort: { createdAt: -1 } },
      { $limit: 200 },
      {
        $lookup: {
          from: "playerprofiles",
          localField: "playerUserId",
          foreignField: "userId",
          as: "playerProfile"
        }
      },
      { $unwind: { path: "$playerProfile", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          playerUserId: 1,
          createdAt: 1,
          playerProfile: {
            firstName: "$playerProfile.firstName",
            lastName: "$playerProfile.lastName",
            position: "$playerProfile.position",
            gradYear: "$playerProfile.gradYear",
            city: "$playerProfile.city",
            state: "$playerProfile.state"
          }
        }
      }
    ]);

    return res.json({ results });
  } catch (err) {
    return next(err);
  }
});

// Coach/Admin: add player to watchlist
watchlistsRouter.post(
  "/watchlists/:playerUserId",
  requireAuth,
  requireRole([ROLE.COACH, ROLE.ADMIN]),
  async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.playerUserId)) {
        return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid playerUserId" }));
      }
      const coachUserId = new mongoose.Types.ObjectId(req.user!.id);
      const playerUserId = new mongoose.Types.ObjectId(req.params.playerUserId);

      const doc = await WatchlistModel.findOneAndUpdate(
        { coachUserId, playerUserId },
        { $setOnInsert: { coachUserId, playerUserId } },
        { upsert: true, new: true }
      );

      logAppEvent({
        type: APP_EVENT_TYPE.WATCHLIST_ADD,
        user: req.user,
        path: req.path,
        meta: { playerUserId: String(playerUserId) }
      });

      return res.status(201).json(doc);
    } catch (err) {
      return next(err);
    }
  }
);

// Coach/Admin: remove player from watchlist
watchlistsRouter.delete(
  "/watchlists/:playerUserId",
  requireAuth,
  requireRole([ROLE.COACH, ROLE.ADMIN]),
  async (req, res, next) => {
    try {
      if (!mongoose.isValidObjectId(req.params.playerUserId)) {
        return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid playerUserId" }));
      }
      const coachUserId = new mongoose.Types.ObjectId(req.user!.id);
      const playerUserId = new mongoose.Types.ObjectId(req.params.playerUserId);

      await WatchlistModel.deleteOne({ coachUserId, playerUserId });

      logAppEvent({
        type: APP_EVENT_TYPE.WATCHLIST_REMOVE,
        user: req.user,
        path: req.path,
        meta: { playerUserId: String(playerUserId) }
      });
      return res.status(204).send();
    } catch (err) {
      return next(err);
    }
  }
);


