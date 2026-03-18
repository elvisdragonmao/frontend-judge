// ─── Roles ───────────────────────────────────────────────
export const ROLES = ["admin", "teacher", "student"] as const;
export type Role = (typeof ROLES)[number];

// ─── Assignment types ────────────────────────────────────
export const ASSIGNMENT_TYPES = ["html-css-js", "react"] as const;
export type AssignmentType = (typeof ASSIGNMENT_TYPES)[number];

// ─── Submission status ───────────────────────────────────
export const SUBMISSION_STATUSES = [
  "pending",
  "queued",
  "running",
  "completed",
  "failed",
  "error",
] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

// ─── Judge job status ────────────────────────────────────
export const JUDGE_JOB_STATUSES = [
  "pending",
  "locked",
  "running",
  "completed",
  "failed",
  "dead",
] as const;
export type JudgeJobStatus = (typeof JUDGE_JOB_STATUSES)[number];

// ─── Limits ──────────────────────────────────────────────
export const MAX_UPLOAD_SIZE_MB = 50;
export const MAX_FILES_PER_SUBMISSION = 200;
export const JUDGE_TIMEOUT_MS = 120_000;
export const JUDGE_MAX_ATTEMPTS = 3;

// ─── MinIO paths ─────────────────────────────────────────
export const MINIO_BUCKETS = {
  SUBMISSIONS: "submissions",
  ARTIFACTS: "artifacts",
} as const;
