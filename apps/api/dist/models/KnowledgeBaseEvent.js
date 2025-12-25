import mongoose, { Schema } from "mongoose";
const KnowledgeBaseEventSchema = new Schema({
    type: { type: String, required: true, enum: ["kb_open", "kb_search", "kb_article_view", "kb_feedback"], index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    helpKey: { type: String, trim: true, maxlength: 140, index: true },
    q: { type: String, trim: true, maxlength: 400 },
    slug: { type: String, trim: true, maxlength: 220, index: true },
    meta: { type: Schema.Types.Mixed }
}, { timestamps: true });
KnowledgeBaseEventSchema.index({ type: 1, createdAt: -1 });
KnowledgeBaseEventSchema.index({ userId: 1, createdAt: -1 });
export const KnowledgeBaseEventModel = mongoose.models.KnowledgeBaseEvent ??
    mongoose.model("KnowledgeBaseEvent", KnowledgeBaseEventSchema);
//# sourceMappingURL=KnowledgeBaseEvent.js.map