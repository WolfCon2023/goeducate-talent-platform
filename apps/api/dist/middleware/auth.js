import { ROLE } from "@goeducate/shared";
import { verifyAccessToken } from "../auth/jwt.js";
import { ApiError } from "../http/errors.js";
import { getEnv } from "../env.js";
export function requireAuth(req, _res, next) {
    const header = req.header("authorization");
    if (!header?.toLowerCase().startsWith("bearer ")) {
        return next(new ApiError({ status: 401, code: "UNAUTHORIZED", message: "Missing bearer token" }));
    }
    const token = header.slice("bearer ".length).trim();
    try {
        const env = getEnv();
        const payload = verifyAccessToken(token, env.JWT_SECRET);
        req.user = { id: payload.sub, role: payload.role };
        return next();
    }
    catch {
        return next(new ApiError({ status: 401, code: "UNAUTHORIZED", message: "Invalid token" }));
    }
}
// Optional auth: attaches req.user if a valid bearer token is present, otherwise continues anonymously.
export function maybeAuth(req, _res, next) {
    const header = req.header("authorization");
    if (!header?.toLowerCase().startsWith("bearer "))
        return next();
    const token = header.slice("bearer ".length).trim();
    try {
        const env = getEnv();
        const payload = verifyAccessToken(token, env.JWT_SECRET);
        req.user = { id: payload.sub, role: payload.role };
    }
    catch {
        // Ignore invalid tokens for public endpoints; use requireAuth for protected routes.
    }
    return next();
}
export function requireRole(allowed) {
    return (req, _res, next) => {
        if (!req.user) {
            return next(new ApiError({ status: 401, code: "UNAUTHORIZED", message: "Not authenticated" }));
        }
        if (!allowed.includes(req.user.role)) {
            return next(new ApiError({ status: 403, code: "FORBIDDEN", message: "Insufficient permissions" }));
        }
        return next();
    };
}
export const requireAdmin = requireRole([ROLE.ADMIN]);
//# sourceMappingURL=auth.js.map