import { z } from "zod";

export const CoachProfileSchema = z.object({
  _id: z.string().optional(),
  userId: z.string().min(1),
  isProfilePublic: z.boolean().optional(),
  firstName: z.string().min(1).max(60).optional(),
  lastName: z.string().min(1).max(60).optional(),
  title: z.string().min(1).max(120).optional(),
  institutionName: z.string().min(1).max(160).optional(),
  programLevel: z.string().min(1).max(80).optional(),
  institutionLocation: z.string().min(1).max(160).optional(),
  positionsOfInterest: z.array(z.string().min(1).max(60)).max(50).optional(),
  gradYears: z.array(z.number().int().min(2020).max(2040)).max(30).optional(),
  regions: z.array(z.string().min(1).max(80)).max(50).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});

export type CoachProfile = z.infer<typeof CoachProfileSchema>;

export const CoachProfileCreateSchema = CoachProfileSchema.omit({ _id: true, createdAt: true, updatedAt: true });
export type CoachProfileCreateInput = z.infer<typeof CoachProfileCreateSchema>;

export const CoachProfileUpdateSchema = CoachProfileCreateSchema.partial();
export type CoachProfileUpdateInput = z.infer<typeof CoachProfileUpdateSchema>;


