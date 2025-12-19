import { z } from "zod";

export const FILM_SUBMISSION_STATUS = {
  SUBMITTED: "submitted",
  IN_REVIEW: "in_review",
  COMPLETED: "completed"
} as const;

export type FilmSubmissionStatus = (typeof FILM_SUBMISSION_STATUS)[keyof typeof FILM_SUBMISSION_STATUS];

export const FilmSubmissionSchema = z.object({
  _id: z.string().optional(),
  userId: z.string().min(1),
  title: z.string().min(1).max(120),
  opponent: z.string().min(1).max(120).optional(),
  gameDate: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
  videoUrl: z.string().url().optional(),
  // Optional: when uploaded via Cloudinary, store the public_id so we can delete the asset later.
  cloudinaryPublicId: z.string().min(1).max(500).optional(),
  status: z.enum([
    FILM_SUBMISSION_STATUS.SUBMITTED,
    FILM_SUBMISSION_STATUS.IN_REVIEW,
    FILM_SUBMISSION_STATUS.COMPLETED
  ]),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});

export type FilmSubmission = z.infer<typeof FilmSubmissionSchema>;

export const FilmSubmissionCreateSchema = z.object({
  title: FilmSubmissionSchema.shape.title,
  opponent: FilmSubmissionSchema.shape.opponent,
  gameDate: FilmSubmissionSchema.shape.gameDate,
  notes: FilmSubmissionSchema.shape.notes,
  videoUrl: FilmSubmissionSchema.shape.videoUrl,
  cloudinaryPublicId: FilmSubmissionSchema.shape.cloudinaryPublicId
});

export type FilmSubmissionCreateInput = z.infer<typeof FilmSubmissionCreateSchema>;



