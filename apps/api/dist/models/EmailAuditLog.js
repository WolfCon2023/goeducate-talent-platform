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
    INVITE: "invite",
    SHOWCASE_REGISTRATION_CONFIRMATION: "showcase_registration_confirmation",
    NOTIFICATION: "notification",
    TEST: "test"
};
const EmailAuditLogSchema = new Schema({
    type: { type: String, required: true, index: true },
    status: { type: String, required: true, index: true },
    to: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    from: { type: String, trim: true },
    cc: [{ type: String, trim: true }],
    bcc: [{ type: String, trim: true }],
    relatedAccessRequestId: { type: Schema.Types.ObjectId, ref: "AccessRequest", index: true },
    relatedInviteEmail: { type: String, trim: true, lowercase: true },
    relatedUserId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    relatedFilmSubmissionId: { type: Schema.Types.ObjectId, ref: "FilmSubmission", index: true },
    relatedShowcaseId: { type: Schema.Types.ObjectId, ref: "Showcase", index: true },
    relatedShowcaseRegistrationId: { type: Schema.Types.ObjectId, ref: "ShowcaseRegistration", index: true },
    messageId: { type: String, trim: true },
    meta: { type: Schema.Types.Mixed },
    error: { type: Schema.Types.Mixed }
}, { timestamps: { createdAt: true, updatedAt: false } });
export const EmailAuditLogModel = mongoose.models.EmailAuditLog ??
    mongoose.model("EmailAuditLog", EmailAuditLogSchema);
//# sourceMappingURL=EmailAuditLog.js.map