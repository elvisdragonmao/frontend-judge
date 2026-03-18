import { query, queryOne, queryMany, transaction } from "../db/pool.js";
import { MINIO_BUCKETS } from "@judge/shared";
import { uploadBuffer, getPresignedUrl } from "../utils/minio.js";

interface SubmissionRow {
  id: string;
  assignment_id: string;
  user_id: string;
  status: string;
  score: number | null;
  max_score: number | null;
  file_count: number;
  created_at: Date;
  username?: string;
  display_name?: string;
}

interface FileRow {
  id: string;
  submission_id: string;
  path: string;
  size: number;
  minio_key: string;
}

interface DownloadFileRow {
  id: string;
  submission_id: string;
  path: string;
  minio_key: string;
}

interface RunRow {
  id: string;
  submission_id: string;
  status: string;
  score: number | null;
  max_score: number | null;
  test_results: unknown;
  log: string | null;
  started_at: Date | null;
  finished_at: Date | null;
  created_at: Date;
}

interface ArtifactRow {
  id: string;
  run_id: string;
  submission_id: string;
  type: string;
  name: string;
  minio_key: string;
}

export async function createSubmission(
  assignmentId: string,
  userId: string,
  files: Array<{ path: string; buffer: Buffer }>,
) {
  return transaction(async (client) => {
    const result = await client.query(
      `INSERT INTO submissions (assignment_id, user_id, file_count, status)
       VALUES ($1, $2, $3, 'pending') RETURNING id`,
      [assignmentId, userId, files.length],
    );
    const submissionId = result.rows[0]!.id as string;

    // Upload files to MinIO and record in DB
    for (const file of files) {
      const minioKey = `${submissionId}/${file.path}`;
      await uploadBuffer(MINIO_BUCKETS.SUBMISSIONS, minioKey, file.buffer);

      await client.query(
        `INSERT INTO submission_files (submission_id, path, size, minio_key)
         VALUES ($1, $2, $3, $4)`,
        [submissionId, file.path, file.buffer.length, minioKey],
      );
    }

    // Create initial run
    const runResult = await client.query(
      `INSERT INTO submission_runs (submission_id, status)
       VALUES ($1, 'pending') RETURNING id`,
      [submissionId],
    );
    const runId = runResult.rows[0]!.id as string;

    // Create judge job
    await client.query(
      `INSERT INTO judge_jobs (submission_id, run_id, status)
       VALUES ($1, $2, 'pending')`,
      [submissionId, runId],
    );

    // Update submission status
    await client.query(
      "UPDATE submissions SET status = 'queued' WHERE id = $1",
      [submissionId],
    );

    return submissionId;
  });
}

export async function listByAssignment(
  assignmentId: string,
  page: number,
  limit: number,
) {
  const offset = (page - 1) * limit;

  const [rows, countResult] = await Promise.all([
    queryMany<SubmissionRow>(
      `SELECT s.*, u.username, u.display_name
       FROM submissions s
       JOIN users u ON u.id = s.user_id
       WHERE s.assignment_id = $1
       ORDER BY s.created_at DESC
       LIMIT $2 OFFSET $3`,
      [assignmentId, limit, offset],
    ),
    queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM submissions WHERE assignment_id = $1",
      [assignmentId],
    ),
  ]);

  const submissions = await Promise.all(
    rows.map(async (row) => {
      // Get latest screenshot
      const artifact = await queryOne<ArtifactRow>(
        `SELECT sa.* FROM submission_artifacts sa
         JOIN submission_runs sr ON sr.id = sa.run_id
         WHERE sa.submission_id = $1 AND sa.type = 'screenshot'
         ORDER BY sa.created_at DESC LIMIT 1`,
        [row.id],
      );

      let screenshotUrl: string | null = null;
      if (artifact) {
        screenshotUrl = await getPresignedUrl(
          MINIO_BUCKETS.ARTIFACTS,
          artifact.minio_key,
        );
      }

      return {
        id: row.id,
        assignmentId: row.assignment_id,
        userId: row.user_id,
        username: row.username ?? "",
        displayName: row.display_name ?? "",
        status: row.status as
          | "pending"
          | "queued"
          | "running"
          | "completed"
          | "failed"
          | "error",
        score: row.score,
        maxScore: row.max_score,
        screenshotUrl,
        fileCount: row.file_count,
        createdAt: row.created_at.toISOString(),
      };
    }),
  );

  return {
    submissions,
    total: parseInt(countResult?.count ?? "0", 10),
  };
}

