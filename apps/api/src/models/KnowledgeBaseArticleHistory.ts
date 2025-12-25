import mongoose, { Schema } from "mongoose";

export type KnowledgeBaseArticleHistoryDoc = {
  articleId: mongoose.Types.ObjectId;
  action: "created" | "updated" | "published" | "unpublished" | "deleted";
  actorUserId: mongoose.Types.ObjectId;
  snapshot: {
    title: string;
    slug: string;
    summary?: string;
    body: string;
    tags: string[];
    category?: string;
    helpKeys: string[];
    status: "draft" | "published";
    version: number;
    publishedAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
};

const KnowledgeBaseArticleHistorySchema = new Schema<KnowledgeBaseArticleHistoryDoc>(
  {
    articleId: { type: Schema.Types.ObjectId, ref: "KnowledgeBaseArticle", required: true, index: true },
    action: { type: String, required: true, enum: ["created", "updated", "published", "unpublished", "deleted"], index: true },
    actorUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    snapshot: { type: Schema.Types.Mixed, required: true }
  },
  { timestamps: true }
);

KnowledgeBaseArticleHistorySchema.index({ articleId: 1, createdAt: -1 });

export const KnowledgeBaseArticleHistoryModel =
  (mongoose.models.KnowledgeBaseArticleHistory as mongoose.Model<KnowledgeBaseArticleHistoryDoc> | undefined) ??
  mongoose.model<KnowledgeBaseArticleHistoryDoc>("KnowledgeBaseArticleHistory", KnowledgeBaseArticleHistorySchema);


