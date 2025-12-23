import type { NextFunction, Request, Response } from "express";

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

export function errorHandler(err: unknown, _req: Request, res: Response<ApiErrorBody>, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details }
    });
  }
  console.error(err);
  return res.status(500).json({ error: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" } });
}



