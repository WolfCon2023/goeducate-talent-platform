import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";

import { ROLE } from "@goeducate/shared";

import { ApiError } from "../http/errors.js";
import { zodToBadRequest } from "../http/zod.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { AccessRequestModel, ACCESS_REQUEST_STATUS } from "../models/AccessRequest.js";
import { EmailAuditLogModel, EMAIL_AUDIT_STATUS, EMAIL_AUDIT_TYPE } from "../models/EmailAuditLog.js";
import { UserModel } from "../models/User.js";
import { EvaluatorInviteModel, generateInviteToken, hashInviteToken } from "../models/EvaluatorInvite.js";
import { getEnv } from "../env.js";
import {
  isAccessRequestEmailConfigured,
  sendAccessRequestAdminAlert,
  sendAccessRequestApprovedEmail,
  sendAccessRequestRejectedEmail
} from "../email/accessRequests.js";

export const accessRequestsRouter = Router();

const CreateAccessRequestSchema = z.object({
  fullName: z.string().min(2).max(100),
  email: z.string().email().transform((v) => v.trim().toLowerCase()),
  requestedRole: z.enum(["player", "coach", "evaluator"]),
  sport: z.enum(["Basketball", "Football", "Volleyball", "Baseball", "Soccer", "Other"]),
  sportOther: z.string().min(2).max(50).optional(),
  answers: z.record(z.string(), z.union([z.string(), z.array(z.string())]))
});

const AdminReviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  adminNotes: z.string().max(2000).optional()
});

function inviteUrlForToken(token: string) {
  const env = getEnv();
  return `${env.WEB_APP_URL}/invite?token=${encodeURIComponent(token)}`;
}

