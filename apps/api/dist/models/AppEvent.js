import mongoose, { Schema } from "mongoose";
import { ALL_ROLES } from "@goeducate/shared";
export const APP_EVENT_TYPE = {
    COACH_SEARCH_PLAYERS: "coach_search_players",
    WATCHLIST_ADD: "watchlist_add",
    WATCHLIST_REMOVE: "watchlist_remove",
    CONTACT_REQUEST: "contact_request",
    EVALUATION_VIEW_COACH: "evaluation_view_coach",
    EVALUATION_VIEW_PLAYER: "evaluation_view_player",
    MESSAGE_SENT: "message_sent"
};
const AppEventSchema = new Schema({
    type: { type: String, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    role: { type: String, enum: ALL_ROLES, index: true },
    path: { type: String, trim: true, maxlength: 300 },
    meta: { type: Schema.Types.Mixed }
}, { timestamps: true });
AppEventSchema.index({ type: 1, createdAt: -1 });
AppEventSchema.index({ userId: 1, createdAt: -1 });
export const AppEventModel = mongoose.models.AppEvent ?? mongoose.model("AppEvent", AppEventSchema);
//# sourceMappingURL=AppEvent.js.map