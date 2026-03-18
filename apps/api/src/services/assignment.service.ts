import { query, queryOne, queryMany, transaction } from "../db/pool.js";
import type {
  CreateAssignmentRequest,
  UpdateAssignmentRequest,
} from "@judge/shared";

interface AssignmentRow {
  id: string;
  class_id: string;
  title: string;
  description: string;
  type: string;
  due_date: Date | null;
  allow_multiple_submissions: boolean;
  created_by: string;
  created_at: Date;
  submission_count?: string;
  class_name?: string;
}

interface SpecRow {
  id: string;
  assignment_id: string;
  start_command: string;
  test_content: string | null;
  timeout_ms: number;
  allowed_paths: string[];
  blocked_paths: string[];
}

function toSummary(row: AssignmentRow) {
  return {
    id: row.id,
    classId: row.class_id,
    title: row.title,
    type: row.type as "html-css-js" | "react",
    dueDate: row.due_date?.toISOString() ?? null,
    allowMultipleSubmissions: row.allow_multiple_submissions,
    submissionCount: parseInt(row.submission_count ?? "0", 10),
    createdAt: row.created_at.toISOString(),
  };
}

export async function listByClass(classId: string) {
  const rows = await queryMany<AssignmentRow>(
    `SELECT a.*,
       (SELECT COUNT(*) FROM submissions WHERE assignment_id = a.id) as submission_count
     FROM assignments a
     WHERE a.class_id = $1
     ORDER BY a.created_at DESC`,
    [classId],
  );
  return rows.map(toSummary);
}

export async function getById(id: string) {
  const row = await queryOne<AssignmentRow>(
    `SELECT a.*,
       c.name as class_name,
       (SELECT COUNT(*) FROM submissions WHERE assignment_id = a.id) as submission_count
     FROM assignments a
     JOIN classes c ON c.id = a.class_id
     WHERE a.id = $1`,
    [id],
  );
  if (!row) return null;

  const spec = await queryOne<SpecRow>(
    "SELECT * FROM assignment_specs WHERE assignment_id = $1",
    [id],
  );

  return {
    ...toSummary(row),
    description: row.description,
    className: row.class_name ?? "",
    spec: spec
      ? {
          startCommand: spec.start_command,
          testContent: spec.test_content ?? undefined,
          timeoutMs: spec.timeout_ms,
          allowedPaths: spec.allowed_paths,
          blockedPaths: spec.blocked_paths,
        }
      : undefined,
  };
}

export async function create(data: CreateAssignmentRequest, createdBy: string) {
  return transaction(async (client) => {
    const result = await client.query(
      `INSERT INTO assignments (class_id, title, description, type, due_date, allow_multiple_submissions, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        data.classId,
        data.title,
        data.description,
        data.type,
        data.dueDate ?? null,
        data.allowMultipleSubmissions,
        createdBy,
      ],
    );
    const assignmentId = result.rows[0]!.id as string;

    await client.query(
      `INSERT INTO assignment_specs (assignment_id, start_command, test_content, timeout_ms, allowed_paths, blocked_paths)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        assignmentId,
        data.spec.startCommand,
        data.spec.testContent ?? null,
        data.spec.timeoutMs,
        data.spec.allowedPaths,
        data.spec.blockedPaths,
      ],
    );

    return assignmentId;
  });
}

export async function update(id: string, data: UpdateAssignmentRequest) {
  await transaction(async (client) => {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (data.title !== undefined) {
      sets.push(`title = $${idx++}`);
      params.push(data.title);
    }
    if (data.description !== undefined) {
      sets.push(`description = $${idx++}`);
      params.push(data.description);
    }
    if (data.type !== undefined) {
      sets.push(`type = $${idx++}`);
      params.push(data.type);
    }
    if (data.dueDate !== undefined) {
      sets.push(`due_date = $${idx++}`);
      params.push(data.dueDate);
    }
    if (data.allowMultipleSubmissions !== undefined) {
      sets.push(`allow_multiple_submissions = $${idx++}`);
      params.push(data.allowMultipleSubmissions);
    }

    if (sets.length > 0) {
      params.push(id);
      await client.query(
        `UPDATE assignments SET ${sets.join(", ")} WHERE id = $${idx}`,
        params,
      );
    }

    if (data.spec) {
      const specSets: string[] = [];
      const specParams: unknown[] = [];
      let specIdx = 1;

      if (data.spec.startCommand !== undefined) {
        specSets.push(`start_command = $${specIdx++}`);
        specParams.push(data.spec.startCommand);
      }
      if (data.spec.testContent !== undefined) {
        specSets.push(`test_content = $${specIdx++}`);
        specParams.push(data.spec.testContent);
      }
      if (data.spec.timeoutMs !== undefined) {
        specSets.push(`timeout_ms = $${specIdx++}`);
        specParams.push(data.spec.timeoutMs);
      }
      if (data.spec.allowedPaths !== undefined) {
        specSets.push(`allowed_paths = $${specIdx++}`);
        specParams.push(data.spec.allowedPaths);
      }
      if (data.spec.blockedPaths !== undefined) {
        specSets.push(`blocked_paths = $${specIdx++}`);
        specParams.push(data.spec.blockedPaths);
      }

      if (specSets.length > 0) {
        specParams.push(id);
        await client.query(
          `UPDATE assignment_specs SET ${specSets.join(", ")} WHERE assignment_id = $${specIdx}`,
          specParams,
        );
      }
    }

    if (data.submissionRecordAction === "delete") {
      await client.query("DELETE FROM submissions WHERE assignment_id = $1", [
        id,
      ]);
    }
  });
}

export async function deleteAssignment(id: string) {
  await query("DELETE FROM assignments WHERE id = $1", [id]);
}
