import { z } from "zod";

export const PlayerProfileSchema = z.object({
  _id: z.string().optional(),
  userId: z.string().min(1),
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60),
  position: z.string().min(1).max(30),
  gradYear: z.number().int().min(2020).max(2040),
  state: z.string().min(2).max(30),
  city: z.string().min(1).max(60),
  heightIn: z.number().int().min(48).max(90).optional(),
  weightLb: z.number().int().min(90).max(450).optional(),
  hudlLink: z.string().url().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});

export type PlayerProfile = z.infer<typeof PlayerProfileSchema>;

export const PlayerProfileCreateSchema = PlayerProfileSchema.omit({
  _id: true,
  createdAt: true,
  updatedAt: true
});

export type PlayerProfileCreateInput = z.infer<typeof PlayerProfileCreateSchema>;

export const PlayerProfileUpdateSchema = PlayerProfileCreateSchema.partial();

export type PlayerProfileUpdateInput = z.infer<typeof PlayerProfileUpdateSchema>;



