import mongoose, { Schema } from "mongoose";

export const ACCESS_REQUEST_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected"
} as const;

export type AccessRequestStatus = (typeof ACCESS_REQUEST_STATUS)[keyof typeof ACCESS_REQUEST_STATUS];

export type AccessRequestDoc = {
  status: AccessRequestStatus;
  fullName: string;
  email: string;
  requestedRole: string;
  sport: string;
  sportOther?: string;
  answers: unknown; // stored as JSON
  adminNotes?: string;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const AccessRequestSchema = new Schema<AccessRequestDoc>(
  {
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
  },
  { timestamps: true }
);

// Prevent duplicate pending requests per email.
AccessRequestSchema.index(
  { email: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: ACCESS_REQUEST_STATUS.PENDING } }
);

export const AccessRequestModel =
  (mongoose.models.AccessRequest as mongoose.Model<AccessRequestDoc> | undefined) ??
  mongoose.model<AccessRequestDoc>("AccessRequest", AccessRequestSchema);


