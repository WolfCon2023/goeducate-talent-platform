import mongoose, { Schema } from "mongoose";

export type WatchlistDoc = {
  coachUserId: mongoose.Types.ObjectId;
  playerUserId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const WatchlistSchema = new Schema<WatchlistDoc>(
  {
    coachUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    playerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true }
  },
  { timestamps: true }
);

WatchlistSchema.index({ coachUserId: 1, playerUserId: 1 }, { unique: true });

export const WatchlistModel =
  (mongoose.models.Watchlist as mongoose.Model<WatchlistDoc> | undefined) ??
  mongoose.model<WatchlistDoc>("Watchlist", WatchlistSchema);


