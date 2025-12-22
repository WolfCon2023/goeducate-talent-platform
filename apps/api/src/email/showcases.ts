import { createTransporterOrThrow, escapeHtml, isEmailConfigured } from "./mailer.js";

export function isShowcaseEmailConfigured() {
  return isEmailConfigured();
}

export async function sendShowcaseRegistrationEmail(input: {
  to: string;
  fullName: string;
  showcaseTitle: string;
  startDateTimeIso?: string | null;
  city?: string;
  state?: string;
  detailsUrl: string;
}) {
  const { env, transporter } = createTransporterOrThrow();

  const when = input.startDateTimeIso ? new Date(input.startDateTimeIso).toLocaleString() : "TBD";
  const where = [input.city, input.state].filter(Boolean).join(", ");

  const subject = `Showcase registration confirmed: ${input.showcaseTitle}`;
  const text = [
    `Hi ${input.fullName},`,
    "",
    `You are registered for: ${input.showcaseTitle}`,
    `When: ${when}`,
    where ? `Where: ${where}` : "",
    "",
    `Details: ${input.detailsUrl}`,
    "",
    "GoEducate Talent"
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height: 1.5;">
      <h2 style="margin:0 0 12px 0;">Registration confirmed</h2>
      <p style="margin:0 0 12px 0;">Hi ${escapeHtml(input.fullName)},</p>
      <p style="margin:0 0 12px 0;">
        You are registered for <strong>${escapeHtml(input.showcaseTitle)}</strong>.
      </p>
      <p style="margin:0 0 4px 0;"><strong>When:</strong> ${escapeHtml(when)}</p>
      ${where ? `<p style="margin:0 0 12px 0;"><strong>Where:</strong> ${escapeHtml(where)}</p>` : ""}
      <p style="margin:12px 0 12px 0;">
        <a href="${escapeHtml(input.detailsUrl)}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 14px;border-radius:10px;text-decoration:none;">
          View details
        </a>
      </p>
      <p style="color:#51607F;margin:12px 0 0 0;">GoEducate Talent</p>
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


