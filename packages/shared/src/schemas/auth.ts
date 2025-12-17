import { z } from "zod";

import { ALL_ROLES } from "../roles";

export const RegisterSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(200),
  role: z.enum(ALL_ROLES)
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200)
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const AuthTokenPayloadSchema = z.object({
  sub: z.string().min(1),
  role: z.enum(ALL_ROLES)
});

export type AuthTokenPayload = z.infer<typeof AuthTokenPayloadSchema>;


