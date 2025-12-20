import nodemailer from "nodemailer";

import { getEnv } from "../env.js";
import { ApiError } from "../http/errors.js";

export type InviteEmail = {
  to: string;
  role: string;
  code: string;
  inviteUrl: string;
  expiresAtIso: string;
};

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function isInviteEmailConfigured() {
  const env = getEnv();
  return !!(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS && env.INVITE_FROM_EMAIL && env.WEB_APP_URL);
}

function extractEmailAddress(from: string) {
  const trimmed = from.trim();
  const match = trimmed.match(/<([^>]+)>/);
  const email = (match?.[1] ?? trimmed).trim();
  if (!email.includes("@")) {
    throw new ApiError({ status: 500, code: "INVALID_CONFIG", message: "INVITE_FROM_EMAIL must contain a valid email address" });
  }
  return email;
}

export async function sendInviteEmail(input: InviteEmail) {
  const env = getEnv();
  if (!env.SMTP_HOST || !env.SMTP_PORT || !env.SMTP_USER || !env.SMTP_PASS || !env.INVITE_FROM_EMAIL || !env.WEB_APP_URL) {
    throw new ApiError({ status: 501, code: "NOT_CONFIGURED", message: "Email is not configured" });
  }

  // Validate sender format (allow "Name <email>" or "email").
  extractEmailAddress(env.INVITE_FROM_EMAIL);

  // Normalize boolean parsing for env-provided values.
  // 587 (STARTTLS): SMTP_SECURE=false
  // 465 (implicit TLS): SMTP_SECURE=true
  const smtpSecure =
    (env as any).SMTP_SECURE === true ||
    (env as any).SMTP_SECURE === "true" ||
    (env as any).SMTP_SECURE === 1 ||
    (env as any).SMTP_SECURE === "1";

  const transporter = nodemailer.createTransport({
    host: String(env.SMTP_HOST).trim(),
    port: Number(env.SMTP_PORT),
    secure: smtpSecure, // must be a real boolean
    auth: { user: String(env.SMTP_USER).trim(), pass: String(env.SMTP_PASS) }
  });

  const subject = `GoEducate Talent – You're invited (${input.role})`;

  const text = [
    `You have been invited to GoEducate Talent as: ${input.role}`,
    ``,
    `Invite link: ${input.inviteUrl}`,
    `Invite code: ${input.code}`,
    `Expires: ${input.expiresAtIso}`,
    ``,
    `If you did not request this, you can ignore this email.`
  ].join("\n");

  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
      <h2 style="margin:0 0 12px 0;">You’re invited to GoEducate Talent</h2>
      <p style="margin:0 0 12px 0;">Role: <b>${escapeHtml(input.role)}</b></p>
      <p style="margin:0 0 12px 0;">Click to create your account:</p>
      <p style="margin:0 0 12px 0;">
        <a href="${escapeHtml(input.inviteUrl)}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 14px;border-radius:10px;text-decoration:none;">
          Accept invite
        </a>
      </p>
      <p style="margin:0 0 6px 0;">Or paste this code:</p>
      <pre style="background:#111318;color:#ededed;padding:12px;border-radius:10px;overflow:auto;">${escapeHtml(input.code)}</pre>
      <p style="color:#51607F;margin:12px 0 0 0;">Expires: ${escapeHtml(input.expiresAtIso)}</p>
    </div>
  `.trim();

  await transporter.sendMail({
    from: env.INVITE_FROM_EMAIL,
    to: input.to,
    subject,
    text,
    html
  });
}


