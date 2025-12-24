import { z } from "zod";
export declare const ShowcaseRegistrationStatusSchema: z.ZodEnum<{
    pending: "pending";
    paid: "paid";
    failed: "failed";
    refunded: "refunded";
}>;
export declare const ShowcaseRegistrationCreateSchema: z.ZodObject<{
    fullName: z.ZodString;
    email: z.ZodString;
    role: z.ZodOptional<z.ZodEnum<{
        player: "player";
        coach: "coach";
        evaluator: "evaluator";
        admin: "admin";
    }>>;
    sport: z.ZodOptional<z.ZodEnum<{
        football: "football";
        basketball: "basketball";
        volleyball: "volleyball";
        soccer: "soccer";
        other: "other";
        baseball: "baseball";
    }>>;
    waiverAccepted: z.ZodLiteral<true>;
    waiverVersion: z.ZodOptional<z.ZodString>;
    refundPolicyAccepted: z.ZodLiteral<true>;
    refundPolicyVersion: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type ShowcaseRegistrationCreateInput = z.infer<typeof ShowcaseRegistrationCreateSchema>;
//# sourceMappingURL=showcaseRegistration.d.ts.map