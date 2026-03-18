import fs from "node:fs";
import path from "node:path";
import { MINIO_BUCKETS } from "@judge/shared";
import { config } from "./config.js";
import { pool, query, queryMany, queryOne } from "./db.js";
import { uploadFile } from "./minio.js";
import { HtmlCssJsPipeline } from "./pipelines/html-css-js.pipeline.js";
import { ReactPipeline } from "./pipelines/react.pipeline.js";
import type { JudgeContext, JudgePipeline } from "./pipelines/base.pipeline.js";

const pipelines: Record<string, JudgePipeline> = {
  "html-css-js": new HtmlCssJsPipeline(),
  react: new ReactPipeline(),
};

interface JobRow {
  id: string;
  submission_id: string;
  run_id: string;
  status: string;
  attempts: number;
  max_attempts: number;
}

let activeJob: JobRow | null = null;
let shuttingDown = false;

function stepLog(message: string) {
  return `[${new Date().toISOString()}] ${message}`;
}

async function appendRunLog(runId: string, message: string) {
  await query(
    `UPDATE submission_runs
     SET log = COALESCE(log || E'\n', '') || $1
     WHERE id = $2`,
    [stepLog(message), runId],
  );
}

interface SpecRow {
  start_command: string;
  test_content: string | null;
  timeout_ms: number;
  allowed_paths: string[];
  blocked_paths: string[];
  type: string;
}

async function acquireJob(): Promise<JobRow | null> {
  return queryOne<JobRow>(
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
    [config.WORKER_ID],
  );
}

