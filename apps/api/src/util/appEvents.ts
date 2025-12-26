import mongoose from "mongoose";

import type { AuthUser } from "../middleware/auth.js";
import { AppEventModel, type AppEventType } from "../models/AppEvent.js";

export function logAppEvent(opts: {
  type: AppEventType;
  user?: AuthUser;
  path?: string;
  meta?: Record<string, unknown>;
}) {
  try {
    const userId = opts.user?.id && mongoose.isValidObjectId(opts.user.id) ? new mongoose.Types.ObjectId(opts.user.id) : undefined;
    void AppEventModel.create({
      schemaVersion: 1,
      type: opts.type,
      userId,
      role: opts.user?.role,
      path: opts.path,
      meta: opts.meta ?? {}
    }).catch(() => {});
  } catch {
    // best-effort only
  }
}


