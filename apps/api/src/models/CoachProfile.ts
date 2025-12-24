import mongoose, { Schema } from "mongoose";

export type CoachProfileDoc = {
  userId: mongoose.Types.ObjectId;
  isProfilePublic: boolean;
  firstName?: string;
  lastName?: string;
  title?: string;
  institutionName?: string;
  programLevel?: string;
  institutionLocation?: string;
  positionsOfInterest?: string[];
  gradYears?: number[];
  regions?: string[];
  createdAt: Date;
  updatedAt: Date;
};

const CoachProfileSchema = new Schema<CoachProfileDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    isProfilePublic: { type: Boolean, default: true, index: true },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    title: { type: String, trim: true },
    institutionName: { type: String, trim: true },
    programLevel: { type: String, trim: true },
    institutionLocation: { type: String, trim: true },
    positionsOfInterest: [{ type: String, trim: true }],
    gradYears: [{ type: Number }],
    regions: [{ type: String, trim: true }]
  },
  { timestamps: true }
);

CoachProfileSchema.index({ isProfilePublic: 1, institutionName: 1, updatedAt: -1 });

export const CoachProfileModel =
  (mongoose.models.CoachProfile as mongoose.Model<CoachProfileDoc> | undefined) ??
  mongoose.model<CoachProfileDoc>("CoachProfile", CoachProfileSchema);


