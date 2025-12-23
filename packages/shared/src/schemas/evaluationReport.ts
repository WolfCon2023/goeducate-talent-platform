import { z } from "zod";
import { EvaluationRubricResponseSchema } from "./evaluationForm.js";

export const EvaluationReportSchema = z.object({
  _id: z.string().optional(),
  filmSubmissionId: z.string().min(1),
  playerUserId: z.string().min(1),
  evaluatorUserId: z.string().min(1),
  sport: z.enum(["football", "basketball", "volleyball", "soccer", "track", "other"]).optional(),
  position: z.string().min(1).max(60).optional(),
  positionOther: z.string().min(1).max(60).optional(),
  overallGrade: z.number().int().min(1).max(10),
  rubric: EvaluationRubricResponseSchema.optional(),
  overallGradeRaw: z.number().min(1).max(10).optional(),
  suggestedProjection: z.enum(["developmental", "solid", "high_upside", "elite_upside"]).optional(),
  suggestedProjectionLabel: z.string().max(60).optional(),
  strengths: z.string().min(1).max(2000),
  improvements: z.string().min(1).max(2000),
  notes: z.string().max(4000).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});

export type EvaluationReport = z.infer<typeof EvaluationReportSchema>;

export const EvaluationReportCreateSchema = z.object({
  filmSubmissionId: z.string().min(1),
  sport: z.enum(["football", "basketball", "volleyball", "soccer", "track", "other"]).optional(),
  position: z.string().min(1).max(60).optional(),
  positionOther: z.string().min(1).max(60).optional(),
  // If rubric is provided, the API may compute overallGrade automatically.
  overallGrade: z.number().int().min(1).max(10).optional(),
  rubric: EvaluationRubricResponseSchema.optional(),
  // Stronger minimums to encourage consistent, evidence-based narratives.
  strengths: z.string().min(50).max(2000),
  improvements: z.string().min(50).max(2000),
  notes: z.string().max(4000).optional()
});

export type EvaluationReportCreateInput = z.infer<typeof EvaluationReportCreateSchema>;


