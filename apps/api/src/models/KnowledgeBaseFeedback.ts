import mongoose, { Schema } from "mongoose";

export type KnowledgeBaseFeedbackDoc = {
  articleId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  helpful: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const KnowledgeBaseFeedbackSchema = new Schema<KnowledgeBaseFeedbackDoc>(
  {
    articleId: { type: Schema.Types.ObjectId, ref: "KnowledgeBaseArticle", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    helpful: { type: Boolean, required: true }
  },
  { timestamps: true }
);

KnowledgeBaseFeedbackSchema.index({ articleId: 1, userId: 1 }, { unique: true });
KnowledgeBaseFeedbackSchema.index({ articleId: 1, helpful: 1 });

export const KnowledgeBaseFeedbackModel =
  (mongoose.models.KnowledgeBaseFeedback as mongoose.Model<KnowledgeBaseFeedbackDoc> | undefined) ??
  mongoose.model<KnowledgeBaseFeedbackDoc>("KnowledgeBaseFeedback", KnowledgeBaseFeedbackSchema);


