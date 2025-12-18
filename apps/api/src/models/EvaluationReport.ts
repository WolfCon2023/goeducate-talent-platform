import mongoose, { Schema } from "mongoose";

export type EvaluationReportDoc = {
  filmSubmissionId: mongoose.Types.ObjectId;
  playerUserId: mongoose.Types.ObjectId;
  evaluatorUserId: mongoose.Types.ObjectId;
  overallGrade: number;
  strengths: string;
  improvements: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
};

const EvaluationReportSchema = new Schema<EvaluationReportDoc>(
  {
    filmSubmissionId: { type: Schema.Types.ObjectId, ref: "FilmSubmission", required: true, unique: true, index: true },
    playerUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    evaluatorUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    overallGrade: { type: Number, required: true, min: 1, max: 10 },
    strengths: { type: String, required: true },
    improvements: { type: String, required: true },
    notes: { type: String }
  },
  { timestamps: true }
);

EvaluationReportSchema.index({ playerUserId: 1, createdAt: -1 });

export const EvaluationReportModel =
  (mongoose.models.EvaluationReport as mongoose.Model<EvaluationReportDoc> | undefined) ??
  mongoose.model<EvaluationReportDoc>("EvaluationReport", EvaluationReportSchema);


