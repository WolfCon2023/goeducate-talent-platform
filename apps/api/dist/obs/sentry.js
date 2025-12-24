import * as Sentry from "@sentry/node";
import { getEnv } from "../env.js";
let _inited = false;
export function initSentry() {
    if (_inited)
        return;
    _inited = true;
    const env = getEnv();
    if (!env.SENTRY_DSN)
        return;
    Sentry.init({
        dsn: env.SENTRY_DSN,
        environment: env.NODE_ENV,
        tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE ?? 0
    });
}
export function isSentryEnabled() {
    const env = getEnv();
    return Boolean(env.SENTRY_DSN);
}
export function captureException(err, ctx) {
    if (!isSentryEnabled())
        return;
    const req = ctx?.req;
    Sentry.withScope((scope) => {
        if (req) {
            scope.setTag("method", req.method);
            scope.setTag("path", req.originalUrl || req.url);
            scope.setTag("role", req.user?.role ?? "unknown");
            scope.setUser(req.user ? { id: req.user.id } : null);
            scope.setContext("request", {
                requestId: req.requestId ?? null,
                ip: req.ip ?? null,
                userAgent: req.header("user-agent") ?? null
            });
        }
        if (ctx?.extra)
            scope.setContext("extra", ctx.extra);
        Sentry.captureException(err);
    });
}
//# sourceMappingURL=sentry.js.map