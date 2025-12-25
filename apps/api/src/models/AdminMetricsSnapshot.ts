import mongoose, { Schema } from "mongoose";

export type AdminMetricsSnapshotDoc = {
  day: string; // YYYY-MM-DD UTC
  mrrCents?: number | null;
  arrCents?: number | null;
  backlogOpen?: number | null;
  overdueOpen?: number | null;
  submissionsNew?: number | null;
  evaluationsCompletedNew?: number | null;
  emailFailRatePct?: number | null;
  coachSearchEvents?: number | null;
  coachConversionRatePct?: number | null;
  createdAt: Date;
  updatedAt: Date;
};

const AdminMetricsSnapshotSchema = new Schema<AdminMetricsSnapshotDoc>(
  {
    day: { type: String, required: true, unique: true, index: true, trim: true, maxlength: 10 },
    mrrCents: { type: Number },
    arrCents: { type: Number },
    backlogOpen: { type: Number },
    overdueOpen: { type: Number },
    submissionsNew: { type: Number },
    evaluationsCompletedNew: { type: Number },
    emailFailRatePct: { type: Number },
    coachSearchEvents: { type: Number },
    coachConversionRatePct: { type: Number }
  },
  { timestamps: true }
);

export const AdminMetricsSnapshotModel =
  (mongoose.models.AdminMetricsSnapshot as mongoose.Model<AdminMetricsSnapshotDoc> | undefined) ??
  mongoose.model<AdminMetricsSnapshotDoc>("AdminMetricsSnapshot", AdminMetricsSnapshotSchema);


