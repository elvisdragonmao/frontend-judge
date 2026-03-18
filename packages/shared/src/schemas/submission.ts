import { z } from "zod";

export const SubmissionFile = z.object({
  id: z.string().uuid(),
  path: z.string(),
  size: z.number(),
  minioKey: z.string(),
});
export type SubmissionFile = z.infer<typeof SubmissionFile>;

export const SubmissionArtifact = z.object({
  id: z.string().uuid(),
  type: z.enum(["screenshot", "log", "report"]),
  name: z.string(),
  minioKey: z.string(),
  url: z.string().optional(),
});
export type SubmissionArtifact = z.infer<typeof SubmissionArtifact>;

export const TestCaseResult = z.object({
  name: z.string(),
  passed: z.boolean(),
  message: z.string().optional(),
  score: z.number().default(0),
});
export type TestCaseResult = z.infer<typeof TestCaseResult>;

export const SubmissionRun = z.object({
  id: z.string().uuid(),
  submissionId: z.string().uuid(),
  status: z.enum([
    "pending",
    "queued",
    "running",
    "completed",
    "failed",
    "error",
  ]),
  score: z.number().nullable(),
  maxScore: z.number().nullable(),
  testResults: z.array(TestCaseResult).nullable(),
  log: z.string().nullable(),
  artifacts: z.array(SubmissionArtifact),
  startedAt: z.string().datetime().nullable(),
  finishedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type SubmissionRun = z.infer<typeof SubmissionRun>;

export const SubmissionSummary = z.object({
  id: z.string().uuid(),
  assignmentId: z.string().uuid(),
  userId: z.string().uuid(),
  username: z.string(),
  displayName: z.string(),
  status: z.enum([
    "pending",
    "queued",
    "running",
    "completed",
    "failed",
    "error",
  ]),
  score: z.number().nullable(),
  maxScore: z.number().nullable(),
  screenshotUrl: z.string().nullable(),
  fileCount: z.number(),
  createdAt: z.string().datetime(),
});
export type SubmissionSummary = z.infer<typeof SubmissionSummary>;

export const SubmissionDetail = SubmissionSummary.extend({
  files: z.array(SubmissionFile),
  runs: z.array(SubmissionRun),
});
export type SubmissionDetail = z.infer<typeof SubmissionDetail>;

export const SubmissionListResponse = z.object({
  submissions: z.array(SubmissionSummary),
  total: z.number(),
});
export type SubmissionListResponse = z.infer<typeof SubmissionListResponse>;
