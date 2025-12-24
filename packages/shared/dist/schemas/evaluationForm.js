import { z } from "zod";
export const RubricControlTypeSchema = z.enum(["slider", "select"]);
export const RubricSelectOptionSchema = z.object({
    value: z.string().min(1).max(60),
    label: z.string().min(1).max(80),
    // Optional numeric mapping for scoring (1-10 scale).
    score: z.number().min(1).max(10).optional()
});
export const RubricTraitDefinitionSchema = z.object({
    key: z.string().min(1).max(60),
    label: z.string().min(1).max(120),
    description: z.string().max(300).optional(),
    type: RubricControlTypeSchema,
    required: z.boolean().default(true),
    // slider config (1–10)
    min: z.number().int().min(1).max(10).default(1).optional(),
    max: z.number().int().min(1).max(10).default(10).optional(),
    step: z.number().int().min(1).max(5).default(1).optional(),
    // select config
    options: z.array(RubricSelectOptionSchema).optional()
});
export const RubricCategoryDefinitionSchema = z.object({
    key: z.enum(["physical", "athletic", "technical", "mental", "intangibles"]),
    label: z.string().min(1).max(80),
    // Weight percentage (should sum to 100 across categories)
    weight: z.number().min(0).max(100).default(20),
    traits: z.array(RubricTraitDefinitionSchema).min(1)
});
export const EvaluationFormDefinitionSchema = z.object({
    _id: z.string().optional(),
    title: z.string().min(1).max(120),
    sport: z.enum(["football", "basketball", "volleyball", "soccer", "track", "other"]),
    isActive: z.boolean().default(true),
    version: z.number().int().min(1).default(1),
    strengthsPrompt: z.string().min(1).max(800).default("Provide 2–4 strengths with specific evidence (what you saw and where). Use bullet points."),
    improvementsPrompt: z.string().min(1).max(800).default("Provide 2–4 improvements with actionable coaching points. Use bullet points."),
    notesHelp: z.string().max(800).optional(),
    categories: z.array(RubricCategoryDefinitionSchema).length(5)
});
export const EvaluationFormCreateSchema = EvaluationFormDefinitionSchema.omit({
    _id: true
});
export const EvaluationFormUpdateSchema = EvaluationFormCreateSchema.partial();
// --- Responses (what evaluators submit) ---
export const RubricTraitResponseSchema = z.object({
    key: z.string().min(1).max(60),
    // Slider value 1-10
    valueNumber: z.number().min(1).max(10).optional(),
    // Select option value
    valueOption: z.string().min(1).max(60).optional()
});
export const RubricCategoryResponseSchema = z.object({
    key: z.enum(["physical", "athletic", "technical", "mental", "intangibles"]),
    traits: z.array(RubricTraitResponseSchema).min(1)
});
export const EvaluationRubricResponseSchema = z.object({
    formId: z.string().optional(),
    categories: z.array(RubricCategoryResponseSchema).length(5)
});
//# sourceMappingURL=evaluationForm.js.map