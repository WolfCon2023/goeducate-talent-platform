import nodemailer from "nodemailer";

import { getEnv } from "../env.js";
import { ApiError } from "../http/errors.js";

export function escapeHtml(s: string) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function unquote(v: string) {
  const t = v.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1).trim();
  }
  return t;
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

// NOTE: Do NOT require WEB_APP_URL for basic email sending. Some deploys forget it on the API service,
// but we still want confirmations/alerts to go out (links will be omitted if missing).
export function isEmailConfigured() {
  const env = getEnv();
  return !!(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS && env.INVITE_FROM_EMAIL);
}

export function createTransporterOrThrow() {
  const env = getEnv();
  if (!env.SMTP_HOST || !env.SMTP_PORT || !env.SMTP_USER || !env.SMTP_PASS || !env.INVITE_FROM_EMAIL) {
    throw new ApiError({ status: 501, code: "NOT_CONFIGURED", message: "Email is not configured" });
  }

  // Validate sender format (allow "Name <email>" or "email").
  extractEmailAddress(unquote(env.INVITE_FROM_EMAIL));

  const transporter = nodemailer.createTransport({
    host: unquote(env.SMTP_HOST),
    port: env.SMTP_PORT,
    // Use parsed boolean from env.ts; if unset, default based on port (465 => true, otherwise false).
    secure: env.SMTP_SECURE ?? env.SMTP_PORT === 465,
    auth: { user: unquote(env.SMTP_USER), pass: unquote(env.SMTP_PASS) },
    ...(env.SMTP_AUTH_METHOD ? { authMethod: env.SMTP_AUTH_METHOD } : {}),
    tls: {
      minVersion: "TLSv1.2",
      servername: unquote(env.SMTP_HOST)
    }
  });

  return { env, transporter };
}


