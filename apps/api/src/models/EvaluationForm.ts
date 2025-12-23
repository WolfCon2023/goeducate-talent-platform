import mongoose, { Schema } from "mongoose";

export type EvaluationFormDoc = {
  title: string;
  sport: string;
  version: number;
  isActive: boolean;
  strengthsPrompt: string;
  improvementsPrompt: string;
  notesHelp?: string;
  categories: unknown; // stored as JSON; validated at the API boundary
  createdByUserId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const EvaluationFormSchema = new Schema<EvaluationFormDoc>(
  {
    title: { type: String, required: true, trim: true },
    sport: { type: String, required: true, trim: true, index: true },
    version: { type: Number, required: true, default: 1 },
    isActive: { type: Boolean, default: true, index: true },
    strengthsPrompt: { type: String, required: true },
    improvementsPrompt: { type: String, required: true },
    notesHelp: { type: String },
    categories: { type: Schema.Types.Mixed, required: true },
    createdByUserId: { type: Schema.Types.ObjectId, ref: "User", index: true }
  },
  { timestamps: true }
);

EvaluationFormSchema.index({ sport: 1, isActive: 1, updatedAt: -1 });

export const EvaluationFormModel =
  (mongoose.models.EvaluationForm as mongoose.Model<EvaluationFormDoc> | undefined) ??
  mongoose.model<EvaluationFormDoc>("EvaluationForm", EvaluationFormSchema);


