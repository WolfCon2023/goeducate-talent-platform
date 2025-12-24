import mongoose, { Schema } from "mongoose";

export const AUDIT_ACTION = {
  PROFILE_VISIBILITY_CHANGED: "PROFILE_VISIBILITY_CHANGED",
  PROFILE_UPDATED: "PROFILE_UPDATED"
} as const;

export type AuditAction = (typeof AUDIT_ACTION)[keyof typeof AUDIT_ACTION];

export type AuditEntityType = "playerProfile" | "coachProfile" | "evaluatorProfile";

export type AuditLogDoc = {
  actorUserId: mongoose.Types.ObjectId;
  targetUserId: mongoose.Types.ObjectId;
  action: AuditAction;
  entityType: AuditEntityType;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
};

const AuditLogSchema = new Schema<AuditLogDoc>(
  {
    actorUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    targetUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: { type: String, required: true, index: true },
    entityType: { type: String, required: true, index: true },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    ip: { type: String, trim: true },
    userAgent: { type: String, trim: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AuditLogSchema.index({ createdAt: -1 });

export const AuditLogModel =
  (mongoose.models.AuditLog as mongoose.Model<AuditLogDoc> | undefined) ?? mongoose.model<AuditLogDoc>("AuditLog", AuditLogSchema);


