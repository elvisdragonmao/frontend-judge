import { queryOne, queryMany, query } from "../db/pool.js";
import { JUDGE_MAX_ATTEMPTS } from "@judge/shared";

interface JudgeJobRow {
  id: string;
  submission_id: string;
  run_id: string;
  status: string;
  attempts: number;
  max_attempts: number;
  locked_by: string | null;
  locked_at: Date | null;
  started_at: Date | null;
  finished_at: Date | null;
  error_message: string | null;
  created_at: Date;
}

/**
 * Acquire the next pending job using SELECT FOR UPDATE SKIP LOCKED.
 * This is the core of our PG-based queue.
 */
export async function acquireJob(
  workerId: string,
): Promise<JudgeJobRow | null> {
  const row = await queryOne<JudgeJobRow>(
    `UPDATE judge_jobs
     SET status = 'locked', locked_by = $1, locked_at = NOW(), attempts = attempts + 1
     WHERE id = (
       SELECT id FROM judge_jobs
       WHERE status = 'pending' AND attempts < max_attempts
       ORDER BY created_at ASC
       FOR UPDATE SKIP LOCKED
       LIMIT 1
     )
     RETURNING *`,
    [workerId],
  );
  return row;
}

/** Mark job as running */
export async function markRunning(jobId: string) {
  await query(
    `UPDATE judge_jobs SET status = 'running', started_at = NOW() WHERE id = $1`,
    [jobId],
  );
  // Also update the submission run
  const job = await queryOne<JudgeJobRow>(
    "SELECT * FROM judge_jobs WHERE id = $1",
    [jobId],
  );
  if (job) {
    await query(
      "UPDATE submission_runs SET status = 'running', started_at = NOW() WHERE id = $1",
      [job.run_id],
    );
    await query("UPDATE submissions SET status = 'running' WHERE id = $1", [
      job.submission_id,
    ]);
  }
}

/** Mark job as completed with results */
export async function markCompleted(
  jobId: string,
  results: {
    score: number;
    maxScore: number;
    testResults: unknown;
    log: string;
  },
) {
  const job = await queryOne<JudgeJobRow>(
    "SELECT * FROM judge_jobs WHERE id = $1",
    [jobId],
  );
  if (!job) return;

  await query(
    `UPDATE judge_jobs SET status = 'completed', finished_at = NOW() WHERE id = $1`,
    [jobId],
  );

  await query(
    `UPDATE submission_runs
     SET status = 'completed', score = $1, max_score = $2,
         test_results = $3, log = $4, finished_at = NOW()
     WHERE id = $5`,
    [
      results.score,
      results.maxScore,
      JSON.stringify(results.testResults),
      results.log,
      job.run_id,
    ],
  );

  await query(
    `UPDATE submissions
     SET status = 'completed', score = $1, max_score = $2
     WHERE id = $3`,
    [results.score, results.maxScore, job.submission_id],
  );
}

/** Mark job as failed */
export async function markFailed(jobId: string, errorMessage: string) {
  const job = await queryOne<JudgeJobRow>(
    "SELECT * FROM judge_jobs WHERE id = $1",
    [jobId],
  );
  if (!job) return;

  const finalStatus =
    job.attempts >= (job.max_attempts || JUDGE_MAX_ATTEMPTS)
      ? "dead"
      : "failed";
  const subStatus = finalStatus === "dead" ? "error" : "failed";

  await query(
    `UPDATE judge_jobs SET status = $1, finished_at = NOW(), error_message = $2 WHERE id = $3`,
    [finalStatus, errorMessage, jobId],
  );

  await query(
    `UPDATE submission_runs
     SET status = $1, log = $2, finished_at = NOW()
     WHERE id = $3`,
    [subStatus, errorMessage, job.run_id],
  );

  await query(`UPDATE submissions SET status = $1 WHERE id = $2`, [
    subStatus,
    job.submission_id,
  ]);

  // If failed (not dead), re-queue by resetting to pending
  if (finalStatus === "failed") {
    await query(
      `UPDATE judge_jobs SET status = 'pending', locked_by = NULL, locked_at = NULL WHERE id = $1`,
      [jobId],
    );
  }
}

/** Get pending job count */
export async function getPendingCount(): Promise<number> {
  const row = await queryOne<{ count: string }>(
    "SELECT COUNT(*) as count FROM judge_jobs WHERE status IN ('pending', 'locked', 'running')",
  );
  return parseInt(row?.count ?? "0", 10);
}

/** Clean up stale locked jobs (heartbeat timeout) */
export async function cleanStaleLocks(timeoutMs: number = 300_000) {
  await query(
    `UPDATE judge_jobs
     SET status = 'pending', locked_by = NULL, locked_at = NULL
     WHERE status = 'locked'
       AND locked_at < NOW() - INTERVAL '${timeoutMs} milliseconds'`,
  );
}
