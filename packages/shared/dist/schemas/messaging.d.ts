import { z } from "zod";
export declare const ConversationStatusSchema: z.ZodEnum<{
    pending: "pending";
    accepted: "accepted";
    declined: "declined";
    blocked: "blocked";
}>;
export type ConversationStatus = z.infer<typeof ConversationStatusSchema>;
export declare const ConversationSchema: z.ZodObject<{
    _id: z.ZodOptional<z.ZodString>;
    participantUserIds: z.ZodArray<z.ZodString>;
    createdByUserId: z.ZodString;
    status: z.ZodEnum<{
        pending: "pending";
        accepted: "accepted";
        declined: "declined";
        blocked: "blocked";
    }>;
    lastMessageAt: z.ZodOptional<z.ZodString>;
    lastMessagePreview: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodOptional<z.ZodString>;
    updatedAt: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type Conversation = z.infer<typeof ConversationSchema>;
export declare const MessageSchema: z.ZodObject<{
    _id: z.ZodOptional<z.ZodString>;
    conversationId: z.ZodString;
    senderUserId: z.ZodString;
    body: z.ZodString;
    createdAt: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type Message = z.infer<typeof MessageSchema>;
export declare const CreateConversationSchema: z.ZodObject<{
    recipientUserId: z.ZodString;
    message: z.ZodString;
}, z.core.$strip>;
export type CreateConversationInput = z.infer<typeof CreateConversationSchema>;
export declare const SendMessageSchema: z.ZodObject<{
    body: z.ZodString;
}, z.core.$strip>;
export type SendMessageInput = z.infer<typeof SendMessageSchema>;
//# sourceMappingURL=messaging.d.ts.map