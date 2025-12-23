import jwt from "jsonwebtoken";

import { AuthTokenPayloadSchema, type AuthTokenPayload } from "@goeducate/shared";

export function signAccessToken(payload: AuthTokenPayload, jwtSecret: string) {
  return jwt.sign(payload, jwtSecret, { expiresIn: "7d" });
}

export function verifyAccessToken(token: string, jwtSecret: string): AuthTokenPayload {
  const decoded = jwt.verify(token, jwtSecret);
  const parsed = AuthTokenPayloadSchema.safeParse(decoded);
  if (!parsed.success) throw new Error("Invalid token payload");
  return parsed.data;
}


