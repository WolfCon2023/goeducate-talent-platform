import { createTransporterOrThrow, escapeHtml, isEmailConfigured } from "./mailer.js";
import { sendMailWithAudit } from "./audit.js";
import { EMAIL_AUDIT_TYPE } from "../models/EmailAuditLog.js";

export function isNotificationEmailConfigured() {
  return isEmailConfigured();
}

export async function sendNotificationEmail(input: {
  to: string;
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  title: string;
  message: string;
  href?: string;
}) {
  const { env, transporter } = createTransporterOrThrow();

  const base = String(env.WEB_APP_URL ?? "").replace(/\/+$/, "");
  const link = base && input.href ? `${base}${input.href.startsWith("/") ? input.href : `/${input.href}`}` : null;

  const text = [input.title, "", input.message, link ? `Link: ${link}` : ""].filter(Boolean).join("\n");

  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
      <h2 style="margin:0 0 12px 0;">${escapeHtml(input.title)}</h2>
      <p style="margin:0 0 12px 0;">${escapeHtml(input.message)}</p>
      ${
        link
          ? `<p style="margin:0 0 12px 0;">
              <a href="${escapeHtml(link)}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 14px;border-radius:10px;text-decoration:none;">
                Open
              </a>
            </p>`
          : ""
      }
      <p style="color:#51607F;margin:12px 0 0 0;">GoEducate Talent</p>
    </div>
  `.trim();

  const ccList = Array.isArray(input.cc) ? input.cc : input.cc ? [input.cc] : [];
  const bccList = Array.isArray(input.bcc) ? input.bcc : input.bcc ? [input.bcc] : [];

  await sendMailWithAudit({
    transporter,
    type: EMAIL_AUDIT_TYPE.NOTIFICATION,
    mail: {
    from: env.INVITE_FROM_EMAIL,
    to: input.to,
    ...(ccList.length ? { cc: ccList } : {}),
    ...(bccList.length ? { bcc: bccList } : {}),
    subject: input.subject,
    text,
    html
    },
    meta: { href: input.href }
  });
}


