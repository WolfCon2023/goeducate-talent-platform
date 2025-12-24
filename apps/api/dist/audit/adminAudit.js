import mongoose from "mongoose";
import { AdminAuditLogModel } from "../models/AdminAuditLog.js";
function getClientIp(req) {
    const xfwd = (req?.headers?.["x-forwarded-for"] ?? "");
    const xfwdVal = Array.isArray(xfwd) ? xfwd[0] : xfwd;
    const ip = (String(xfwdVal || req?.socket?.remoteAddress || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)[0] ?? "").trim();
    return ip || undefined;
}
export async function logAdminAction(opts) {
    try {
        const actorUserId = new mongoose.Types.ObjectId(opts.actorUserId);
        await AdminAuditLogModel.create({
            actorUserId,
            action: opts.action,
            targetType: opts.targetType,
            targetId: opts.targetId,
            ip: getClientIp(opts.req),
            userAgent: String(opts.req?.headers?.["user-agent"] ?? "") || undefined,
            meta: opts.meta ?? undefined
        });
    }
    catch {
        // best-effort only
    }
}
//# sourceMappingURL=adminAudit.js.map