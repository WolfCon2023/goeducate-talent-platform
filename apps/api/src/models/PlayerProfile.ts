import mongoose, { Schema } from "mongoose";

export type PlayerProfileDoc = {
  userId: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  isProfilePublic: boolean;
  isContactVisibleToSubscribedCoaches: boolean;
  sport?: string;
  position: string;
  gradYear: number;
  school?: string;
  state: string;
  city: string;
  heightIn?: number;
  weightLb?: number;
  heightInInches?: number;
  weightLbs?: number;
  fortyTime?: number;
  verticalInches?: number;
  gpa?: number;
  highlightPhotoUrl?: string;
  jerseyNumber?: number;
  contactEmail?: string;
  contactPhone?: string;
  hudlLink?: string;
  createdAt: Date;
  updatedAt: Date;
};

const PlayerProfileSchema = new Schema<PlayerProfileDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    isProfilePublic: { type: Boolean, default: false, index: true },
    isContactVisibleToSubscribedCoaches: { type: Boolean, default: false },
    sport: { type: String, trim: true },
    position: { type: String, required: true, trim: true },
    gradYear: { type: Number, required: true },
    school: { type: String, trim: true },
    state: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    heightIn: { type: Number },
    weightLb: { type: Number },
    heightInInches: { type: Number },
    weightLbs: { type: Number },
    fortyTime: { type: Number },
    verticalInches: { type: Number },
    gpa: { type: Number },
    highlightPhotoUrl: { type: String, trim: true },
    jerseyNumber: { type: Number },
    contactEmail: { type: String, lowercase: true, trim: true },
    contactPhone: { type: String, trim: true },
    hudlLink: { type: String }
  },
  { timestamps: true }
);

// Public search index (MVP)
PlayerProfileSchema.index({ isProfilePublic: 1, sport: 1, state: 1, position: 1, gradYear: 1, updatedAt: -1 });
PlayerProfileSchema.index({ isProfilePublic: 1, lastName: 1, firstName: 1 });

export const PlayerProfileModel =
  (mongoose.models.PlayerProfile as mongoose.Model<PlayerProfileDoc> | undefined) ??
  mongoose.model<PlayerProfileDoc>("PlayerProfile", PlayerProfileSchema);