async function processJob(job: JobRow) {
  activeJob = job;
  console.log(
    `[${config.WORKER_ID}] Processing job ${job.id} (submission: ${job.submission_id})`,
  );

  // Mark running
  await query(
    "UPDATE judge_jobs SET status = 'running', started_at = NOW() WHERE id = $1",
    [job.id],
  );
  await query(
    "UPDATE submission_runs SET status = 'running', started_at = NOW(), log = NULL WHERE id = $1",
    [job.run_id],
  );
  await query("UPDATE submissions SET status = 'running' WHERE id = $1", [
    job.submission_id,
  ]);
  await appendRunLog(job.run_id, "Job acquired");

  // Get assignment spec
  const spec = await queryOne<SpecRow>(
    `SELECT aspec.*, a.type
     FROM assignment_specs aspec
     JOIN assignments a ON a.id = aspec.assignment_id
     JOIN submissions s ON s.assignment_id = a.id
     WHERE s.id = $1`,
    [job.submission_id],
  );

  if (!spec) {
    await appendRunLog(job.run_id, "Assignment spec not found");
    await failJob(job, "Assignment spec not found");
    activeJob = null;
    return;
  }

  const assignmentType = spec.type as "html-css-js" | "react";
  const pipeline = pipelines[assignmentType];

  if (!pipeline) {
    await appendRunLog(
      job.run_id,
      `Unknown assignment type: ${assignmentType}`,
    );
    await failJob(job, `Unknown assignment type: ${assignmentType}`);
    activeJob = null;
    return;
  }

  // Prepare work directory
  const workDir = path.join(config.WORK_DIR, job.id);
  fs.mkdirSync(workDir, { recursive: true });
  await appendRunLog(job.run_id, `Workdir prepared: ${workDir}`);

  try {
    const ctx: JudgeContext = {
      submissionId: job.submission_id,
      runId: job.run_id,
      workDir,
      assignmentType,
      spec: {
        startCommand: spec.start_command,
        testContent: spec.test_content,
        timeoutMs: spec.timeout_ms,
        allowedPaths: spec.allowed_paths,
        blockedPaths: spec.blocked_paths,
      },
    };

    await appendRunLog(job.run_id, "Starting judge pipeline execution");

    const result = await pipeline.execute(ctx);
    await appendRunLog(job.run_id, "Pipeline finished, uploading artifacts");

    // Upload artifacts to MinIO
    for (const artifact of result.artifacts) {
      const minioKey = `${job.submission_id}/${job.run_id}/${artifact.name}`;
      await uploadFile(MINIO_BUCKETS.ARTIFACTS, minioKey, artifact.localPath);

      await query(
        `INSERT INTO submission_artifacts (run_id, submission_id, type, name, minio_key)
         VALUES ($1, $2, $3, $4, $5)`,
        [job.run_id, job.submission_id, artifact.type, artifact.name, minioKey],
      );
      await appendRunLog(job.run_id, `Artifact uploaded: ${artifact.name}`);
    }

    // Update results
    const mergedLog = `${result.log}\n\n${stepLog("Results persisted")}`;
    await query(
      `UPDATE submission_runs
       SET status = 'completed', score = $1, max_score = $2,
            test_results = $3,
            log = COALESCE(log || E'\n\n', '') || $4,
            finished_at = NOW()
       WHERE id = $5`,
      [
        result.score,
        result.maxScore,
        JSON.stringify(result.testResults),
        mergedLog,
        job.run_id,
      ],
    );

    await query(
      `UPDATE submissions
       SET status = 'completed', score = $1, max_score = $2
       WHERE id = $3`,
      [result.score, result.maxScore, job.submission_id],
    );

    await query(
      "UPDATE judge_jobs SET status = 'completed', finished_at = NOW() WHERE id = $1",
      [job.id],
    );

    console.log(
      `[${config.WORKER_ID}] Job ${job.id} completed: ${result.score}/${result.maxScore}`,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[${config.WORKER_ID}] Job ${job.id} failed:`, message);
    await appendRunLog(job.run_id, `Job failed: ${message}`);
    await failJob(job, message);
  } finally {
    // Cleanup work directory
    try {
      fs.rmSync(workDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
    activeJob = null;
  }
}

async function failJob(job: JobRow, errorMessage: string) {
  const isLastAttempt = job.attempts >= job.max_attempts;
  const jobStatus = isLastAttempt ? "dead" : "pending";
  const subStatus = isLastAttempt ? "error" : "failed";

  await query(
    `UPDATE judge_jobs
     SET status = $1, finished_at = NOW(), error_message = $2,
         locked_by = CASE WHEN $1 = 'pending' THEN NULL ELSE locked_by END,
         locked_at = CASE WHEN $1 = 'pending' THEN NULL ELSE locked_at END
     WHERE id = $3`,
    [jobStatus, errorMessage, job.id],
  );

  await query(
    `UPDATE submission_runs
     SET status = $1,
         log = COALESCE(log || E'\n', '') || $2,
         finished_at = NOW()
     WHERE id = $3`,
    [subStatus, errorMessage, job.run_id],
  );

  await query(`UPDATE submissions SET status = $1 WHERE id = $2`, [
    subStatus,
    job.submission_id,
  ]);
}

async function recoverStaleJobs() {
  const staleJobs = await queryMany<{
    id: string;
    run_id: string;
    submission_id: string;
  }>(
    `SELECT id, run_id, submission_id
     FROM judge_jobs
     WHERE status IN ('locked', 'running')`,
  );

  if (staleJobs.length === 0) return;

  const jobIds = staleJobs.map((j) => j.id);
  const runIds = staleJobs.map((j) => j.run_id);
  const submissionIds = staleJobs.map((j) => j.submission_id);

  await query(
    `UPDATE judge_jobs
     SET status = 'pending', locked_by = NULL, locked_at = NULL, started_at = NULL
     WHERE id = ANY($1::uuid[])`,
    [jobIds],
  );
  await query(
    `UPDATE submission_runs
     SET status = 'pending', started_at = NULL,
         log = COALESCE(log || E'\n', '') || $1
     WHERE id = ANY($2::uuid[])`,
    [stepLog("Recovered from stale worker interruption, re-queued"), runIds],
  );
  await query(
    `UPDATE submissions
     SET status = 'queued'
     WHERE id = ANY($1::uuid[])`,
    [submissionIds],
  );

  console.warn(
    `[${config.WORKER_ID}] Recovered ${staleJobs.length} in-progress job(s) at startup and re-queued`,
  );
}

async function gracefulShutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.warn(`[${config.WORKER_ID}] Received ${signal}, shutting down...`);

  try {
    if (activeJob) {
      await failJob(
        activeJob,
        `Worker interrupted by ${signal}, job re-queued if retries remain`,
      );
    }
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error(`[${config.WORKER_ID}] Graceful shutdown failed:`, err);
    process.exit(1);
  }
}

// ─── Main loop ───────────────────────────────────────────
async function main() {
  console.log(`[${config.WORKER_ID}] Judge worker starting...`);
  console.log(
    `[${config.WORKER_ID}] Poll interval: ${config.POLL_INTERVAL_MS}ms`,
  );
  console.log(`[${config.WORKER_ID}] Work dir: ${config.WORK_DIR}`);

  fs.mkdirSync(config.WORK_DIR, { recursive: true });

  await recoverStaleJobs();

  while (true) {
    try {
      const job = await acquireJob();
      if (job) {
        await processJob(job);
      } else {
        // No job available, wait
        await new Promise((resolve) =>
          setTimeout(resolve, config.POLL_INTERVAL_MS),
        );
      }
    } catch (err) {
      console.error(`[${config.WORKER_ID}] Poll error:`, err);
      await new Promise((resolve) =>
        setTimeout(resolve, config.POLL_INTERVAL_MS),
      );
    }
  }
}

process.on("SIGINT", () => {
  void gracefulShutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void gracefulShutdown("SIGTERM");
});

main().catch((err) => {
  console.error("Worker failed to start:", err);
  process.exit(1);
});
