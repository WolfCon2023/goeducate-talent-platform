import type { NextFunction, Request, Response } from "express";

import { ROLE, type Role } from "@goeducate/shared";

import { verifyAccessToken } from "../auth/jwt";
import { ApiError } from "../http/errors";
import { getEnv } from "../env";

export type AuthUser = {
  id: string;
  role: Role;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
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
  } catch {
    return next(new ApiError({ status: 401, code: "UNAUTHORIZED", message: "Invalid token" }));
  }
}

export function requireRole(allowed: readonly Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
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


