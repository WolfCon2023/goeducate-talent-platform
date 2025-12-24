import jwt from "jsonwebtoken";
import { AuthTokenPayloadSchema } from "@goeducate/shared";
export function signAccessToken(payload, jwtSecret) {
    return jwt.sign(payload, jwtSecret, { expiresIn: "7d" });
}
export function verifyAccessToken(token, jwtSecret) {
    const decoded = jwt.verify(token, jwtSecret);
    const parsed = AuthTokenPayloadSchema.safeParse(decoded);
    if (!parsed.success)
        throw new Error("Invalid token payload");
    return parsed.data;
}
//# sourceMappingURL=jwt.js.map