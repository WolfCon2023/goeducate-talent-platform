import mongoose, { Schema } from "mongoose";
import { ALL_ROLES } from "@goeducate/shared";
export const COACH_SUBSCRIPTION_STATUS = {
    INACTIVE: "inactive",
    ACTIVE: "active"
};
const UserSchema = new Schema({
    email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    username: { type: String, unique: true, sparse: true, index: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true, enum: ALL_ROLES },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    profilePhotoPath: { type: String, trim: true },
    isActive: { type: Boolean, default: true, index: true },
    subscriptionStatus: { type: String, enum: Object.values(COACH_SUBSCRIPTION_STATUS) },
    stripeCustomerId: { type: String, trim: true, index: true },
    stripeSubscriptionId: { type: String, trim: true, index: true },
    passwordResetTokenHash: { type: String, trim: true, index: true },
    passwordResetExpiresAt: { type: Date },
    passwordResetUsedAt: { type: Date },
    passwordResetRequestedAt: { type: Date },
    recoveryQuestions: [
        {
            questionId: { type: String, required: true, trim: true },
            question: { type: String, required: true, trim: true },
            answerHash: { type: String, required: true, trim: true }
        }
    ]
}, { timestamps: true });
export const UserModel = mongoose.models.User ?? mongoose.model("User", UserSchema);
//# sourceMappingURL=User.js.map