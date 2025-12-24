import { z } from "zod";

export const PlayerProfileSchema = z.object({
  _id: z.string().optional(),
  userId: z.string().min(1),
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60),
  // Visibility controls
  // Default behavior is enforced in the API/model layer to avoid accidental overwrites on partial updates.
  isProfilePublic: z.boolean().optional(),
  // Player-only: whether contact info may be shown to subscribed coaches.
  isContactVisibleToSubscribedCoaches: z.boolean().optional(),
  sport: z.enum(["football", "basketball", "volleyball", "soccer", "track", "other"]).optional(),
  position: z.string().min(1).max(60),
  gradYear: z.number().int().min(2020).max(2040),
  school: z.string().min(1).max(120).optional(),
  state: z.string().min(2).max(30),
  city: z.string().min(1).max(60),
  // Legacy naming (used in existing app)
  heightIn: z.number().int().min(48).max(90).optional(),
  weightLb: z.number().int().min(90).max(450).optional(),
  // Newer naming for shared scoring (optional aliases)
  heightInInches: z.number().int().min(48).max(90).optional(),
  weightLbs: z.number().int().min(90).max(450).optional(),
  // Metrics / academics / media (used for completion scoring)
  fortyTime: z.number().min(3.5).max(8).optional(),
  verticalInches: z.number().int().min(10).max(60).optional(),
  gpa: z.number().min(0).max(5).optional(),
  highlightPhotoUrl: z.string().url().optional(),
  jerseyNumber: z.number().int().min(0).max(99).optional(),
  // Coach-gated contact info (subscription later)
  contactEmail: z.string().email().max(254).optional(),
  contactPhone: z.string().min(7).max(30).optional(),
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



