import { z } from "zod";
export const EvaluatorProfileSchema = z.object({
    _id: z.string().optional(),
    userId: z.string().min(1),
    isProfilePublic: z.boolean().optional(),
    firstName: z.string().min(1).max(60).optional(),
    lastName: z.string().min(1).max(60).optional(),
    title: z.string().min(1).max(120).optional(),
    bio: z.string().min(1).max(2000).optional(),
    experienceYears: z.number().int().min(0).max(80).optional(),
    credentials: z.array(z.string().min(1).max(200)).max(50).optional(),
    specialties: z.array(z.string().min(1).max(120)).max(50).optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional()
});
export const EvaluatorProfileCreateSchema = EvaluatorProfileSchema.omit({ _id: true, createdAt: true, updatedAt: true });
export const EvaluatorProfileUpdateSchema = EvaluatorProfileCreateSchema.partial();
//# sourceMappingURL=evaluatorProfile.js.map