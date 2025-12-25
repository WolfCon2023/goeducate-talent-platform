import mongoose, { Schema } from "mongoose";

export const EMAIL_AUDIT_STATUS = {
  SENT: "sent",
  FAILED: "failed",
  SKIPPED: "skipped"
} as const;

export type EmailAuditStatus = (typeof EMAIL_AUDIT_STATUS)[keyof typeof EMAIL_AUDIT_STATUS];

export const EMAIL_AUDIT_TYPE = {
  ACCESS_REQUEST_ADMIN_ALERT: "access_request_admin_alert",
  ACCESS_REQUEST_APPROVED: "access_request_approved",
  ACCESS_REQUEST_REJECTED: "access_request_rejected",
  CONTACT_FORM: "contact_form",
  INVITE: "invite",
  SHOWCASE_REGISTRATION_CONFIRMATION: "showcase_registration_confirmation",
  NOTIFICATION: "notification",
  AUTH_USERNAME_REMINDER: "auth_username_reminder",
  AUTH_PASSWORD_RESET: "auth_password_reset",
  TEST: "test"
} as const;

export type EmailAuditType = (typeof EMAIL_AUDIT_TYPE)[keyof typeof EMAIL_AUDIT_TYPE];

export type EmailAuditLogDoc = {
  type: EmailAuditType;
  status: EmailAuditStatus;
  to: string;
  subject: string;
  from?: string;
  cc?: string[];
  bcc?: string[];
  relatedAccessRequestId?: mongoose.Types.ObjectId;
  relatedInviteEmail?: string;
  relatedUserId?: mongoose.Types.ObjectId;
  relatedFilmSubmissionId?: mongoose.Types.ObjectId;
  relatedShowcaseId?: mongoose.Types.ObjectId;
  relatedShowcaseRegistrationId?: mongoose.Types.ObjectId;
  messageId?: string;
  meta?: unknown;
  error?: unknown;
  createdAt: Date;
};

const EmailAuditLogSchema = new Schema<EmailAuditLogDoc>(
  {
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
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const EmailAuditLogModel =
  (mongoose.models.EmailAuditLog as mongoose.Model<EmailAuditLogDoc> | undefined) ??
  mongoose.model<EmailAuditLogDoc>("EmailAuditLog", EmailAuditLogSchema);


