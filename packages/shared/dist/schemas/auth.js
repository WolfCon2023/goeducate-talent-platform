import { z } from "zod";
import { ALL_ROLES } from "../roles.js";
export const RegisterSchema = z.object({
    email: z.string().email().max(254),
    password: z.string().min(8).max(200),
    role: z.enum(ALL_ROLES),
    firstName: z.string().min(1).max(60).optional(),
    lastName: z.string().min(1).max(60).optional()
});
export const LoginSchema = z.object({
    // Backwards compatible: older clients send { email }, newer send { login } ("email or username").
    login: z.string().min(2).max(254).optional(),
    email: z.string().email().max(254).optional(),
    password: z.string().min(1).max(200)
}).refine((v) => Boolean(v.login || v.email), { message: "login is required", path: ["login"] });
export const AuthTokenPayloadSchema = z.object({
    sub: z.string().min(1),
    role: z.enum(ALL_ROLES)
});
//# sourceMappingURL=auth.js.map