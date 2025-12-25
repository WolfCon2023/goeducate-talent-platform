import mongoose, { Schema } from "mongoose";

export type AdminMetricsConfigDoc = {
  key: "default";
  overdueHours: number;
  tatP90WarnHours: number;
  tatP90CritHours: number;
  emailFailWarnPct: number;
  emailFailCritPct: number;
  coachConversionTargetPct: number;
  playerPublicTargetPct: number;
  profileCompletionTargetPctAtLeast80: number;
  updatedByUserId?: mongoose.Types.ObjectId;
  updatedAt: Date;
  createdAt: Date;
};

const AdminMetricsConfigSchema = new Schema<AdminMetricsConfigDoc>(
  {
    key: { type: String, required: true, unique: true, default: "default" },
    overdueHours: { type: Number, required: true, default: 72 },
    tatP90WarnHours: { type: Number, required: true, default: 120 }, // 5 days
    tatP90CritHours: { type: Number, required: true, default: 168 }, // 7 days
    emailFailWarnPct: { type: Number, required: true, default: 2 },
    emailFailCritPct: { type: Number, required: true, default: 5 },
    coachConversionTargetPct: { type: Number, required: true, default: 15 },
    playerPublicTargetPct: { type: Number, required: true, default: 60 },
    profileCompletionTargetPctAtLeast80: { type: Number, required: true, default: 60 },
    updatedByUserId: { type: Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

export const AdminMetricsConfigModel =
  (mongoose.models.AdminMetricsConfig as mongoose.Model<AdminMetricsConfigDoc> | undefined) ??
  mongoose.model<AdminMetricsConfigDoc>("AdminMetricsConfig", AdminMetricsConfigSchema);


