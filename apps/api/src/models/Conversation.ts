import mongoose, { Schema } from "mongoose";

export type ConversationStatus = "pending" | "accepted" | "declined" | "blocked";

export type ConversationDoc = {
  participantUserIds: mongoose.Types.ObjectId[]; // always length 2 for MVP
  createdByUserId: mongoose.Types.ObjectId;
  status: ConversationStatus;
  lastMessageAt?: Date;
  lastMessagePreview?: string;
  // Per-user unread counters (simple + fast for inbox lists)
  unreadCounts?: Record<string, number>;
  // For moderation / safety
  blockedByUserId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const ConversationSchema = new Schema<ConversationDoc>(
  {
    participantUserIds: [{ type: Schema.Types.ObjectId, ref: "User", required: true, index: true }],
    createdByUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, required: true, enum: ["pending", "accepted", "declined", "blocked"], index: true },
    lastMessageAt: { type: Date },
    lastMessagePreview: { type: String, trim: true },
    unreadCounts: { type: Schema.Types.Mixed },
    blockedByUserId: { type: Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

// Ensure 1:1 uniqueness regardless of ordering: store a stable key
ConversationSchema.add({
  participantKey: { type: String, required: true, unique: true, index: true }
} as any);

ConversationSchema.index({ participantKey: 1 }, { unique: true });
ConversationSchema.index({ participantUserIds: 1, updatedAt: -1 });

export const ConversationModel =
  (mongoose.models.Conversation as mongoose.Model<ConversationDoc> | undefined) ??
  mongoose.model<ConversationDoc>("Conversation", ConversationSchema);

export function conversationKeyFor(userA: string, userB: string) {
  const [a, b] = [String(userA), String(userB)].sort();
  return `${a}:${b}`;
}


