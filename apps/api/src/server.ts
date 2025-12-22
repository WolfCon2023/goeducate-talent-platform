import "dotenv/config";

import cors from "cors";
import express from "express";

import { connectDb } from "./db.js";
import { getEnv } from "./env.js";
import { errorHandler } from "./http/errors.js";
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
import path from "node:path";
import fs from "node:fs";

async function main() {
  const env = getEnv();
  await connectDb(env.MONGODB_URI);

  const app = express();

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow non-browser clients (curl/Postman) with no Origin header
        if (!origin) return callback(null, true);
        const allowed = env.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean);
        if (allowed.includes(origin)) return callback(null, true);
        return callback(new Error("Not allowed by CORS"));
      },
      credentials: true
    })
  );

  // Stripe webhook must receive the raw request body for signature verification.
  app.post("/webhooks/stripe", express.raw({ type: "application/json" }), stripeWebhookHandler);

  app.use(express.json({ limit: "2mb" }));

  // Static uploads (profile photos, etc.). Use a persistent volume in production.
  const uploadsRoot = env.UPLOADS_DIR ? path.resolve(env.UPLOADS_DIR) : path.resolve(process.cwd(), "uploads");
  fs.mkdirSync(uploadsRoot, { recursive: true });
  app.use("/uploads", express.static(uploadsRoot, { maxAge: env.NODE_ENV === "production" ? "7d" : 0 }));

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

  app.use(errorHandler);

  // Railway expects the process to bind to the injected PORT and listen on 0.0.0.0.
  const port = Number(process.env.PORT ?? env.PORT);
  const host = "0.0.0.0";
  app.listen(port, host, () => {
    console.log(`[api] listening on http://${host}:${port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


