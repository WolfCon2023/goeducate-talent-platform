import { createTransporterOrThrow, escapeHtml, isEmailConfigured } from "./mailer.js";
export function isContactEmailConfigured() {
    return isEmailConfigured();
}
export async function sendContactFormEmail(input) {
    const { env, transporter } = createTransporterOrThrow();
    const subject = `GoEducate Talent – Contact form: ${input.subject}`.slice(0, 180);
    const text = [
        "New contact form submission:",
        "",
        `Name: ${input.fromName}`,
        `Email: ${input.fromEmail}`,
        `Subject: ${input.subject}`,
        "",
        input.message,
        "",
        input.meta?.ip ? `IP: ${input.meta.ip}` : "",
        input.meta?.userAgent ? `User-Agent: ${input.meta.userAgent}` : ""
    ]
        .filter(Boolean)
        .join("\n");
    const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
      <h2 style="margin:0 0 12px 0;">New contact form submission</h2>
      <p style="margin:0 0 6px 0;"><b>Name:</b> ${escapeHtml(input.fromName)}</p>
      <p style="margin:0 0 6px 0;"><b>Email:</b> ${escapeHtml(input.fromEmail)}</p>
      <p style="margin:0 0 12px 0;"><b>Subject:</b> ${escapeHtml(input.subject)}</p>
      <div style="background:#111318;color:#ededed;padding:12px;border-radius:10px;white-space:pre-wrap;">${escapeHtml(input.message)}</div>
      ${input.meta?.ip || input.meta?.userAgent
        ? `<div style="margin-top:12px;color:#51607F;font-size:12px;">
              ${input.meta?.ip ? `<div>IP: ${escapeHtml(input.meta.ip)}</div>` : ""}
              ${input.meta?.userAgent ? `<div>User-Agent: ${escapeHtml(input.meta.userAgent)}</div>` : ""}
            </div>`
        : ""}
      <p style="color:#51607F;margin:12px 0 0 0;">GoEducate Talent</p>
    </div>
  `.trim();
    const info = await transporter.sendMail({
        from: env.INVITE_FROM_EMAIL,
        to: input.to,
        subject,
        text,
        html,
        replyTo: `${input.fromName} <${input.fromEmail}>`
    });
    return { messageId: info?.messageId, subject };
}
//# sourceMappingURL=contactForm.js.map