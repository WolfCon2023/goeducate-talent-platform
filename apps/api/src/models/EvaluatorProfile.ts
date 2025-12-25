import mongoose, { Schema } from "mongoose";

export type EvaluatorProfileDoc = {
  userId: mongoose.Types.ObjectId;
  isProfilePublic: boolean;
  firstName?: string;
  lastName?: string;
  title?: string;
  location?: string;
  city?: string;
  state?: string;
  bio?: string;
  experienceYears?: number;
  credentials?: string[];
  specialties?: string[];
  createdAt: Date;
  updatedAt: Date;
};

const EvaluatorProfileSchema = new Schema<EvaluatorProfileDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    isProfilePublic: { type: Boolean, default: true, index: true },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    title: { type: String, trim: true },
    location: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true, index: true },
    bio: { type: String, trim: true },
    experienceYears: { type: Number },
    credentials: [{ type: String, trim: true }],
    specialties: [{ type: String, trim: true }]
  },
  { timestamps: true }
);

EvaluatorProfileSchema.index({ isProfilePublic: 1, updatedAt: -1 });
EvaluatorProfileSchema.index({ state: 1, updatedAt: -1 });

export const EvaluatorProfileModel =
  (mongoose.models.EvaluatorProfile as mongoose.Model<EvaluatorProfileDoc> | undefined) ??
  mongoose.model<EvaluatorProfileDoc>("EvaluatorProfile", EvaluatorProfileSchema);


