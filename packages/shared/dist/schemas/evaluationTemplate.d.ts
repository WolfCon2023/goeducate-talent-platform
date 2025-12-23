import { z } from "zod";
export declare const EvaluationTemplateSchema: z.ZodObject<{
    _id: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    sport: z.ZodDefault<z.ZodEnum<{
        any: "any";
        football: "football";
        basketball: "basketball";
        volleyball: "volleyball";
        soccer: "soccer";
        track: "track";
        other: "other";
    }>>;
    position: z.ZodDefault<z.ZodString>;
    strengthsTemplate: z.ZodString;
    improvementsTemplate: z.ZodString;
    notesTemplate: z.ZodOptional<z.ZodString>;
    isActive: z.ZodDefault<z.ZodBoolean>;
    createdAt: z.ZodOptional<z.ZodString>;
    updatedAt: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type EvaluationTemplate = z.infer<typeof EvaluationTemplateSchema>;
export declare const EvaluationTemplateCreateSchema: z.ZodObject<{
    title: z.ZodString;
    sport: z.ZodDefault<z.ZodEnum<{
        any: "any";
        football: "football";
        basketball: "basketball";
        volleyball: "volleyball";
        soccer: "soccer";
        track: "track";
        other: "other";
    }>>;
    isActive: z.ZodDefault<z.ZodBoolean>;
    position: z.ZodDefault<z.ZodString>;
    strengthsTemplate: z.ZodString;
    improvementsTemplate: z.ZodString;
    notesTemplate: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type EvaluationTemplateCreateInput = z.infer<typeof EvaluationTemplateCreateSchema>;
export declare const EvaluationTemplateUpdateSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    sport: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
        any: "any";
        football: "football";
        basketball: "basketball";
        volleyball: "volleyball";
        soccer: "soccer";
        track: "track";
        other: "other";
    }>>>;
    isActive: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    position: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    strengthsTemplate: z.ZodOptional<z.ZodString>;
    improvementsTemplate: z.ZodOptional<z.ZodString>;
    notesTemplate: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export type EvaluationTemplateUpdateInput = z.infer<typeof EvaluationTemplateUpdateSchema>;
//# sourceMappingURL=evaluationTemplate.d.ts.map