async function createInviteForEmail(opts: { email: string; role: string; createdByUserId: any }) {
  const email = opts.email.trim().toLowerCase();
  const role = opts.role.trim().toLowerCase();
  const allowed = [ROLE.PLAYER, ROLE.COACH, ROLE.EVALUATOR];
  if (!allowed.includes(role as any)) {
    throw new ApiError({ status: 400, code: "BAD_REQUEST", message: "Invalid role for invite" });
  }

  const existingUser = await UserModel.findOne({ email }).lean();
  if (existingUser) {
    throw new ApiError({ status: 409, code: "EMAIL_TAKEN", message: "Email already registered" });
  }

  const token = generateInviteToken();
  const tokenHash = hashInviteToken(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

  await EvaluatorInviteModel.create({
    email,
    role: role as any,
    tokenHash,
    createdByUserId: opts.createdByUserId,
    expiresAt
  });

  return { token, expiresAtIso: expiresAt.toISOString(), inviteUrl: inviteUrlForToken(token), code: token };
}

// Public: create access request (invite-only workflow)
accessRequestsRouter.post("/api/access-requests", async (req, res, next) => {
  const parsed = CreateAccessRequestSchema.safeParse(req.body);
  if (!parsed.success) return next(zodToBadRequest(parsed.error.flatten()));

  try {
    const data = parsed.data;
    if (data.sport === "Other" && !data.sportOther) {
      return next(new ApiError({ status: 400, code: "BAD_REQUEST", message: "sportOther is required when sport is Other" }));
    }

    const existingPending = await AccessRequestModel.findOne({ email: data.email, status: ACCESS_REQUEST_STATUS.PENDING }).lean();
    if (existingPending) {
      return next(new ApiError({ status: 409, code: "DUPLICATE_PENDING", message: "An access request is already pending for this email" }));
    }

    const created = await AccessRequestModel.create({
      status: ACCESS_REQUEST_STATUS.PENDING,
      fullName: data.fullName,
      email: data.email,
      requestedRole: data.requestedRole,
      sport: data.sport,
      sportOther: data.sport === "Other" ? data.sportOther : undefined,
      answers: data.answers
    });

    // Email admins (best-effort) + audit logs.
    const admins = await UserModel.find({ role: ROLE.ADMIN }).lean();
    const adminEmails = admins.map((a) => String(a.email || "").trim()).filter(Boolean);
    if (!adminEmails.length) {
      // No admins to notify; still OK.
      await EmailAuditLogModel.create({
        type: EMAIL_AUDIT_TYPE.ACCESS_REQUEST_ADMIN_ALERT,
        status: EMAIL_AUDIT_STATUS.SKIPPED,
        to: "(no-admins)",
        subject: "GoEducate Talent – New access request",
        relatedAccessRequestId: new mongoose.Types.ObjectId(String((created as any)._id)),
        error: { reason: "no_admins" }
      });
    } else if (!isAccessRequestEmailConfigured()) {
      await EmailAuditLogModel.insertMany(
        adminEmails.map((to) => ({
          type: EMAIL_AUDIT_TYPE.ACCESS_REQUEST_ADMIN_ALERT,
          status: EMAIL_AUDIT_STATUS.SKIPPED,
          to,
          subject: "GoEducate Talent – New access request",
          relatedAccessRequestId: new mongoose.Types.ObjectId(String((created as any)._id)),
          error: { reason: "email_not_configured" }
        }))
      );
    } else {
      await Promise.all(
        adminEmails.map(async (to) => {
          try {
            const info = await sendAccessRequestAdminAlert({
              to,
              request: {
                fullName: data.fullName,
                email: data.email,
                requestedRole: data.requestedRole,
                sport: data.sport,
                sportOther: data.sport === "Other" ? data.sportOther : undefined
              }
            });
            await EmailAuditLogModel.create({
              type: EMAIL_AUDIT_TYPE.ACCESS_REQUEST_ADMIN_ALERT,
              status: EMAIL_AUDIT_STATUS.SENT,
              to,
              subject: info.subject,
              relatedAccessRequestId: new mongoose.Types.ObjectId(String((created as any)._id)),
              messageId: info.messageId
            });
          } catch (err) {
            await EmailAuditLogModel.create({
              type: EMAIL_AUDIT_TYPE.ACCESS_REQUEST_ADMIN_ALERT,
              status: EMAIL_AUDIT_STATUS.FAILED,
              to,
              subject: "GoEducate Talent – New access request",
              relatedAccessRequestId: new mongoose.Types.ObjectId(String((created as any)._id)),
              error: { message: (err as any)?.message, name: (err as any)?.name }
            });
          }
        })
      );
    }

    return res.status(201).json({ accessRequest: { id: String((created as any)._id), status: created.status } });
  } catch (err) {
    // Handle unique index race
    if ((err as any)?.code === 11000) {
      return next(new ApiError({ status: 409, code: "DUPLICATE_PENDING", message: "An access request is already pending for this email" }));
    }
    return next(err);
  }
});

// Admin: list requests
accessRequestsRouter.get("/admin/access-requests", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
  try {
    const status = String(req.query.status ?? "").trim().toLowerCase();
    const filter: any = {};
    if (status && [ACCESS_REQUEST_STATUS.PENDING, ACCESS_REQUEST_STATUS.APPROVED, ACCESS_REQUEST_STATUS.REJECTED].includes(status as any)) {
      filter.status = status;
    }
    const items = await AccessRequestModel.find(filter).sort({ createdAt: -1 }).limit(500).lean();
    return res.json({ items });
  } catch (err) {
    return next(err);
  }
});

// Admin: detail
accessRequestsRouter.get("/admin/access-requests/:id", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
  try {
    const id = new mongoose.Types.ObjectId(req.params.id);
    const item = await AccessRequestModel.findById(id).lean();
    if (!item) return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Access request not found" }));
    return res.json({ item });
  } catch (err) {
    return next(err);
  }
});

