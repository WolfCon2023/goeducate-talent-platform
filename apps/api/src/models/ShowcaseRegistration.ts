import mongoose, { Schema } from "mongoose";

export const SHOWCASE_REGISTRATION_STATUS = {
  PENDING: "pending",
  PAID: "paid",
  FAILED: "failed",
  REFUNDED: "refunded"
} as const;

export type ShowcaseRegistrationStatus =
  (typeof SHOWCASE_REGISTRATION_STATUS)[keyof typeof SHOWCASE_REGISTRATION_STATUS];

export type ShowcaseRegistrationDoc = {
  showcaseId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  fullName: string;
  email: string;
  role?: string;
  sport?: string;
  waiverAcceptedAt?: Date;
  waiverVersion?: string;
  waiverTextSnapshot?: string;
  refundPolicyAcceptedAt?: Date;
  refundPolicyVersion?: string;
  refundPolicyTextSnapshot?: string;
  weatherClauseTextSnapshot?: string;
  paymentStatus: ShowcaseRegistrationStatus;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId?: string;
  createdAt: Date;
  updatedAt: Date;
};

const ShowcaseRegistrationSchema = new Schema<ShowcaseRegistrationDoc>(
  {
    showcaseId: { type: Schema.Types.ObjectId, ref: "Showcase", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    role: { type: String, trim: true },
    sport: { type: String, trim: true },
    waiverAcceptedAt: { type: Date },
    waiverVersion: { type: String, trim: true },
    waiverTextSnapshot: { type: String },
    refundPolicyAcceptedAt: { type: Date },
    refundPolicyVersion: { type: String, trim: true },
    refundPolicyTextSnapshot: { type: String },
    weatherClauseTextSnapshot: { type: String },
    paymentStatus: {
      type: String,
      required: true,
      enum: Object.values(SHOWCASE_REGISTRATION_STATUS),
      default: SHOWCASE_REGISTRATION_STATUS.PENDING
    },
    stripeCheckoutSessionId: { type: String, required: true, trim: true, unique: true, index: true },
    stripePaymentIntentId: { type: String, trim: true }
  },
  { timestamps: true }
);

ShowcaseRegistrationSchema.index({ showcaseId: 1, createdAt: -1 });

export const ShowcaseRegistrationModel =
  (mongoose.models.ShowcaseRegistration as mongoose.Model<ShowcaseRegistrationDoc> | undefined) ??
  mongoose.model<ShowcaseRegistrationDoc>("ShowcaseRegistration", ShowcaseRegistrationSchema);


