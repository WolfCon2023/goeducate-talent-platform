import mongoose, { Schema } from "mongoose";
const EvaluationTemplateSchema = new Schema({
    title: { type: String, required: true, trim: true },
    sport: { type: String, required: true, trim: true, default: "any", index: true },
    position: { type: String, required: true, trim: true, default: "any", index: true },
    strengthsTemplate: { type: String, required: true },
    improvementsTemplate: { type: String, required: true },
    notesTemplate: { type: String },
    isActive: { type: Boolean, default: true, index: true },
    createdByUserId: { type: Schema.Types.ObjectId, ref: "User", index: true }
}, { timestamps: true });
EvaluationTemplateSchema.index({ sport: 1, position: 1, isActive: 1, updatedAt: -1 });
export const EvaluationTemplateModel = mongoose.models.EvaluationTemplate ??
    mongoose.model("EvaluationTemplate", EvaluationTemplateSchema);
//# sourceMappingURL=EvaluationTemplate.js.map