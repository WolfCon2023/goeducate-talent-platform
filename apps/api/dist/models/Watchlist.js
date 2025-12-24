import mongoose, { Schema } from "mongoose";
const WatchlistSchema = new Schema({
    coachUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    playerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true }
}, { timestamps: true });
WatchlistSchema.index({ coachUserId: 1, playerUserId: 1 }, { unique: true });
export const WatchlistModel = mongoose.models.Watchlist ??
    mongoose.model("Watchlist", WatchlistSchema);
//# sourceMappingURL=Watchlist.js.map