import crypto from "node:crypto";
function nowMs() {
    return Number(process.hrtime.bigint() / BigInt(1e6));
}
export function requestLogger(req, res, next) {
    const start = nowMs();
    const requestId = crypto.randomUUID();
    req.requestId = requestId;
    res.setHeader("x-request-id", requestId);
    res.on("finish", () => {
        const durationMs = nowMs() - start;
        const userId = req.user?.id ?? null;
        const role = req.user?.role ?? null;
        const method = req.method;
        const path = req.originalUrl || req.url;
        const status = res.statusCode;
        // Single-line JSON-ish log for easy searching in Railway logs.
        // Avoid logging request bodies / auth headers.
        console.log(JSON.stringify({
            level: "info",
            msg: "request",
            requestId,
            method,
            path,
            status,
            durationMs,
            userId,
            role
        }));
    });
    return next();
}
//# sourceMappingURL=requestLogger.js.map