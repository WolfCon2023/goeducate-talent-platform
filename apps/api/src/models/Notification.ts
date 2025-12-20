import mongoose, { Schema } from "mongoose";

export const NOTIFICATION_TYPE = {
  FILM_SUBMITTED: "film_submitted",
  EVALUATION_COMPLETED: "evaluation_completed",
  WATCHLIST_EVAL_COMPLETED: "watchlist_eval_completed"
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE];

export type NotificationDoc = {
  userId: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  href?: string;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const NotificationSchema = new Schema<NotificationDoc>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    href: { type: String, trim: true },
    readAt: { type: Date }
  },
  { timestamps: true }
);

NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });

export const NotificationModel =
  (mongoose.models.Notification as mongoose.Model<NotificationDoc> | undefined) ??
  mongoose.model<NotificationDoc>("Notification", NotificationSchema);


