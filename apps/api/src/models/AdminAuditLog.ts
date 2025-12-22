import mongoose, { Schema } from "mongoose";

export type AdminAuditLogDoc = {
  actorUserId: mongoose.Types.ObjectId;
  action: string;
  targetType?: string;
  targetId?: string;
  ip?: string;
  userAgent?: string;
  meta?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

const AdminAuditLogSchema = new Schema<AdminAuditLogDoc>(
  {
    actorUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: { type: String, required: true, trim: true, index: true },
    targetType: { type: String, trim: true },
    targetId: { type: String, trim: true },
    ip: { type: String, trim: true },
    userAgent: { type: String, trim: true },
    meta: { type: Schema.Types.Mixed }
  },
  { timestamps: true }
);

AdminAuditLogSchema.index({ createdAt: -1 });

export const AdminAuditLogModel =
  (mongoose.models.AdminAuditLog as mongoose.Model<AdminAuditLogDoc> | undefined) ??
  mongoose.model<AdminAuditLogDoc>("AdminAuditLog", AdminAuditLogSchema);


