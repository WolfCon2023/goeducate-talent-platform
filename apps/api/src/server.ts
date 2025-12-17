import "dotenv/config";

import cors from "cors";
import express from "express";

import { connectDb } from "./db";
import { getEnv } from "./env";
import { errorHandler } from "./http/errors";
import { authRouter } from "./routes/auth";
import { healthRouter } from "./routes/health";
import { playerProfilesRouter } from "./routes/playerProfiles";

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
  app.use(express.json({ limit: "2mb" }));

  app.use(healthRouter);
  app.use(authRouter);
  app.use(playerProfilesRouter);

  app.use(errorHandler);

  app.listen(env.PORT, () => {
    console.log(`[api] listening on http://localhost:${env.PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


