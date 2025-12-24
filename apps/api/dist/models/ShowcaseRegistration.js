import mongoose, { Schema } from "mongoose";
export const SHOWCASE_REGISTRATION_STATUS = {
    PENDING: "pending",
    PAID: "paid",
    FAILED: "failed",
    REFUNDED: "refunded"
};
const ShowcaseRegistrationSchema = new Schema({
    showcaseId: { type: Schema.Types.ObjectId, ref: "Showcase", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    role: { type: String, trim: true },
    sport: { type: String, trim: true },
    waiverAcceptedAt: { type: Date },
    waiverVersion: { type: String, trim: true },
    waiverTextSnapshot: { type: String },
    refundPolicyAcceptedAt: { type: Date },
    refundPolicyVersion: { type: String, trim: true },
    refundPolicyTextSnapshot: { type: String },
    weatherClauseTextSnapshot: { type: String },
    paymentStatus: {
        type: String,
        required: true,
        enum: Object.values(SHOWCASE_REGISTRATION_STATUS),
        default: SHOWCASE_REGISTRATION_STATUS.PENDING
    },
    stripeCheckoutSessionId: { type: String, required: true, trim: true, unique: true, index: true },
    stripePaymentIntentId: { type: String, trim: true }
}, { timestamps: true });
ShowcaseRegistrationSchema.index({ showcaseId: 1, createdAt: -1 });
export const ShowcaseRegistrationModel = mongoose.models.ShowcaseRegistration ??
    mongoose.model("ShowcaseRegistration", ShowcaseRegistrationSchema);
//# sourceMappingURL=ShowcaseRegistration.js.map