import mongoose, { Schema } from "mongoose";
export const NOTIFICATION_TYPE = {
    FILM_SUBMITTED: "film_submitted",
    QUEUE_NEW_SUBMISSION: "queue_new_submission",
    EVALUATION_COMPLETED: "evaluation_completed",
    WATCHLIST_EVAL_COMPLETED: "watchlist_eval_completed"
};
const NotificationSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    href: { type: String, trim: true },
    readAt: { type: Date }
}, { timestamps: true });
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });
export const NotificationModel = mongoose.models.Notification ??
    mongoose.model("Notification", NotificationSchema);
//# sourceMappingURL=Notification.js.map