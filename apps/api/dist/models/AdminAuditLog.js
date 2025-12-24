import mongoose, { Schema } from "mongoose";
const AdminAuditLogSchema = new Schema({
    actorUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: { type: String, required: true, trim: true, index: true },
    targetType: { type: String, trim: true },
    targetId: { type: String, trim: true },
    ip: { type: String, trim: true },
    userAgent: { type: String, trim: true },
    meta: { type: Schema.Types.Mixed }
}, { timestamps: true });
AdminAuditLogSchema.index({ createdAt: -1 });
export const AdminAuditLogModel = mongoose.models.AdminAuditLog ??
    mongoose.model("AdminAuditLog", AdminAuditLogSchema);
//# sourceMappingURL=AdminAuditLog.js.map