// Admin: approve/reject
accessRequestsRouter.patch("/admin/access-requests/:id", requireAuth, requireRole([ROLE.ADMIN]), async (req, res, next) => {
  const parsed = AdminReviewSchema.safeParse(req.body);
  if (!parsed.success) return next(zodToBadRequest(parsed.error.flatten()));

  try {
    const id = new mongoose.Types.ObjectId(req.params.id);
    const item = await AccessRequestModel.findById(id);
    if (!item) return next(new ApiError({ status: 404, code: "NOT_FOUND", message: "Access request not found" }));

    if (item.status !== ACCESS_REQUEST_STATUS.PENDING) {
      return next(new ApiError({ status: 409, code: "ALREADY_REVIEWED", message: "Request has already been reviewed" }));
    }

    const adminNotes = parsed.data.adminNotes?.trim() || undefined;
    const reviewerId = new mongoose.Types.ObjectId(req.user!.id);

    if (parsed.data.action === "approve") {
      // Create invite record + send applicant email (best-effort)
      const invite = await createInviteForEmail({ email: item.email, role: item.requestedRole, createdByUserId: reviewerId });

      if (isAccessRequestEmailConfigured()) {
        try {
          const info = await sendAccessRequestApprovedEmail({
            to: item.email,
            inviteUrl: invite.inviteUrl,
            inviteCode: invite.code,
            expiresAtIso: invite.expiresAtIso
          });
          await EmailAuditLogModel.create({
            type: EMAIL_AUDIT_TYPE.ACCESS_REQUEST_APPROVED,
            status: EMAIL_AUDIT_STATUS.SENT,
            to: item.email,
            subject: info.subject,
            relatedAccessRequestId: id,
            relatedInviteEmail: item.email,
            messageId: info.messageId
          });
        } catch (err) {
          await EmailAuditLogModel.create({
            type: EMAIL_AUDIT_TYPE.ACCESS_REQUEST_APPROVED,
            status: EMAIL_AUDIT_STATUS.FAILED,
            to: item.email,
            subject: "GoEducate Talent – Access request approved",
            relatedAccessRequestId: id,
            relatedInviteEmail: item.email,
            error: { message: (err as any)?.message, name: (err as any)?.name }
          });
        }
      } else {
        await EmailAuditLogModel.create({
          type: EMAIL_AUDIT_TYPE.ACCESS_REQUEST_APPROVED,
          status: EMAIL_AUDIT_STATUS.SKIPPED,
          to: item.email,
          subject: "GoEducate Talent – Access request approved",
          relatedAccessRequestId: id,
          relatedInviteEmail: item.email,
          error: { reason: "email_not_configured" }
        });
      }

      item.status = ACCESS_REQUEST_STATUS.APPROVED;
      item.adminNotes = adminNotes;
      item.reviewedBy = reviewerId;
      item.reviewedAt = new Date();
      await item.save();

      return res.json({
        ok: true,
        item,
        invite: { url: invite.inviteUrl, code: invite.code, expiresAtIso: invite.expiresAtIso }
      });
    }

    // reject
    if (isAccessRequestEmailConfigured()) {
      try {
        const info = await sendAccessRequestRejectedEmail({ to: item.email });
        await EmailAuditLogModel.create({
          type: EMAIL_AUDIT_TYPE.ACCESS_REQUEST_REJECTED,
          status: EMAIL_AUDIT_STATUS.SENT,
          to: item.email,
          subject: info.subject,
          relatedAccessRequestId: id,
          messageId: info.messageId
        });
      } catch (err) {
        await EmailAuditLogModel.create({
          type: EMAIL_AUDIT_TYPE.ACCESS_REQUEST_REJECTED,
          status: EMAIL_AUDIT_STATUS.FAILED,
          to: item.email,
          subject: "GoEducate Talent – Access request update",
          relatedAccessRequestId: id,
          error: { message: (err as any)?.message, name: (err as any)?.name }
        });
      }
    } else {
      await EmailAuditLogModel.create({
        type: EMAIL_AUDIT_TYPE.ACCESS_REQUEST_REJECTED,
        status: EMAIL_AUDIT_STATUS.SKIPPED,
        to: item.email,
        subject: "GoEducate Talent – Access request update",
        relatedAccessRequestId: id,
        error: { reason: "email_not_configured" }
      });
    }

    item.status = ACCESS_REQUEST_STATUS.REJECTED;
    item.adminNotes = adminNotes;
    item.reviewedBy = reviewerId;
    item.reviewedAt = new Date();
    await item.save();

    return res.json({ ok: true, item });
  } catch (err) {
    return next(err);
  }
});


