import { z } from "zod";

export const ShowcaseSportCategorySchema = z.enum([
  "basketball",
  "football",
  "volleyball",
  "baseball",
  "soccer",
  "other"
]);

export const ShowcaseStatusSchema = z.enum(["draft", "published", "archived"]);

export const ShowcaseBaseSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be URL-friendly (lowercase letters, numbers, dashes)."),
  title: z.string().min(2).max(140),
  description: z.string().min(0).max(20_000).default(""),
  refundPolicy: z
    .string()
    .min(0)
    .max(20_000)
    .default(
      [
        "Refund Policy (Attorney-Ready Version)",
        "",
        "Effective Date: [Insert Date]",
        "",
        "This Refund Policy governs all showcase registrations processed by GoEducate, Inc. (“GoEducate,” “we,” “us,” or “our”).",
        "",
        "1. General Policy",
        "All showcase registration fees are non-refundable unless expressly stated otherwise in writing by GoEducate, Inc.",
        "By completing registration and submitting payment, the registrant acknowledges and agrees that registration fees are earned upon receipt and are subject to the terms of this Refund Policy.",
        "",
        "2. Refund Requests",
        "Refund requests must be submitted in writing to GoEducate, Inc. no later than seven (7) calendar days prior to the scheduled start date of the showcase. Any approved refund may be subject to administrative and third-party payment processing fees.",
        "Refund approval is not guaranteed and is granted solely at the discretion of GoEducate, Inc.",
        "",
        "3. Non-Refundable Circumstances",
        "Refunds will not be issued for, including but not limited to:",
        "- Failure to attend the showcase for any reason",
        "- Late arrival, early departure, or partial participation",
        "- Personal scheduling conflicts or travel issues",
        "- Disqualification, ineligibility, or failure to meet participation requirements",
        "- Voluntary withdrawal from the event",
        "",
        "4. Medical Exception Requests",
        "Requests for refunds based on medical emergencies or injuries must be supported by verifiable documentation and will be reviewed on a case-by-case basis. Submission of documentation does not guarantee approval. All determinations are made at the sole discretion of GoEducate, Inc.",
        "",
        "5. Event Cancellation or Modification",
        "If a showcase is canceled, postponed, or materially modified by GoEducate, Inc., registrants will be offered, at GoEducate’s discretion:",
        "- A full refund, or",
        "- A credit applicable to a future GoEducate showcase",
        "Credits are non-transferable and must be used within the timeframe specified at issuance.",
        "",
        "6. Transfers and Credits",
        "Registration fees are non-transferable to another individual. Credits toward future events may be granted at GoEducate’s discretion and do not carry cash value.",
        "",
        "7. Chargebacks and Payment Disputes (Stripe-Aligned)",
        "By registering, you agree to contact GoEducate, Inc. prior to initiating any payment dispute or chargeback.",
        "Initiating a chargeback without first contacting GoEducate may result in:",
        "- Immediate suspension or termination of your GoEducate account",
        "- Loss of access to GoEducate services",
        "GoEducate, Inc. reserves the right to submit evidence to payment processors, including but not limited to:",
        "- Proof of registration and payment confirmation",
        "- Acceptance of the waiver and refund policy",
        "- Event details, schedules, and communications",
        "- Attendance records or event availability",
        "Chargebacks determined in GoEducate’s favor may result in permanent account restrictions.",
        "",
        "8. Policy Updates",
        "GoEducate, Inc. reserves the right to amend this Refund Policy at any time. Any updates will apply prospectively and will not affect registrations completed prior to the effective date of the revision.",
        "",
        "By registering for a showcase, you acknowledge that you have read, understand, and agree to this Refund Policy."
      ].join("\n")
    ),
  weatherClause: z
    .string()
    .min(0)
    .max(10_000)
    .default(
      [
        "Weather-Related Event Clause (Standalone)",
        "",
        "Showcase events are scheduled to take place rain or shine.",
        "",
        "Weather conditions, including but not limited to rain, heat, cold, or other natural conditions, do not constitute grounds for a refund unless the event is fully canceled by GoEducate, Inc.",
        "",
        "If weather conditions require cancellation, postponement, or modification of an event, GoEducate, Inc. will determine the appropriate remedy, which may include a refund or credit toward a future event, as outlined in the Refund Policy."
      ].join("\n")
    ),
  sportCategories: z.array(ShowcaseSportCategorySchema).min(1).max(10),
  startDateTime: z.string().datetime(),
  endDateTime: z.string().datetime(),
  timezone: z.string().min(3).max(80).default("America/New_York"),
  locationName: z.string().min(2).max(200),
  addressLine1: z.string().min(2).max(200),
  addressLine2: z.string().min(0).max(200).optional(),
  city: z.string().min(2).max(120),
  state: z.string().min(2).max(80),
  zip: z.string().min(2).max(20).optional(),
  costCents: z.number().int().min(0).max(10_000_00),
  currency: z.string().min(3).max(8).default("usd"),
  capacity: z.number().int().min(1).max(100_000).optional(),
  spotsRemaining: z.number().int().min(0).max(100_000).optional(),
  registrationOpen: z.boolean().default(false),
  registrationOpenAt: z.string().datetime().optional(),
  registrationCloseAt: z.string().datetime().optional(),
  status: ShowcaseStatusSchema.default("draft"),
  imageUrl: z.string().url().optional(),
  stripePriceId: z.string().min(3).max(200).optional()
});

export const ShowcaseCreateSchema = ShowcaseBaseSchema.superRefine((val, ctx) => {
  const start = new Date(val.startDateTime).getTime();
  const end = new Date(val.endDateTime).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "End date/time must be after start date/time.", path: ["endDateTime"] });
  }

  if (val.capacity !== undefined && val.spotsRemaining !== undefined && val.spotsRemaining > val.capacity) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Spots remaining cannot exceed capacity.", path: ["spotsRemaining"] });
  }

  if (val.status === "published") {
    const requiredWhenPublished: Array<keyof typeof val> = ["locationName", "addressLine1", "city", "state"];
    for (const k of requiredWhenPublished) {
      if (!String((val as any)[k] ?? "").trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Required when published.", path: [k as any] });
      }
    }
  }
});

export type ShowcaseCreateInput = z.infer<typeof ShowcaseCreateSchema>;

export const ShowcaseUpdateSchema = ShowcaseCreateSchema.partial().superRefine((val, ctx) => {
  if (val.startDateTime && val.endDateTime) {
    const start = new Date(val.startDateTime).getTime();
    const end = new Date(val.endDateTime).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "End date/time must be after start date/time.", path: ["endDateTime"] });
    }
  }
});

export type ShowcaseUpdateInput = z.infer<typeof ShowcaseUpdateSchema>;


