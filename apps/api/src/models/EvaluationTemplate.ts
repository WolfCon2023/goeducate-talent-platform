import mongoose, { Schema } from "mongoose";

export type EvaluationTemplateDoc = {
  title: string;
  sport: string; // "any" | known sports
  position: string; // "any" | position/event string
  strengthsTemplate: string;
  improvementsTemplate: string;
  notesTemplate?: string;
  isActive: boolean;
  createdByUserId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const EvaluationTemplateSchema = new Schema<EvaluationTemplateDoc>(
  {
    title: { type: String, required: true, trim: true },
    sport: { type: String, required: true, trim: true, default: "any", index: true },
    position: { type: String, required: true, trim: true, default: "any", index: true },
    strengthsTemplate: { type: String, required: true },
    improvementsTemplate: { type: String, required: true },
    notesTemplate: { type: String },
    isActive: { type: Boolean, default: true, index: true },
    createdByUserId: { type: Schema.Types.ObjectId, ref: "User", index: true }
  },
  { timestamps: true }
);

EvaluationTemplateSchema.index({ sport: 1, position: 1, isActive: 1, updatedAt: -1 });

export const EvaluationTemplateModel =
  (mongoose.models.EvaluationTemplate as mongoose.Model<EvaluationTemplateDoc> | undefined) ??
  mongoose.model<EvaluationTemplateDoc>("EvaluationTemplate", EvaluationTemplateSchema);


