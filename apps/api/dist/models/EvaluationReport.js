import mongoose, { Schema } from "mongoose";
const EvaluationReportSchema = new Schema({
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
}, { timestamps: true });
EvaluationReportSchema.index({ playerUserId: 1, createdAt: -1 });
export const EvaluationReportModel = mongoose.models.EvaluationReport ??
    mongoose.model("EvaluationReport", EvaluationReportSchema);
//# sourceMappingURL=EvaluationReport.js.map