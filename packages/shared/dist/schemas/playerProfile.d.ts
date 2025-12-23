import { z } from "zod";
export declare const PlayerProfileSchema: z.ZodObject<{
    _id: z.ZodOptional<z.ZodString>;
    userId: z.ZodString;
    firstName: z.ZodString;
    lastName: z.ZodString;
    sport: z.ZodOptional<z.ZodEnum<{
        football: "football";
        basketball: "basketball";
        volleyball: "volleyball";
        soccer: "soccer";
        track: "track";
        other: "other";
    }>>;
    position: z.ZodString;
    gradYear: z.ZodNumber;
    state: z.ZodString;
    city: z.ZodString;
    heightIn: z.ZodOptional<z.ZodNumber>;
    weightLb: z.ZodOptional<z.ZodNumber>;
    contactEmail: z.ZodOptional<z.ZodString>;
    contactPhone: z.ZodOptional<z.ZodString>;
    hudlLink: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodOptional<z.ZodString>;
    updatedAt: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type PlayerProfile = z.infer<typeof PlayerProfileSchema>;
export declare const PlayerProfileCreateSchema: z.ZodObject<{
    firstName: z.ZodString;
    lastName: z.ZodString;
    sport: z.ZodOptional<z.ZodEnum<{
        football: "football";
        basketball: "basketball";
        volleyball: "volleyball";
        soccer: "soccer";
        track: "track";
        other: "other";
    }>>;
    position: z.ZodString;
    userId: z.ZodString;
    gradYear: z.ZodNumber;
    state: z.ZodString;
    city: z.ZodString;
    heightIn: z.ZodOptional<z.ZodNumber>;
    weightLb: z.ZodOptional<z.ZodNumber>;
    contactEmail: z.ZodOptional<z.ZodString>;
    contactPhone: z.ZodOptional<z.ZodString>;
    hudlLink: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type PlayerProfileCreateInput = z.infer<typeof PlayerProfileCreateSchema>;
export declare const PlayerProfileUpdateSchema: z.ZodObject<{
    firstName: z.ZodOptional<z.ZodString>;
    lastName: z.ZodOptional<z.ZodString>;
    sport: z.ZodOptional<z.ZodOptional<z.ZodEnum<{
        football: "football";
        basketball: "basketball";
        volleyball: "volleyball";
        soccer: "soccer";
        track: "track";
        other: "other";
    }>>>;
    position: z.ZodOptional<z.ZodString>;
    userId: z.ZodOptional<z.ZodString>;
    gradYear: z.ZodOptional<z.ZodNumber>;
    state: z.ZodOptional<z.ZodString>;
    city: z.ZodOptional<z.ZodString>;
    heightIn: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    weightLb: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    contactEmail: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    contactPhone: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    hudlLink: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export type PlayerProfileUpdateInput = z.infer<typeof PlayerProfileUpdateSchema>;
//# sourceMappingURL=playerProfile.d.ts.map