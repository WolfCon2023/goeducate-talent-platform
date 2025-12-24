import mongoose, { Schema } from "mongoose";

export type EvaluatorNotesDraftDoc = {
  evaluatorUserId: mongoose.Types.ObjectId;
  // Stable key used by the web client. Examples:
  // - "film:<filmSubmissionId>"
  // - "sport:football"
  key: string;
  sport: string;
  filmSubmissionId?: mongoose.Types.ObjectId;
  formId?: mongoose.Types.ObjectId;
  payload: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

const EvaluatorNotesDraftSchema = new Schema<EvaluatorNotesDraftDoc>(
  {
    evaluatorUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    key: { type: String, required: true, trim: true },
    sport: { type: String, required: true, trim: true, index: true },
    filmSubmissionId: { type: Schema.Types.ObjectId, ref: "FilmSubmission" },
    formId: { type: Schema.Types.ObjectId, ref: "EvaluationForm" },
    payload: { type: Schema.Types.Mixed, required: true }
  },
  { timestamps: true }
);

EvaluatorNotesDraftSchema.index({ evaluatorUserId: 1, key: 1 }, { unique: true });
EvaluatorNotesDraftSchema.index({ evaluatorUserId: 1, updatedAt: -1 });

export const EvaluatorNotesDraftModel =
  (mongoose.models.EvaluatorNotesDraft as mongoose.Model<EvaluatorNotesDraftDoc> | undefined) ??
  mongoose.model<EvaluatorNotesDraftDoc>("EvaluatorNotesDraft", EvaluatorNotesDraftSchema);


