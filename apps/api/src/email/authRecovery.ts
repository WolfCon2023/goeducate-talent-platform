import { EMAIL_AUDIT_TYPE } from "../models/EmailAuditLog.js";
import { createTransporterOrThrow, escapeHtml, isEmailConfigured } from "./mailer.js";
import { sendMailWithAudit } from "./audit.js";

export function isAuthRecoveryEmailConfigured() {
  return isEmailConfigured();
}

export async function sendUsernameReminderEmail(input: { to: string; username: string; loginEmail: string }) {
  const { env, transporter } = createTransporterOrThrow();
  const subject = "GoEducate Talent – Username reminder";

  const text = [
    "Username reminder",
    "",
    `Username: ${input.username}`,
    `Login email: ${input.loginEmail}`,
    "",
    "If you did not request this, you can ignore this email."
  ].join("\n");

  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
      <h2 style="margin:0 0 12px 0;">Username reminder</h2>
      <p style="margin:0 0 12px 0;">Here are your GoEducate Talent sign-in details:</p>
      <p style="margin:0 0 6px 0;">Username:</p>
      <pre style="background:#111318;color:#ededed;padding:12px;border-radius:10px;overflow:auto;">${escapeHtml(input.username)}</pre>
      <p style="margin:12px 0 6px 0;">Email:</p>
      <pre style="background:#111318;color:#ededed;padding:12px;border-radius:10px;overflow:auto;">${escapeHtml(input.loginEmail)}</pre>
      <p style="color:#51607F;margin:12px 0 0 0;">If you did not request this, you can ignore this email.</p>
    </div>
  `.trim();

  await sendMailWithAudit({
    transporter,
    type: EMAIL_AUDIT_TYPE.AUTH_USERNAME_REMINDER,
    mail: { from: env.INVITE_FROM_EMAIL, to: input.to, subject, text, html },
    related: { userId: undefined },
    meta: { username: input.username }
  });
}

export async function sendPasswordResetEmail(input: { to: string; resetToken: string }) {
  const { env, transporter } = createTransporterOrThrow();
  const subject = "GoEducate Talent – Password reset";

  const base = String(env.WEB_APP_URL ?? "").replace(/\/+$/, "");
  const link = base ? `${base}/reset-password?token=${encodeURIComponent(input.resetToken)}` : null;

  const text = [
    "Password reset",
    "",
    "A request was made to reset your GoEducate Talent password.",
    link ? `Reset link: ${link}` : `Reset token: ${input.resetToken}`,
    "",
    "If you did not request this, you can ignore this email."
  ].join("\n");

  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
      <h2 style="margin:0 0 12px 0;">Password reset</h2>
      <p style="margin:0 0 12px 0;">A request was made to reset your GoEducate Talent password.</p>
      ${
        link
          ? `<p style="margin:0 0 12px 0;">
              <a href="${escapeHtml(link)}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 14px;border-radius:10px;text-decoration:none;">
                Reset password
              </a>
            </p>
            <p style="margin:0 0 6px 0;color:#51607F;">If the button doesn’t work, copy/paste this link:</p>
            <pre style="background:#111318;color:#ededed;padding:12px;border-radius:10px;overflow:auto;">${escapeHtml(link)}</pre>`
          : `<p style="margin:0 0 6px 0;">Reset token:</p>
            <pre style="background:#111318;color:#ededed;padding:12px;border-radius:10px;overflow:auto;">${escapeHtml(input.resetToken)}</pre>`
      }
      <p style="color:#51607F;margin:12px 0 0 0;">If you did not request this, you can ignore this email.</p>
    </div>
  `.trim();

  await sendMailWithAudit({
    transporter,
    type: EMAIL_AUDIT_TYPE.AUTH_PASSWORD_RESET,
    mail: { from: env.INVITE_FROM_EMAIL, to: input.to, subject, text, html },
    meta: { link: link ?? null }
  });
}


