const ACTIVE_SUBMISSION_STATUSES = new Set(["pending", "queued", "running"]);

export function isSubmissionActive(status: string) {
  return ACTIVE_SUBMISSION_STATUSES.has(status);
}
