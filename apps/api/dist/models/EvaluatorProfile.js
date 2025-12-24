import mongoose, { Schema } from "mongoose";
const EvaluatorProfileSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    isProfilePublic: { type: Boolean, default: true, index: true },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    title: { type: String, trim: true },
    bio: { type: String, trim: true },
    experienceYears: { type: Number },
    credentials: [{ type: String, trim: true }],
    specialties: [{ type: String, trim: true }]
}, { timestamps: true });
EvaluatorProfileSchema.index({ isProfilePublic: 1, updatedAt: -1 });
export const EvaluatorProfileModel = mongoose.models.EvaluatorProfile ??
    mongoose.model("EvaluatorProfile", EvaluatorProfileSchema);
//# sourceMappingURL=EvaluatorProfile.js.map