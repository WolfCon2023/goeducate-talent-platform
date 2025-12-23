import mongoose, { Schema } from "mongoose";

export type PlayerProfileDoc = {
  userId: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  sport?: string;
  position: string;
  gradYear: number;
  state: string;
  city: string;
  heightIn?: number;
  weightLb?: number;
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
    sport: { type: String, trim: true },
    position: { type: String, required: true, trim: true },
    gradYear: { type: Number, required: true },
    state: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    heightIn: { type: Number },
    weightLb: { type: Number },
    contactEmail: { type: String, lowercase: true, trim: true },
    contactPhone: { type: String, trim: true },
    hudlLink: { type: String }
  },
  { timestamps: true }
);

export const PlayerProfileModel =
  (mongoose.models.PlayerProfile as mongoose.Model<PlayerProfileDoc> | undefined) ??
  mongoose.model<PlayerProfileDoc>("PlayerProfile", PlayerProfileSchema);


