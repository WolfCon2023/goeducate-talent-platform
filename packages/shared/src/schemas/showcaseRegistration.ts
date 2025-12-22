import { z } from "zod";

import { ALL_ROLES } from "../roles.js";
import { ShowcaseSportCategorySchema } from "./showcase.js";

export const ShowcaseRegistrationStatusSchema = z.enum(["pending", "paid", "failed", "refunded"]);

export const ShowcaseRegistrationCreateSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email().max(254),
  role: z.enum(ALL_ROLES).optional(),
  sport: ShowcaseSportCategorySchema.optional()
});

export type ShowcaseRegistrationCreateInput = z.infer<typeof ShowcaseRegistrationCreateSchema>;


