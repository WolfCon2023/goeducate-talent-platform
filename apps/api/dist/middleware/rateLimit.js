import { ApiError } from "../http/errors.js";
const buckets = new Map();
function nowMs() {
    return Date.now();
}
function getClientIp(req) {
    const xfwd = (req?.headers?.["x-forwarded-for"] ?? "");
    const xfwdVal = Array.isArray(xfwd) ? xfwd[0] : xfwd;
    const ip = (String(xfwdVal || req?.socket?.remoteAddress || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)[0] ?? "").trim();
    return ip || "unknown";
}
export function rateLimit(opts) {
    return function rateLimitMiddleware(req, _res, next) {
        try {
            const ip = getClientIp(req);
            const k = `${opts.keyPrefix}:${ip}`;
            const now = nowMs();
            const cur = buckets.get(k);
            if (!cur || cur.resetAt < now) {
                buckets.set(k, { count: 1, resetAt: now + opts.windowMs });
                return next();
            }
            if (cur.count >= opts.max) {
                return next(new ApiError({ status: 429, code: "RATE_LIMITED", message: "Too many requests. Please try again later." }));
            }
            cur.count += 1;
            return next();
        }
        catch (err) {
            return next(err);
        }
    };
}
//# sourceMappingURL=rateLimit.js.map