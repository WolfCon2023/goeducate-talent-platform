import "dotenv/config";
import cors from "cors";
import express from "express";
import { connectDb } from "./db.js";
import { getEnv } from "./env.js";
import { errorHandler } from "./http/errors.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { evaluationsRouter } from "./routes/evaluations.js";
import { filmSubmissionsRouter } from "./routes/filmSubmissions.js";
import { healthRouter } from "./routes/health.js";
import { playerProfilesRouter } from "./routes/playerProfiles.js";
import { watchlistsRouter } from "./routes/watchlists.js";
import { contactRouter } from "./routes/contact.js";
import { uploadsRouter } from "./routes/uploads.js";
import { billingRouter } from "./routes/billing.js";
import { stripeWebhookHandler } from "./routes/stripeWebhooks.js";
import { notificationsRouter } from "./routes/notifications.js";
import { evaluationTemplatesRouter } from "./routes/evaluationTemplates.js";
import { evaluationFormsRouter } from "./routes/evaluationForms.js";
import { profilePhotosRouter } from "./routes/profilePhotos.js";
import { accessRequestsRouter } from "./routes/accessRequests.js";
import { publicContactRouter } from "./routes/publicContact.js";
import { showcasesRouter } from "./routes/showcases.js";
import { savedSearchesRouter } from "./routes/savedSearches.js";
import { profilesRouter } from "./routes/profiles.js";
import { searchRouter } from "./routes/search.js";
import { evaluatorNotesRouter } from "./routes/evaluatorNotes.js";
import { messagesRouter } from "./routes/messages.js";
import path from "node:path";
import fs from "node:fs";
async function connectWithRetry(mongoUri, opts) {
    const maxAttempts = opts?.maxAttempts ?? 12;
    const initialDelayMs = opts?.initialDelayMs ?? 750;
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        attempt += 1;
        try {
            console.log(`[api] connecting to MongoDB (attempt ${attempt}/${maxAttempts})...`);
            await connectDb(mongoUri);
            console.log("[api] MongoDB connected");
            return;
        }
        catch (err) {
            console.error("[api] MongoDB connect failed", err);
            if (attempt >= maxAttempts) {
                console.error("[api] MongoDB connection failed too many times; continuing without DB");
                return;
            }
            const delay = Math.min(10_000, initialDelayMs * Math.pow(2, attempt - 1));
            await new Promise((r) => setTimeout(r, delay));
        }
    }
}
async function main() {
    const env = getEnv();
    const app = express();
    const commitSha = String(process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? "").trim() || "unknown";
    // Railway (and other platforms) sometimes health-check "/" by default.
    // Return 200 to avoid the service being marked unhealthy due to a 404.
    app.get("/", (_req, res) => {
        res.status(200).send("ok");
    });
    // Always stamp responses with the running commit SHA so we can debug stale deployments/caches.
    app.use((req, res, next) => {
        res.setHeader("x-goeducate-commit", commitSha);
        res.setHeader("cache-control", "no-store");
        return next();
    });
    app.use(cors({
        origin: (origin, callback) => {
            // Allow non-browser clients (curl/Postman) with no Origin header
            if (!origin)
                return callback(null, true);
            const allowed = env.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean);
            if (allowed.includes(origin))
                return callback(null, true);
            return callback(new Error("Not allowed by CORS"));
        },
        credentials: true
    }));
    // Request correlation + latency logging (helps debug Railway deploy/runtime issues).
    app.use(requestLogger);
    // Stripe webhook must receive the raw request body for signature verification.
    app.post("/webhooks/stripe", express.raw({ type: "application/json" }), stripeWebhookHandler);
    app.use(express.json({ limit: "2mb" }));
    // Static uploads (profile photos, etc.). Use a persistent volume in production.
    // IMPORTANT: Some platforms/volumes can be read-only or misconfigured at boot; don't crash the whole API.
    const uploadsRoot = env.UPLOADS_DIR ? path.resolve(env.UPLOADS_DIR) : path.resolve(process.cwd(), "uploads");
    try {
        fs.mkdirSync(uploadsRoot, { recursive: true });
        app.use("/uploads", express.static(uploadsRoot, { maxAge: env.NODE_ENV === "production" ? "7d" : 0 }));
    }
    catch (err) {
        console.error("[api] uploads directory is not writable; uploads disabled", { uploadsRoot, err });
    }
    app.use(healthRouter);
    app.use(authRouter);
    app.use(adminRouter);
    app.use(billingRouter);
    app.use(evaluationsRouter);
    app.use(filmSubmissionsRouter);
    app.use(playerProfilesRouter);
    app.use(watchlistsRouter);
    app.use(contactRouter);
    app.use(publicContactRouter);
    app.use(uploadsRouter);
    app.use(profilePhotosRouter);
    app.use(accessRequestsRouter);
    app.use(notificationsRouter);
    app.use(evaluationTemplatesRouter);
    app.use(evaluationFormsRouter);
    app.use(showcasesRouter);
    app.use(savedSearchesRouter);
    app.use(profilesRouter);
    app.use(searchRouter);
    app.use(evaluatorNotesRouter);
    app.use(messagesRouter);
    app.use(errorHandler);
    // Railway expects the process to bind to the injected PORT and listen on 0.0.0.0.
    const injectedPort = process.env.PORT;
    const parsedInjected = injectedPort != null ? Number(injectedPort) : NaN;
    const port = Number.isFinite(parsedInjected) && parsedInjected > 0 && parsedInjected < 65536 ? parsedInjected : Number(env.PORT);
    const host = "0.0.0.0";
    console.log(`[api] env.PORT=${env.PORT} process.env.PORT=${injectedPort ?? "<unset>"} chosenPort=${port}`);
    const server = app.listen(port, host, () => {
        console.log(`[api] listening on http://${host}:${port}`);
    });
    // Railway / proxies sometimes expect port 8080 regardless of configured PORT.
    // Bind a secondary listener as a compatibility fallback (same app, same process).
    const fallbackPort = 8080;
    const fallbackServer = Number.isFinite(port) && port !== fallbackPort
        ? app.listen(fallbackPort, host, () => {
            console.log(`[api] also listening on http://${host}:${fallbackPort} (fallback)`);
        })
        : null;
    // Connect to MongoDB AFTER the server is listening so Railway health checks pass even if Mongo is slow.
    // We retry a few times and keep the process alive; requests that require DB will still fail until connected.
    void connectWithRetry(env.MONGODB_URI);
    // Log and shutdown cleanly when the platform asks us to stop.
    async function shutdown(signal) {
        console.log(`[api] ${signal} received; shutting down...`);
        try {
            server.close();
        }
        catch { }
        try {
            fallbackServer?.close?.();
        }
        catch { }
        try {
            const mongoose = (await import("mongoose")).default;
            await mongoose.connection?.close?.();
        }
        catch { }
        process.exit(0);
    }
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
    process.on("SIGINT", () => void shutdown("SIGINT"));
    process.on("unhandledRejection", (reason) => {
        console.error("[api] unhandledRejection", reason);
    });
    process.on("uncaughtException", (err) => {
        console.error("[api] uncaughtException", err);
    });
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=server.js.map