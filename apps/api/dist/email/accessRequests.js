import { createTransporterOrThrow, escapeHtml, isEmailConfigured } from "./mailer.js";
export function isAccessRequestEmailConfigured() {
    return isEmailConfigured();
}
export async function sendAccessRequestAdminAlert(input) {
    const { env, transporter } = createTransporterOrThrow();
    const subject = "GoEducate Talent – New access request";
    const sport = input.request.sportOther ? `${input.request.sport} (${input.request.sportOther})` : input.request.sport;
    const href = `${env.WEB_APP_URL}/admin`;
    const text = [
        "A new access request was submitted.",
        "",
        `Name: ${input.request.fullName}`,
        `Email: ${input.request.email}`,
        `Requested role: ${input.request.requestedRole}`,
        `Sport: ${sport}`,
        "",
        `Review: ${href}`
    ].join("\n");
    const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
      <h2 style="margin:0 0 12px 0;">New access request</h2>
      <p style="margin:0 0 6px 0;"><b>Name:</b> ${escapeHtml(input.request.fullName)}</p>
      <p style="margin:0 0 6px 0;"><b>Email:</b> ${escapeHtml(input.request.email)}</p>
      <p style="margin:0 0 6px 0;"><b>Requested role:</b> ${escapeHtml(input.request.requestedRole)}</p>
      <p style="margin:0 0 12px 0;"><b>Sport:</b> ${escapeHtml(sport)}</p>
      <p style="margin:0 0 12px 0;">
        <a href="${escapeHtml(href)}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 14px;border-radius:10px;text-decoration:none;">
          Review in Admin
        </a>
      </p>
      <p style="color:#51607F;margin:12px 0 0 0;">GoEducate Talent</p>
    </div>
  `.trim();
    const info = await transporter.sendMail({ from: env.INVITE_FROM_EMAIL, to: input.to, subject, text, html });
    return { messageId: info?.messageId, subject };
}
export async function sendAccessRequestApprovedEmail(input) {
    const { env, transporter } = createTransporterOrThrow();
    const subject = "GoEducate Talent – Access request approved";
    const text = [
        "Your GoEducate Talent access request was approved.",
        "",
        "Next steps:",
        `1) Open your invite link: ${input.inviteUrl}`,
        `2) Paste your invite code on the Invite page (required): ${input.inviteCode}`,
        "",
        `Expires: ${input.expiresAtIso}`,
        "",
        "If you did not request access, you can ignore this email."
    ].join("\n");
    const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
      <h2 style="margin:0 0 12px 0;">Access request approved</h2>
      <p style="margin:0 0 12px 0;">Your request to access GoEducate Talent was approved.</p>
      <p style="margin:0 0 12px 0;">
        <a href="${escapeHtml(input.inviteUrl)}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 14px;border-radius:10px;text-decoration:none;">
          Create your account
        </a>
      </p>
      <p style="margin:0 0 6px 0;">Invite code (required):</p>
      <pre style="background:#111318;color:#ededed;padding:12px;border-radius:10px;overflow:auto;">${escapeHtml(input.inviteCode)}</pre>
      <p style="color:#51607F;margin:12px 0 0 0;">Expires: ${escapeHtml(input.expiresAtIso)}</p>
      <p style="color:#51607F;margin:12px 0 0 0;">GoEducate Talent</p>
    </div>
  `.trim();
    const info = await transporter.sendMail({ from: env.INVITE_FROM_EMAIL, to: input.to, subject, text, html });
    return { messageId: info?.messageId, subject };
}
export async function sendAccessRequestRejectedEmail(input) {
    const { env, transporter } = createTransporterOrThrow();
    const subject = "GoEducate Talent – Access request update";
    const text = [
        "Thank you for your interest in GoEducate Talent.",
        "",
        "At this time, we’re unable to approve your access request.",
        "",
        "If you believe this was in error, you may reply to this email to request reconsideration."
    ].join("\n");
    const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
      <h2 style="margin:0 0 12px 0;">Access request update</h2>
      <p style="margin:0 0 12px 0;">Thank you for your interest in GoEducate Talent.</p>
      <p style="margin:0 0 12px 0;">At this time, we’re unable to approve your access request.</p>
      <p style="margin:0 0 12px 0;">If you believe this was in error, you may reply to this email to request reconsideration.</p>
      <p style="color:#51607F;margin:12px 0 0 0;">GoEducate Talent</p>
    </div>
  `.trim();
    const info = await transporter.sendMail({ from: env.INVITE_FROM_EMAIL, to: input.to, subject, text, html });
    return { messageId: info?.messageId, subject };
}
//# sourceMappingURL=accessRequests.js.map