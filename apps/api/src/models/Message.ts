import mongoose, { Schema } from "mongoose";

export type MessageDoc = {
  conversationId: mongoose.Types.ObjectId;
  senderUserId: mongoose.Types.ObjectId;
  body: string;
  createdAt: Date;
};

const MessageSchema = new Schema<MessageDoc>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    senderUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    body: { type: String, required: true, trim: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

MessageSchema.index({ conversationId: 1, createdAt: -1 });

export const MessageModel =
  (mongoose.models.Message as mongoose.Model<MessageDoc> | undefined) ?? mongoose.model<MessageDoc>("Message", MessageSchema);


