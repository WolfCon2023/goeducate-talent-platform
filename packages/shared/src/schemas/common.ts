import { z } from "zod";

export const VisibilitySchema = z.object({
  // If false, public profile endpoints should return 404 unless requester is authorized.
  isProfilePublic: z.boolean().optional(),
});


