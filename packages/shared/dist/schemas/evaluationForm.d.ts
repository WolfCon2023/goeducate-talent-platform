import { z } from "zod";
export declare const RubricControlTypeSchema: z.ZodEnum<{
    slider: "slider";
    select: "select";
}>;
export type RubricControlType = z.infer<typeof RubricControlTypeSchema>;
export declare const RubricSelectOptionSchema: z.ZodObject<{
    value: z.ZodString;
    label: z.ZodString;
    score: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const RubricTraitDefinitionSchema: z.ZodObject<{
    key: z.ZodString;
    label: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    type: z.ZodEnum<{
        slider: "slider";
        select: "select";
    }>;
    required: z.ZodDefault<z.ZodBoolean>;
    min: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    max: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    step: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    options: z.ZodOptional<z.ZodArray<z.ZodObject<{
        value: z.ZodString;
        label: z.ZodString;
        score: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type RubricTraitDefinition = z.infer<typeof RubricTraitDefinitionSchema>;
export declare const RubricCategoryDefinitionSchema: z.ZodObject<{
    key: z.ZodEnum<{
        physical: "physical";
        athletic: "athletic";
        technical: "technical";
        mental: "mental";
        intangibles: "intangibles";
    }>;
    label: z.ZodString;
    weight: z.ZodDefault<z.ZodNumber>;
    traits: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        type: z.ZodEnum<{
            slider: "slider";
            select: "select";
        }>;
        required: z.ZodDefault<z.ZodBoolean>;
        min: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
        max: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
        step: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
        options: z.ZodOptional<z.ZodArray<z.ZodObject<{
            value: z.ZodString;
            label: z.ZodString;
            score: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type RubricCategoryDefinition = z.infer<typeof RubricCategoryDefinitionSchema>;
export declare const EvaluationFormDefinitionSchema: z.ZodObject<{
    _id: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    sport: z.ZodEnum<{
        football: "football";
        basketball: "basketball";
        volleyball: "volleyball";
        soccer: "soccer";
        track: "track";
        other: "other";
    }>;
    isActive: z.ZodDefault<z.ZodBoolean>;
    version: z.ZodDefault<z.ZodNumber>;
    strengthsPrompt: z.ZodDefault<z.ZodString>;
    improvementsPrompt: z.ZodDefault<z.ZodString>;
    notesHelp: z.ZodOptional<z.ZodString>;
    categories: z.ZodArray<z.ZodObject<{
        key: z.ZodEnum<{
            physical: "physical";
            athletic: "athletic";
            technical: "technical";
            mental: "mental";
            intangibles: "intangibles";
        }>;
        label: z.ZodString;
        weight: z.ZodDefault<z.ZodNumber>;
        traits: z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            label: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            type: z.ZodEnum<{
                slider: "slider";
                select: "select";
            }>;
            required: z.ZodDefault<z.ZodBoolean>;
            min: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
            max: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
            step: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
            options: z.ZodOptional<z.ZodArray<z.ZodObject<{
                value: z.ZodString;
                label: z.ZodString;
                score: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type EvaluationFormDefinition = z.infer<typeof EvaluationFormDefinitionSchema>;
export declare const EvaluationFormCreateSchema: z.ZodObject<{
    title: z.ZodString;
    sport: z.ZodEnum<{
        football: "football";
        basketball: "basketball";
        volleyball: "volleyball";
        soccer: "soccer";
        track: "track";
        other: "other";
    }>;
    isActive: z.ZodDefault<z.ZodBoolean>;
    version: z.ZodDefault<z.ZodNumber>;
    strengthsPrompt: z.ZodDefault<z.ZodString>;
    improvementsPrompt: z.ZodDefault<z.ZodString>;
    notesHelp: z.ZodOptional<z.ZodString>;
    categories: z.ZodArray<z.ZodObject<{
        key: z.ZodEnum<{
            physical: "physical";
            athletic: "athletic";
            technical: "technical";
            mental: "mental";
            intangibles: "intangibles";
        }>;
        label: z.ZodString;
        weight: z.ZodDefault<z.ZodNumber>;
        traits: z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            label: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            type: z.ZodEnum<{
                slider: "slider";
                select: "select";
            }>;
            required: z.ZodDefault<z.ZodBoolean>;
            min: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
            max: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
            step: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
            options: z.ZodOptional<z.ZodArray<z.ZodObject<{
                value: z.ZodString;
                label: z.ZodString;
                score: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type EvaluationFormCreateInput = z.infer<typeof EvaluationFormCreateSchema>;
export declare const EvaluationFormUpdateSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    sport: z.ZodOptional<z.ZodEnum<{
        football: "football";
        basketball: "basketball";
        volleyball: "volleyball";
        soccer: "soccer";
        track: "track";
        other: "other";
    }>>;
    isActive: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    version: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    strengthsPrompt: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    improvementsPrompt: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    notesHelp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    categories: z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodEnum<{
            physical: "physical";
            athletic: "athletic";
            technical: "technical";
            mental: "mental";
            intangibles: "intangibles";
        }>;
        label: z.ZodString;
        weight: z.ZodDefault<z.ZodNumber>;
        traits: z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            label: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            type: z.ZodEnum<{
                slider: "slider";
                select: "select";
            }>;
            required: z.ZodDefault<z.ZodBoolean>;
            min: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
            max: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
            step: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
            options: z.ZodOptional<z.ZodArray<z.ZodObject<{
                value: z.ZodString;
                label: z.ZodString;
                score: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type EvaluationFormUpdateInput = z.infer<typeof EvaluationFormUpdateSchema>;
export declare const RubricTraitResponseSchema: z.ZodObject<{
    key: z.ZodString;
    valueNumber: z.ZodOptional<z.ZodNumber>;
    valueOption: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const RubricCategoryResponseSchema: z.ZodObject<{
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
}, z.core.$strip>;
export declare const EvaluationRubricResponseSchema: z.ZodObject<{
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
}, z.core.$strip>;
export type EvaluationRubricResponse = z.infer<typeof EvaluationRubricResponseSchema>;
//# sourceMappingURL=evaluationForm.d.ts.map