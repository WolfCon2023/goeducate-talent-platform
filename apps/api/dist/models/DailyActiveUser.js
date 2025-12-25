import mongoose, { Schema } from "mongoose";
import { ALL_ROLES } from "@goeducate/shared";
const DailyActiveUserSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    role: { type: String, required: true, enum: ALL_ROLES, index: true },
    day: { type: String, required: true, trim: true, maxlength: 10, index: true },
    firstSeenAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true }
}, { timestamps: false });
DailyActiveUserSchema.index({ day: 1, role: 1 });
DailyActiveUserSchema.index({ userId: 1, day: 1 }, { unique: true });
export const DailyActiveUserModel = mongoose.models.DailyActiveUser ??
    mongoose.model("DailyActiveUser", DailyActiveUserSchema);
//# sourceMappingURL=DailyActiveUser.js.map