import mongoose, { Schema } from "mongoose";
const MessageSchema = new Schema({
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    senderUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    body: { type: String, required: true, trim: true }
}, { timestamps: { createdAt: true, updatedAt: false } });
MessageSchema.index({ conversationId: 1, createdAt: -1 });
export const MessageModel = mongoose.models.Message ?? mongoose.model("Message", MessageSchema);
//# sourceMappingURL=Message.js.map