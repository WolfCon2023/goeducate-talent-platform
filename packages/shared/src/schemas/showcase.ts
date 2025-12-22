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


