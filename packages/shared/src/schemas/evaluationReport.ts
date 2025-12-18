import { z } from "zod";

export const EvaluationReportSchema = z.object({
  _id: z.string().optional(),
  filmSubmissionId: z.string().min(1),
  playerUserId: z.string().min(1),
  evaluatorUserId: z.string().min(1),
  overallGrade: z.number().int().min(1).max(10),
  strengths: z.string().min(1).max(2000),
  improvements: z.string().min(1).max(2000),
  notes: z.string().max(4000).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});

export type EvaluationReport = z.infer<typeof EvaluationReportSchema>;

export const EvaluationReportCreateSchema = z.object({
  filmSubmissionId: z.string().min(1),
  playerUserId: z.string().min(1),
  overallGrade: z.number().int().min(1).max(10),
  strengths: z.string().min(1).max(2000),
  improvements: z.string().min(1).max(2000),
  notes: z.string().max(4000).optional()
});

export type EvaluationReportCreateInput = z.infer<typeof EvaluationReportCreateSchema>;


