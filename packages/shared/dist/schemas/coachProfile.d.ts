import { z } from "zod";
export declare const CoachProfileSchema: z.ZodObject<{
    _id: z.ZodOptional<z.ZodString>;
    userId: z.ZodString;
    isProfilePublic: z.ZodOptional<z.ZodBoolean>;
    firstName: z.ZodOptional<z.ZodString>;
    lastName: z.ZodOptional<z.ZodString>;
    title: z.ZodOptional<z.ZodString>;
    institutionName: z.ZodOptional<z.ZodString>;
    programLevel: z.ZodOptional<z.ZodString>;
    institutionLocation: z.ZodOptional<z.ZodString>;
    positionsOfInterest: z.ZodOptional<z.ZodArray<z.ZodString>>;
    gradYears: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    regions: z.ZodOptional<z.ZodArray<z.ZodString>>;
    createdAt: z.ZodOptional<z.ZodString>;
    updatedAt: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type CoachProfile = z.infer<typeof CoachProfileSchema>;
export declare const CoachProfileCreateSchema: z.ZodObject<{
    isProfilePublic: z.ZodOptional<z.ZodBoolean>;
    firstName: z.ZodOptional<z.ZodString>;
    lastName: z.ZodOptional<z.ZodString>;
    title: z.ZodOptional<z.ZodString>;
    userId: z.ZodString;
    institutionName: z.ZodOptional<z.ZodString>;
    programLevel: z.ZodOptional<z.ZodString>;
    institutionLocation: z.ZodOptional<z.ZodString>;
    positionsOfInterest: z.ZodOptional<z.ZodArray<z.ZodString>>;
    gradYears: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    regions: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type CoachProfileCreateInput = z.infer<typeof CoachProfileCreateSchema>;
export declare const CoachProfileUpdateSchema: z.ZodObject<{
    isProfilePublic: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
    firstName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    lastName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    userId: z.ZodOptional<z.ZodString>;
    institutionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    programLevel: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    institutionLocation: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    positionsOfInterest: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString>>>;
    gradYears: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodNumber>>>;
    regions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString>>>;
}, z.core.$strip>;
export type CoachProfileUpdateInput = z.infer<typeof CoachProfileUpdateSchema>;
//# sourceMappingURL=coachProfile.d.ts.map