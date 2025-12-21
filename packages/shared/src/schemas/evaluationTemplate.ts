import { z } from "zod";

export const EvaluationTemplateSchema = z.object({
  _id: z.string().optional(),
  title: z.string().min(1).max(120),
  // "any" acts as a wildcard match for templates.
  sport: z.enum(["any", "football", "basketball", "volleyball", "soccer", "track", "other"]).default("any"),
  // Use "any" for a wildcard match across positions/events.
  position: z.string().min(1).max(60).default("any"),
  // Must satisfy the evaluator report minimums (so applying a template won't immediately fail validation).
  strengthsTemplate: z.string().min(50).max(4000),
  improvementsTemplate: z.string().min(50).max(4000),
  notesTemplate: z.string().max(4000).optional(),
  isActive: z.boolean().default(true),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});

export type EvaluationTemplate = z.infer<typeof EvaluationTemplateSchema>;

export const EvaluationTemplateCreateSchema = EvaluationTemplateSchema.omit({
  _id: true,
  createdAt: true,
  updatedAt: true
});

export type EvaluationTemplateCreateInput = z.infer<typeof EvaluationTemplateCreateSchema>;

export const EvaluationTemplateUpdateSchema = EvaluationTemplateCreateSchema.partial();

export type EvaluationTemplateUpdateInput = z.infer<typeof EvaluationTemplateUpdateSchema>;


