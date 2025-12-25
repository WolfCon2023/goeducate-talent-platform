import mongoose, { Schema } from "mongoose";
const KnowledgeBaseArticleSchema = new Schema({
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 220 },
    summary: { type: String, trim: true, maxlength: 500 },
    body: { type: String, required: true, trim: true, maxlength: 200_000 },
    tags: [{ type: String, trim: true, lowercase: true, maxlength: 60, index: true }],
    category: { type: String, trim: true, lowercase: true, maxlength: 80, index: true },
    helpKeys: [{ type: String, trim: true, maxlength: 140, index: true }],
    status: { type: String, required: true, enum: ["draft", "published"], default: "draft", index: true },
    version: { type: Number, required: true, default: 1 },
    publishedAt: { type: Date },
    createdByUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    updatedByUserId: { type: Schema.Types.ObjectId, ref: "User" },
    helpfulYesCount: { type: Number, required: true, default: 0 },
    helpfulNoCount: { type: Number, required: true, default: 0 }
}, { timestamps: true });
KnowledgeBaseArticleSchema.index({ slug: 1 }, { unique: true });
KnowledgeBaseArticleSchema.index({ status: 1, updatedAt: -1 });
KnowledgeBaseArticleSchema.index({ status: 1, category: 1, updatedAt: -1 });
KnowledgeBaseArticleSchema.index({ status: 1, helpKeys: 1, updatedAt: -1 });
KnowledgeBaseArticleSchema.index({ title: "text", summary: "text", body: "text", tags: "text", category: "text" }, {
    weights: { title: 10, tags: 6, summary: 4, body: 1, category: 3 },
    name: "kb_text_idx"
});
export const KnowledgeBaseArticleModel = mongoose.models.KnowledgeBaseArticle ??
    mongoose.model("KnowledgeBaseArticle", KnowledgeBaseArticleSchema);
//# sourceMappingURL=KnowledgeBaseArticle.js.map