import { createTransporterOrThrow, escapeHtml, isEmailConfigured } from "./mailer.js";
export function isInviteEmailConfigured() {
    return isEmailConfigured();
}
export async function sendInviteEmail(input) {
    const { env, transporter } = createTransporterOrThrow();
    const subject = `GoEducate Talent – You're invited (${input.role})`;
    const text = [
        `You have been invited to GoEducate Talent as: ${input.role}`,
        ``,
        `Invite link (open this first): ${input.inviteUrl}`,
        `Invite code (required): ${input.code}`,
        `Expires: ${input.expiresAtIso}`,
        ``,
        `If you did not request this, you can ignore this email.`
    ].join("\n");
    const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
      <h2 style="margin:0 0 12px 0;">You’re invited to GoEducate Talent</h2>
      <p style="margin:0 0 12px 0;">Role: <b>${escapeHtml(input.role)}</b></p>
      <p style="margin:0 0 12px 0;">Accept the invite by clicking the button below, then paste the required code below:</p>
      <p style="margin:0 0 12px 0;">
        <a href="${escapeHtml(input.inviteUrl)}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 14px;border-radius:10px;text-decoration:none;">
          Accept invite
        </a>
      </p>
      <p style="margin:0 0 6px 0;">Invite code (required):</p>
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
//# sourceMappingURL=invites.js.map