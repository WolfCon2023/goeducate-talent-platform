import mongoose, { Schema } from "mongoose";
const KnowledgeBaseArticleHistorySchema = new Schema({
    articleId: { type: Schema.Types.ObjectId, ref: "KnowledgeBaseArticle", required: true, index: true },
    action: { type: String, required: true, enum: ["created", "updated", "published", "unpublished", "deleted"], index: true },
    actorUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    snapshot: { type: Schema.Types.Mixed, required: true }
}, { timestamps: true });
KnowledgeBaseArticleHistorySchema.index({ articleId: 1, createdAt: -1 });
export const KnowledgeBaseArticleHistoryModel = mongoose.models.KnowledgeBaseArticleHistory ??
    mongoose.model("KnowledgeBaseArticleHistory", KnowledgeBaseArticleHistorySchema);
//# sourceMappingURL=KnowledgeBaseArticleHistory.js.map