export async function getDetail(submissionId: string) {
  const row = await queryOne<SubmissionRow>(
    `SELECT s.*, u.username, u.display_name
     FROM submissions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = $1`,
    [submissionId],
  );
  if (!row) return null;

  const files = await queryMany<FileRow>(
    "SELECT * FROM submission_files WHERE submission_id = $1 ORDER BY path",
    [submissionId],
  );

  const runs = await queryMany<RunRow>(
    "SELECT * FROM submission_runs WHERE submission_id = $1 ORDER BY created_at DESC",
    [submissionId],
  );

  const runsWithArtifacts = await Promise.all(
    runs.map(async (run) => {
      const artifacts = await queryMany<ArtifactRow>(
        "SELECT * FROM submission_artifacts WHERE run_id = $1",
        [run.id],
      );

      return {
        id: run.id,
        submissionId: run.submission_id,
        status: run.status as
          | "pending"
          | "queued"
          | "running"
          | "completed"
          | "failed"
          | "error",
        score: run.score,
        maxScore: run.max_score,
        testResults: run.test_results as Array<{
          name: string;
          passed: boolean;
          message?: string;
          score: number;
        }> | null,
        log: run.log,
        artifacts: artifacts.map((a) => ({
          id: a.id,
          type: a.type as "screenshot" | "log" | "report",
          name: a.name,
          minioKey: a.minio_key,
        })),
        startedAt: run.started_at?.toISOString() ?? null,
        finishedAt: run.finished_at?.toISOString() ?? null,
        createdAt: run.created_at.toISOString(),
      };
    }),
  );

  return {
    id: row.id,
    assignmentId: row.assignment_id,
    userId: row.user_id,
    username: row.username ?? "",
    displayName: row.display_name ?? "",
    status: row.status as
      | "pending"
      | "queued"
      | "running"
      | "completed"
      | "failed"
      | "error",
    score: row.score,
    maxScore: row.max_score,
    screenshotUrl: null as string | null,
    fileCount: row.file_count,
    createdAt: row.created_at.toISOString(),
    files: files.map((f) => ({
      id: f.id,
      path: f.path,
      size: Number(f.size),
      minioKey: f.minio_key,
    })),
    runs: runsWithArtifacts,
  };
}

export async function listByUser(userId: string, assignmentId: string) {
  const rows = await queryMany<SubmissionRow>(
    `SELECT s.*, u.username, u.display_name
     FROM submissions s
     JOIN users u ON u.id = s.user_id
     WHERE s.user_id = $1 AND s.assignment_id = $2
     ORDER BY s.created_at DESC`,
    [userId, assignmentId],
  );

  return rows.map((row) => ({
    id: row.id,
    assignmentId: row.assignment_id,
    userId: row.user_id,
    username: row.username ?? "",
    displayName: row.display_name ?? "",
    status: row.status as
      | "pending"
      | "queued"
      | "running"
      | "completed"
      | "failed"
      | "error",
    score: row.score,
    maxScore: row.max_score,
    screenshotUrl: null as string | null,
    fileCount: row.file_count,
    createdAt: row.created_at.toISOString(),
  }));
}

export async function getFileForDownload(fileId: string) {
  const row = await queryOne<DownloadFileRow>(
    `SELECT id, submission_id, path, minio_key
     FROM submission_files
     WHERE id = $1`,
    [fileId],
  );

  if (!row) return null;

  return {
    id: row.id,
    submissionId: row.submission_id,
    path: row.path,
    minioKey: row.minio_key,
  };
}

export async function rejudgeSubmission(submissionId: string) {
  return transaction(async (client) => {
    const submission = await client.query<{ id: string }>(
      "SELECT id FROM submissions WHERE id = $1",
      [submissionId],
    );

    if (submission.rows.length === 0) {
      return { ok: false as const, reason: "not_found" as const };
    }

    const activeJob = await client.query<{ id: string }>(
      `SELECT id
       FROM judge_jobs
       WHERE submission_id = $1
         AND status IN ('pending', 'locked', 'running')
       LIMIT 1`,
      [submissionId],
    );

    if (activeJob.rows.length > 0) {
      return { ok: false as const, reason: "already_queued" as const };
    }

    const runResult = await client.query<{ id: string }>(
      `INSERT INTO submission_runs (submission_id, status)
       VALUES ($1, 'pending')
       RETURNING id`,
      [submissionId],
    );

    const runId = runResult.rows[0]!.id;

    await client.query(
      `INSERT INTO judge_jobs (submission_id, run_id, status)
       VALUES ($1, $2, 'pending')`,
      [submissionId, runId],
    );

    await client.query(
      "UPDATE submissions SET status = 'queued' WHERE id = $1",
      [submissionId],
    );

    return { ok: true as const, runId };
  });
}
