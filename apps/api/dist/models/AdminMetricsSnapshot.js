import mongoose, { Schema } from "mongoose";
const AdminMetricsSnapshotSchema = new Schema({
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
}, { timestamps: true });
export const AdminMetricsSnapshotModel = mongoose.models.AdminMetricsSnapshot ??
    mongoose.model("AdminMetricsSnapshot", AdminMetricsSnapshotSchema);
//# sourceMappingURL=AdminMetricsSnapshot.js.map