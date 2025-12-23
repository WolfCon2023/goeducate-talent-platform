import type { NextFunction, Request, Response } from "express";

import { captureException } from "../obs/sentry.js";

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(args: { status: number; code: string; message: string; details?: unknown }) {
    super(args.message);
    this.status = args.status;
    this.code = args.code;
    this.details = args.details;
  }
}

export function errorHandler(err: unknown, req: Request, res: Response<ApiErrorBody>, _next: NextFunction) {
  if (err instanceof ApiError) {
    // Only report 5xx ApiErrors to Sentry to reduce noise.
    if (err.status >= 500) {
      captureException(err, { req, extra: { code: err.code, details: err.details } });
    }
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details }
    });
  }
  console.error(err);
  captureException(err, { req });
  return res.status(500).json({ error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" } });
}



