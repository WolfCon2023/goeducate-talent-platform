import mongoose, { Schema } from "mongoose";
const KnowledgeBaseFeedbackSchema = new Schema({
    articleId: { type: Schema.Types.ObjectId, ref: "KnowledgeBaseArticle", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    helpful: { type: Boolean, required: true }
}, { timestamps: true });
KnowledgeBaseFeedbackSchema.index({ articleId: 1, userId: 1 }, { unique: true });
KnowledgeBaseFeedbackSchema.index({ articleId: 1, helpful: 1 });
export const KnowledgeBaseFeedbackModel = mongoose.models.KnowledgeBaseFeedback ??
    mongoose.model("KnowledgeBaseFeedback", KnowledgeBaseFeedbackSchema);
//# sourceMappingURL=KnowledgeBaseFeedback.js.map