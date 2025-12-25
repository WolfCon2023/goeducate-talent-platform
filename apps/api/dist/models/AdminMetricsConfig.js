import mongoose, { Schema } from "mongoose";
const AdminMetricsConfigSchema = new Schema({
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
}, { timestamps: true });
export const AdminMetricsConfigModel = mongoose.models.AdminMetricsConfig ??
    mongoose.model("AdminMetricsConfig", AdminMetricsConfigSchema);
//# sourceMappingURL=AdminMetricsConfig.js.map