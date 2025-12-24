import mongoose, { Schema } from "mongoose";
export const AUDIT_ACTION = {
    PROFILE_VISIBILITY_CHANGED: "PROFILE_VISIBILITY_CHANGED",
    PROFILE_UPDATED: "PROFILE_UPDATED"
};
const AuditLogSchema = new Schema({
    actorUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    targetUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: { type: String, required: true, index: true },
    entityType: { type: String, required: true, index: true },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    ip: { type: String, trim: true },
    userAgent: { type: String, trim: true }
}, { timestamps: { createdAt: true, updatedAt: false } });
AuditLogSchema.index({ createdAt: -1 });
export const AuditLogModel = mongoose.models.AuditLog ?? mongoose.model("AuditLog", AuditLogSchema);
//# sourceMappingURL=AuditLog.js.map