import mongoose, { Schema } from "mongoose";
const EvaluatorNotesDraftSchema = new Schema({
    evaluatorUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    key: { type: String, required: true, trim: true },
    title: { type: String, trim: true },
    sport: { type: String, required: true, trim: true, index: true },
    filmSubmissionId: { type: Schema.Types.ObjectId, ref: "FilmSubmission" },
    formId: { type: Schema.Types.ObjectId, ref: "EvaluationForm" },
    payload: { type: Schema.Types.Mixed, required: true }
}, { timestamps: true });
EvaluatorNotesDraftSchema.index({ evaluatorUserId: 1, key: 1 }, { unique: true });
EvaluatorNotesDraftSchema.index({ evaluatorUserId: 1, updatedAt: -1 });
EvaluatorNotesDraftSchema.index({ evaluatorUserId: 1, title: 1, updatedAt: -1 });
export const EvaluatorNotesDraftModel = mongoose.models.EvaluatorNotesDraft ??
    mongoose.model("EvaluatorNotesDraft", EvaluatorNotesDraftSchema);
//# sourceMappingURL=EvaluatorNotesDraft.js.map