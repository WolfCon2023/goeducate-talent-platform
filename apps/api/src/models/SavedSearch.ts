import mongoose, { Schema } from "mongoose";

export type SavedSearchDoc = {
  coachUserId: mongoose.Types.ObjectId;
  name: string;
  params: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
};

const SavedSearchSchema = new Schema<SavedSearchDoc>(
  {
    coachUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    params: { type: Schema.Types.Mixed, required: true }
  },
  { timestamps: true }
);

SavedSearchSchema.index({ coachUserId: 1, name: 1 }, { unique: true });

export const SavedSearchModel =
  (mongoose.models.SavedSearch as mongoose.Model<SavedSearchDoc> | undefined) ??
  mongoose.model<SavedSearchDoc>("SavedSearch", SavedSearchSchema);


