import mongoose, { Schema } from "mongoose";
const EvaluationFormSchema = new Schema({
    title: { type: String, required: true, trim: true },
    sport: { type: String, required: true, trim: true, index: true },
    version: { type: Number, required: true, default: 1 },
    isActive: { type: Boolean, default: true, index: true },
    strengthsPrompt: { type: String, required: true },
    improvementsPrompt: { type: String, required: true },
    notesHelp: { type: String },
    categories: { type: Schema.Types.Mixed, required: true },
    createdByUserId: { type: Schema.Types.ObjectId, ref: "User", index: true }
}, { timestamps: true });
EvaluationFormSchema.index({ sport: 1, isActive: 1, updatedAt: -1 });
export const EvaluationFormModel = mongoose.models.EvaluationForm ??
    mongoose.model("EvaluationForm", EvaluationFormSchema);
//# sourceMappingURL=EvaluationForm.js.map