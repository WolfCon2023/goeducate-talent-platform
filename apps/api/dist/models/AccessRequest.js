import mongoose, { Schema } from "mongoose";
export const ACCESS_REQUEST_STATUS = {
    PENDING: "pending",
    APPROVED: "approved",
    REJECTED: "rejected"
};
const AccessRequestSchema = new Schema({
    status: { type: String, required: true, enum: Object.values(ACCESS_REQUEST_STATUS), index: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, index: true },
    requestedRole: { type: String, required: true, trim: true, lowercase: true },
    sport: { type: String, required: true, trim: true },
    sportOther: { type: String, trim: true },
    answers: { type: Schema.Types.Mixed, required: true },
    adminNotes: { type: String, trim: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date }
}, { timestamps: true });
// Prevent duplicate pending requests per email.
AccessRequestSchema.index({ email: 1, status: 1 }, { unique: true, partialFilterExpression: { status: ACCESS_REQUEST_STATUS.PENDING } });
export const AccessRequestModel = mongoose.models.AccessRequest ??
    mongoose.model("AccessRequest", AccessRequestSchema);
//# sourceMappingURL=AccessRequest.js.map