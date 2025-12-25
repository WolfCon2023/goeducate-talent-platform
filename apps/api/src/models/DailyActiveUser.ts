import mongoose, { Schema } from "mongoose";

import { ALL_ROLES, type Role } from "@goeducate/shared";

export type DailyActiveUserDoc = {
  userId: mongoose.Types.ObjectId;
  role: Role;
  day: string; // YYYY-MM-DD (UTC)
  firstSeenAt: Date;
  lastSeenAt: Date;
};

const DailyActiveUserSchema = new Schema<DailyActiveUserDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    role: { type: String, required: true, enum: ALL_ROLES, index: true },
    day: { type: String, required: true, trim: true, maxlength: 10, index: true },
    firstSeenAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true }
  },
  { timestamps: false }
);

DailyActiveUserSchema.index({ day: 1, role: 1 });
DailyActiveUserSchema.index({ userId: 1, day: 1 }, { unique: true });

export const DailyActiveUserModel =
  (mongoose.models.DailyActiveUser as mongoose.Model<DailyActiveUserDoc> | undefined) ??
  mongoose.model<DailyActiveUserDoc>("DailyActiveUser", DailyActiveUserSchema);


