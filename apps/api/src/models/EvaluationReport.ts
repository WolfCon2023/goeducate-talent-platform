import mongoose, { Schema } from "mongoose";

export type EvaluationReportDoc = {
  filmSubmissionId: mongoose.Types.ObjectId;
  playerUserId: mongoose.Types.ObjectId;
  evaluatorUserId: mongoose.Types.ObjectId;
  sport?: string;
  position?: string;
  positionOther?: string;
  overallGrade: number;
  overallGradeRaw?: number;
  suggestedProjection?: string;
  suggestedProjectionLabel?: string;
  rubric?: unknown;
  formId?: mongoose.Types.ObjectId;
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
    sport: { type: String, trim: true },
    position: { type: String, trim: true },
    positionOther: { type: String, trim: true },
    overallGrade: { type: Number, required: true, min: 1, max: 10 },
    overallGradeRaw: { type: Number, min: 1, max: 10 },
    suggestedProjection: { type: String, trim: true },
    suggestedProjectionLabel: { type: String, trim: true },
    rubric: { type: Schema.Types.Mixed },
    formId: { type: Schema.Types.ObjectId, ref: "EvaluationForm", index: true },
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



