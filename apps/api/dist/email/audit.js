import mongoose from "mongoose";
import { EmailAuditLogModel, EMAIL_AUDIT_STATUS } from "../models/EmailAuditLog.js";
function normalizeList(v) {
    if (!v)
        return [];
    return (Array.isArray(v) ? v : [v]).map((s) => String(s).trim()).filter(Boolean);
}
export async function auditEmailSend(args) {
    // Best-effort: never throw from auditing.
    try {
        const doc = {
            type: args.type,
            status: args.status === "sent" ? EMAIL_AUDIT_STATUS.SENT : args.status === "skipped" ? EMAIL_AUDIT_STATUS.SKIPPED : EMAIL_AUDIT_STATUS.FAILED,
            to: args.to,
            subject: args.subject,
            ...(args.from ? { from: args.from } : {}),
            ...(normalizeList(args.cc).length ? { cc: normalizeList(args.cc) } : {}),
            ...(normalizeList(args.bcc).length ? { bcc: normalizeList(args.bcc) } : {}),
            ...(args.messageId ? { messageId: args.messageId } : {}),
            ...(typeof args.meta !== "undefined" ? { meta: args.meta } : {}),
            ...(typeof args.error !== "undefined" ? { error: args.error } : {})
        };
        const rel = args.related ?? {};
        if (rel.accessRequestId && mongoose.isValidObjectId(rel.accessRequestId))
            doc.relatedAccessRequestId = new mongoose.Types.ObjectId(rel.accessRequestId);
        if (rel.inviteEmail)
            doc.relatedInviteEmail = String(rel.inviteEmail).trim().toLowerCase();
        if (rel.userId && mongoose.isValidObjectId(rel.userId))
            doc.relatedUserId = new mongoose.Types.ObjectId(rel.userId);
        if (rel.filmSubmissionId && mongoose.isValidObjectId(rel.filmSubmissionId))
            doc.relatedFilmSubmissionId = new mongoose.Types.ObjectId(rel.filmSubmissionId);
        if (rel.showcaseId && mongoose.isValidObjectId(rel.showcaseId))
            doc.relatedShowcaseId = new mongoose.Types.ObjectId(rel.showcaseId);
        if (rel.showcaseRegistrationId && mongoose.isValidObjectId(rel.showcaseRegistrationId))
            doc.relatedShowcaseRegistrationId = new mongoose.Types.ObjectId(rel.showcaseRegistrationId);
        await EmailAuditLogModel.create(doc);
    }
    catch {
        // ignore
    }
}
export async function sendMailWithAudit(args) {
    const to = String(args.mail.to ?? "");
    const subject = String(args.mail.subject ?? "");
    const from = typeof args.mail.from === "string" ? args.mail.from : undefined;
    const cc = args.mail.cc;
    const bcc = args.mail.bcc;
    try {
        const info = await args.transporter.sendMail(args.mail);
        await auditEmailSend({
            type: args.type,
            status: "sent",
            to,
            subject,
            from,
            cc,
            bcc,
            messageId: info?.messageId,
            related: args.related,
            meta: args.meta
        });
        return info;
    }
    catch (err) {
        await auditEmailSend({
            type: args.type,
            status: "failed",
            to,
            subject,
            from,
            cc,
            bcc,
            error: err instanceof Error ? { message: err.message, name: err.name, stack: err.stack } : err,
            related: args.related,
            meta: args.meta
        });
        throw err;
    }
}
//# sourceMappingURL=audit.js.map