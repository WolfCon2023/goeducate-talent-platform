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
  FILM_NEEDS_CHANGES: "film_needs_changes"
} as const;

export type EmailAuditType = (typeof EMAIL_AUDIT_TYPE)[keyof typeof EMAIL_AUDIT_TYPE];

export type EmailAuditLogDoc = {
  type: EmailAuditType;
  status: EmailAuditStatus;
  to: string;
  subject: string;
  relatedAccessRequestId?: mongoose.Types.ObjectId;
  relatedInviteEmail?: string;
  messageId?: string;
  error?: unknown;
  createdAt: Date;
};

const EmailAuditLogSchema = new Schema<EmailAuditLogDoc>(
  {
    type: { type: String, required: true, index: true },
    status: { type: String, required: true, index: true },
    to: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    relatedAccessRequestId: { type: Schema.Types.ObjectId, ref: "AccessRequest", index: true },
    relatedInviteEmail: { type: String, trim: true, lowercase: true },
    messageId: { type: String, trim: true },
    error: { type: Schema.Types.Mixed }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const EmailAuditLogModel =
  (mongoose.models.EmailAuditLog as mongoose.Model<EmailAuditLogDoc> | undefined) ??
  mongoose.model<EmailAuditLogDoc>("EmailAuditLog", EmailAuditLogSchema);


