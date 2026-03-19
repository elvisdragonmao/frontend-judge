import { z } from "zod";
import {
  DEFAULT_BLOCKED_PATHS,
  DEFAULT_REACT_ALLOWED_PATHS,
  DEFAULT_REACT_BLOCKED_PATHS,
} from "../submission-paths.js";

export const AssignmentSpec = z.object({
  /** How to start the project for judging (e.g. 'static', 'npm-start') */
  startCommand: z.string().default("static"),
  /** Playwright test file content or reference */
  testContent: z.string().optional(),
  /** Timeout in ms for the entire judge run */
  timeoutMs: z.number().default(60_000),
  /** Files allowed to be overwritten by student submission */
  allowedPaths: z.array(z.string()).default(["**/*"]),
  /** Files student cannot override (security) */
  blockedPaths: z.array(z.string()).default([...DEFAULT_BLOCKED_PATHS]),
});
export type AssignmentSpec = z.infer<typeof AssignmentSpec>;

export const DEFAULT_REACT_ASSIGNMENT_SPEC = {
  startCommand: "npm-start",
  timeoutMs: 60_000,
  allowedPaths: [...DEFAULT_REACT_ALLOWED_PATHS],
  blockedPaths: [...DEFAULT_REACT_BLOCKED_PATHS],
} as const;

export const SubmissionRecordAction = z.enum(["keep", "delete"]);
export type SubmissionRecordAction = z.infer<typeof SubmissionRecordAction>;

export const CreateAssignmentRequest = z.object({
  classId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().default(""),
  type: z.enum(["html-css-js", "react"]),
  dueDate: z.string().datetime().optional(),
  allowMultipleSubmissions: z.boolean().default(true),
  spec: AssignmentSpec,
});
export type CreateAssignmentRequest = z.infer<typeof CreateAssignmentRequest>;

export const UpdateAssignmentRequest = CreateAssignmentRequest.partial()
  .omit({
    classId: true,
  })
  .extend({
    submissionRecordAction: SubmissionRecordAction.optional(),
  });
export type UpdateAssignmentRequest = z.infer<typeof UpdateAssignmentRequest>;

export const AssignmentSummary = z.object({
  id: z.string().uuid(),
  classId: z.string().uuid(),
  title: z.string(),
  type: z.enum(["html-css-js", "react"]),
  dueDate: z.string().datetime().nullable(),
  allowMultipleSubmissions: z.boolean(),
  submissionCount: z.number(),
  createdAt: z.string().datetime(),
});
export type AssignmentSummary = z.infer<typeof AssignmentSummary>;

export const AssignmentDetail = AssignmentSummary.extend({
  description: z.string(),
  spec: AssignmentSpec,
  className: z.string(),
});
export type AssignmentDetail = z.infer<typeof AssignmentDetail>;
