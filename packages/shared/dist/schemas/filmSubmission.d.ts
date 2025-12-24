import { z } from "zod";
export declare const FILM_SUBMISSION_STATUS: {
    readonly SUBMITTED: "submitted";
    readonly IN_REVIEW: "in_review";
    readonly NEEDS_CHANGES: "needs_changes";
    readonly COMPLETED: "completed";
};
export type FilmSubmissionStatus = (typeof FILM_SUBMISSION_STATUS)[keyof typeof FILM_SUBMISSION_STATUS];
export declare const FilmSubmissionSchema: z.ZodObject<{
    _id: z.ZodOptional<z.ZodString>;
    userId: z.ZodString;
    title: z.ZodString;
    opponent: z.ZodOptional<z.ZodString>;
    gameDate: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
    videoUrl: z.ZodOptional<z.ZodString>;
    cloudinaryPublicId: z.ZodOptional<z.ZodString>;
    status: z.ZodEnum<{
        submitted: "submitted";
        in_review: "in_review";
        needs_changes: "needs_changes";
        completed: "completed";
    }>;
    createdAt: z.ZodOptional<z.ZodString>;
    updatedAt: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type FilmSubmission = z.infer<typeof FilmSubmissionSchema>;
export declare const FilmSubmissionCreateSchema: z.ZodObject<{
    title: z.ZodString;
    opponent: z.ZodOptional<z.ZodString>;
    gameDate: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
    videoUrl: z.ZodOptional<z.ZodString>;
    cloudinaryPublicId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type FilmSubmissionCreateInput = z.infer<typeof FilmSubmissionCreateSchema>;
//# sourceMappingURL=filmSubmission.d.ts.map