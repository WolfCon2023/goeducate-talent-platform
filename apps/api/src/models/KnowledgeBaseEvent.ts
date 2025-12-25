import mongoose, { Schema } from "mongoose";

export type KnowledgeBaseEventDoc = {
  type: "kb_open" | "kb_search" | "kb_article_view" | "kb_feedback";
  userId?: mongoose.Types.ObjectId;
  helpKey?: string;
  q?: string;
  slug?: string;
  meta?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

const KnowledgeBaseEventSchema = new Schema<KnowledgeBaseEventDoc>(
  {
    type: { type: String, required: true, enum: ["kb_open", "kb_search", "kb_article_view", "kb_feedback"], index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    helpKey: { type: String, trim: true, maxlength: 140, index: true },
    q: { type: String, trim: true, maxlength: 400 },
    slug: { type: String, trim: true, maxlength: 220, index: true },
    meta: { type: Schema.Types.Mixed }
  },
  { timestamps: true }
);

KnowledgeBaseEventSchema.index({ type: 1, createdAt: -1 });
KnowledgeBaseEventSchema.index({ userId: 1, createdAt: -1 });

export const KnowledgeBaseEventModel =
  (mongoose.models.KnowledgeBaseEvent as mongoose.Model<KnowledgeBaseEventDoc> | undefined) ??
  mongoose.model<KnowledgeBaseEventDoc>("KnowledgeBaseEvent", KnowledgeBaseEventSchema);


