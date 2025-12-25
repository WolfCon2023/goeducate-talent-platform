import mongoose, { Schema } from "mongoose";
const CoachProfileSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    isProfilePublic: { type: Boolean, default: true, index: true },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    title: { type: String, trim: true },
    institutionName: { type: String, trim: true },
    programLevel: { type: String, trim: true },
    institutionLocation: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true, index: true },
    positionsOfInterest: [{ type: String, trim: true }],
    gradYears: [{ type: Number }],
    regions: [{ type: String, trim: true }]
}, { timestamps: true });
CoachProfileSchema.index({ isProfilePublic: 1, institutionName: 1, updatedAt: -1 });
CoachProfileSchema.index({ state: 1, updatedAt: -1 });
export const CoachProfileModel = mongoose.models.CoachProfile ??
    mongoose.model("CoachProfile", CoachProfileSchema);
//# sourceMappingURL=CoachProfile.js.map