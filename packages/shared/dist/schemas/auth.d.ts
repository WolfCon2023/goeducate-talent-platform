import { z } from "zod";
export declare const RegisterSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    role: z.ZodEnum<{
        player: "player";
        coach: "coach";
        evaluator: "evaluator";
        admin: "admin";
    }>;
    firstName: z.ZodOptional<z.ZodString>;
    lastName: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export declare const LoginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, z.core.$strip>;
export type LoginInput = z.infer<typeof LoginSchema>;
export declare const AuthTokenPayloadSchema: z.ZodObject<{
    sub: z.ZodString;
    role: z.ZodEnum<{
        player: "player";
        coach: "coach";
        evaluator: "evaluator";
        admin: "admin";
    }>;
}, z.core.$strip>;
export type AuthTokenPayload = z.infer<typeof AuthTokenPayloadSchema>;
//# sourceMappingURL=auth.d.ts.map