import { z } from "zod";
export declare const EvaluationReportSchema: z.ZodObject<{
    _id: z.ZodOptional<z.ZodString>;
    filmSubmissionId: z.ZodString;
    playerUserId: z.ZodString;
    evaluatorUserId: z.ZodString;
    sport: z.ZodOptional<z.ZodEnum<{
        football: "football";
        basketball: "basketball";
        volleyball: "volleyball";
        soccer: "soccer";
        track: "track";
        other: "other";
    }>>;
    position: z.ZodOptional<z.ZodString>;
    positionOther: z.ZodOptional<z.ZodString>;
    overallGrade: z.ZodNumber;
    rubric: z.ZodOptional<z.ZodObject<{
        formId: z.ZodOptional<z.ZodString>;
        categories: z.ZodArray<z.ZodObject<{
            key: z.ZodEnum<{
                physical: "physical";
                athletic: "athletic";
                technical: "technical";
                mental: "mental";
                intangibles: "intangibles";
            }>;
            traits: z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                valueNumber: z.ZodOptional<z.ZodNumber>;
                valueOption: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    overallGradeRaw: z.ZodOptional<z.ZodNumber>;
    suggestedProjection: z.ZodOptional<z.ZodEnum<{
        developmental: "developmental";
        solid: "solid";
        high_upside: "high_upside";
        elite_upside: "elite_upside";
    }>>;
    suggestedProjectionLabel: z.ZodOptional<z.ZodString>;
    strengths: z.ZodString;
    improvements: z.ZodString;
    notes: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodOptional<z.ZodString>;
    updatedAt: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type EvaluationReport = z.infer<typeof EvaluationReportSchema>;
export declare const EvaluationReportCreateSchema: z.ZodObject<{
    filmSubmissionId: z.ZodString;
    sport: z.ZodOptional<z.ZodEnum<{
        football: "football";
        basketball: "basketball";
        volleyball: "volleyball";
        soccer: "soccer";
        track: "track";
        other: "other";
    }>>;
    position: z.ZodOptional<z.ZodString>;
    positionOther: z.ZodOptional<z.ZodString>;
    overallGrade: z.ZodOptional<z.ZodNumber>;
    rubric: z.ZodOptional<z.ZodObject<{
        formId: z.ZodOptional<z.ZodString>;
        categories: z.ZodArray<z.ZodObject<{
            key: z.ZodEnum<{
                physical: "physical";
                athletic: "athletic";
                technical: "technical";
                mental: "mental";
                intangibles: "intangibles";
            }>;
            traits: z.ZodArray<z.ZodObject<{
                key: z.ZodString;
                valueNumber: z.ZodOptional<z.ZodNumber>;
                valueOption: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    strengths: z.ZodString;
    improvements: z.ZodString;
    notes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type EvaluationReportCreateInput = z.infer<typeof EvaluationReportCreateSchema>;
//# sourceMappingURL=evaluationReport.d.ts.map