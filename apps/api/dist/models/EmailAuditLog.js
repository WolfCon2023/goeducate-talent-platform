import mongoose, { Schema } from "mongoose";
export const EMAIL_AUDIT_STATUS = {
    SENT: "sent",
    FAILED: "failed",
    SKIPPED: "skipped"
};
export const EMAIL_AUDIT_TYPE = {
    ACCESS_REQUEST_ADMIN_ALERT: "access_request_admin_alert",
    ACCESS_REQUEST_APPROVED: "access_request_approved",
    ACCESS_REQUEST_REJECTED: "access_request_rejected",
    CONTACT_FORM: "contact_form",
    FILM_NEEDS_CHANGES: "film_needs_changes"
};
const EmailAuditLogSchema = new Schema({
    type: { type: String, required: true, index: true },
    status: { type: String, required: true, index: true },
    to: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    relatedAccessRequestId: { type: Schema.Types.ObjectId, ref: "AccessRequest", index: true },
    relatedInviteEmail: { type: String, trim: true, lowercase: true },
    messageId: { type: String, trim: true },
    error: { type: Schema.Types.Mixed }
}, { timestamps: { createdAt: true, updatedAt: false } });
export const EmailAuditLogModel = mongoose.models.EmailAuditLog ??
    mongoose.model("EmailAuditLog", EmailAuditLogSchema);
//# sourceMappingURL=EmailAuditLog.js.map