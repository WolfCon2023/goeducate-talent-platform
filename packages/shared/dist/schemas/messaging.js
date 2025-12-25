import { z } from "zod";
export const ConversationStatusSchema = z.enum(["pending", "accepted", "declined", "blocked"]);
export const ConversationSchema = z.object({
    _id: z.string().optional(),
    participantUserIds: z.array(z.string().min(1)).min(2).max(2),
    createdByUserId: z.string().min(1),
    status: ConversationStatusSchema,
    lastMessageAt: z.string().optional(),
    lastMessagePreview: z.string().max(240).optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional()
});
export const MessageSchema = z.object({
    _id: z.string().optional(),
    conversationId: z.string().min(1),
    senderUserId: z.string().min(1),
    body: z.string().min(1).max(4000),
    createdAt: z.string().optional()
});
export const CreateConversationSchema = z.object({
    recipientUserId: z.string().min(1),
    message: z.string().min(1).max(4000)
});
export const SendMessageSchema = z.object({
    body: z.string().min(1).max(4000)
});
//# sourceMappingURL=messaging.js.map