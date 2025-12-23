import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/health", (_req, res) => {
  res.json({
    ok: true,
    // Railway sets these in many setups; if missing, they’ll be null.
    railway: {
      gitCommitSha: process.env.RAILWAY_GIT_COMMIT_SHA ?? null,
      environment: process.env.RAILWAY_ENVIRONMENT_NAME ?? null,
      service: process.env.RAILWAY_SERVICE_NAME ?? null
    }
  });
});



