import mongoose, { Schema } from "mongoose";
const ConversationSchema = new Schema({
    participantUserIds: [{ type: Schema.Types.ObjectId, ref: "User", required: true, index: true }],
    createdByUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, required: true, enum: ["pending", "accepted", "declined", "blocked"], index: true },
    lastMessageAt: { type: Date },
    lastMessagePreview: { type: String, trim: true },
    unreadCounts: { type: Schema.Types.Mixed },
    blockedByUserId: { type: Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });
// Ensure 1:1 uniqueness regardless of ordering: store a stable key
ConversationSchema.add({
    participantKey: { type: String, required: true, unique: true, index: true }
});
ConversationSchema.index({ participantKey: 1 }, { unique: true });
ConversationSchema.index({ participantUserIds: 1, updatedAt: -1 });
export const ConversationModel = mongoose.models.Conversation ??
    mongoose.model("Conversation", ConversationSchema);
export function conversationKeyFor(userA, userB) {
    const [a, b] = [String(userA), String(userB)].sort();
    return `${a}:${b}`;
}
//# sourceMappingURL=Conversation.js.map