import mongoose, { Schema } from "mongoose";

export const SHOWCASE_STATUS = {
  DRAFT: "draft",
  PUBLISHED: "published",
  ARCHIVED: "archived"
} as const;

export type ShowcaseStatus = (typeof SHOWCASE_STATUS)[keyof typeof SHOWCASE_STATUS];

export type ShowcaseDoc = {
  slug: string;
  title: string;
  description: string;
  sportCategories: string[];
  startDateTime: Date;
  endDateTime: Date;
  timezone: string;
  locationName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zip?: string;
  costCents: number;
  currency: string;
  capacity?: number;
  spotsRemaining?: number;
  registrationOpen: boolean;
  registrationOpenAt?: Date;
  registrationCloseAt?: Date;
  status: ShowcaseStatus;
  imageUrl?: string;
  stripePriceId?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const ShowcaseSchema = new Schema<ShowcaseDoc>(
  {
    slug: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    sportCategories: { type: [String], required: true, default: [] },
    startDateTime: { type: Date, required: true },
    endDateTime: { type: Date, required: true },
    timezone: { type: String, required: true, default: "America/New_York", trim: true },
    locationName: { type: String, required: true, trim: true },
    addressLine1: { type: String, required: true, trim: true },
    addressLine2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    zip: { type: String, trim: true },
    costCents: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "usd", trim: true },
    capacity: { type: Number, min: 1 },
    spotsRemaining: { type: Number, min: 0 },
    registrationOpen: { type: Boolean, required: true, default: false },
    registrationOpenAt: { type: Date },
    registrationCloseAt: { type: Date },
    status: { type: String, required: true, enum: Object.values(SHOWCASE_STATUS), default: SHOWCASE_STATUS.DRAFT },
    imageUrl: { type: String, trim: true },
    stripePriceId: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true }
  },
  { timestamps: true }
);

ShowcaseSchema.index({ status: 1, startDateTime: 1 });
ShowcaseSchema.index({ registrationOpen: 1, registrationOpenAt: 1, registrationCloseAt: 1 });

export const ShowcaseModel =
  (mongoose.models.Showcase as mongoose.Model<ShowcaseDoc> | undefined) ?? mongoose.model<ShowcaseDoc>("Showcase", ShowcaseSchema);


