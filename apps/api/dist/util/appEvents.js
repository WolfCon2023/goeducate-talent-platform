import mongoose from "mongoose";
import { AppEventModel } from "../models/AppEvent.js";
export function logAppEvent(opts) {
    try {
        const userId = opts.user?.id && mongoose.isValidObjectId(opts.user.id) ? new mongoose.Types.ObjectId(opts.user.id) : undefined;
        void AppEventModel.create({
            type: opts.type,
            userId,
            role: opts.user?.role,
            path: opts.path,
            meta: opts.meta ?? {}
        }).catch(() => { });
    }
    catch {
        // best-effort only
    }
}
//# sourceMappingURL=appEvents.js.map