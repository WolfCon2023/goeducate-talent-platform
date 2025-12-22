import { Router } from "express";
import { z } from "zod";

import { ApiError } from "../http/errors.js";
import { zodToBadRequest } from "../http/zod.js";
import { getEnv } from "../env.js";
import { EmailAuditLogModel, EMAIL_AUDIT_STATUS, EMAIL_AUDIT_TYPE } from "../models/EmailAuditLog.js";
import { isContactEmailConfigured, sendContactFormEmail } from "../email/contactForm.js";

export const publicContactRouter = Router();

const ContactSchema = z.object({
  fullName: z.string().min(2).max(100),
  email: z.string().email().transform((v) => v.trim().toLowerCase()),
  subject: z.string().min(2).max(120),
  message: z.string().min(10).max(5000),
  // Honeypot (should be empty)
  company: z.string().max(0).optional()
});

// Very small in-memory rate limit (good enough for MVP)
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 5; // per IP per window
const rl = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string) {
  const now = Date.now();
  const cur = rl.get(key);
  if (!cur || cur.resetAt < now) {
    rl.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return;
  }
  if (cur.count >= RATE_LIMIT_MAX) {
    throw new ApiError({ status: 429, code: "RATE_LIMITED", message: "Too many requests. Please try again later." });
  }
  cur.count += 1;
}

publicContactRouter.post("/contact", async (req, res, next) => {
  const parsed = ContactSchema.safeParse(req.body);
  if (!parsed.success) return next(zodToBadRequest(parsed.error.flatten()));

  try {
    const env = getEnv();
    if (!isContactEmailConfigured()) {
      return next(new ApiError({ status: 501, code: "NOT_CONFIGURED", message: "Email is not configured" }));
    }

    const xfwd = ((req as any)?.headers?.["x-forwarded-for"] ?? "") as string | string[];
    const xfwdVal = Array.isArray(xfwd) ? xfwd[0] : xfwd;
    const ip = (String(xfwdVal || req.socket?.remoteAddress || "").split(",").map((s) => s.trim()).filter(Boolean)[0] ?? "").trim();
    checkRateLimit(ip || "unknown");

    const data = parsed.data;
    if (data.company && data.company.trim()) {
      // Bot trap: pretend success.
      return res.json({ ok: true });
    }

    const to = env.CONTACT_TO_EMAIL ?? "info@goeducateinc.org";

    try {
      const info = await sendContactFormEmail({
        to,
        fromEmail: data.email,
        fromName: data.fullName,
        subject: data.subject,
        message: data.message,
        meta: {
          ip: ip || undefined,
          userAgent: String(req.headers["user-agent"] ?? "") || undefined
        }
      });

      await EmailAuditLogModel.create({
        type: EMAIL_AUDIT_TYPE.CONTACT_FORM,
        status: EMAIL_AUDIT_STATUS.SENT,
        to,
        subject: info.subject,
        messageId: info.messageId
      });
    } catch (err) {
      await EmailAuditLogModel.create({
        type: EMAIL_AUDIT_TYPE.CONTACT_FORM,
        status: EMAIL_AUDIT_STATUS.FAILED,
        to,
        subject: `GoEducate Talent – Contact form: ${data.subject}`.slice(0, 180),
        error: { message: (err as any)?.message, name: (err as any)?.name }
      });
      throw err;
    }

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});


