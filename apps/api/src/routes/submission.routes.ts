import type { FastifyInstance } from "fastify";
import { IdParam, PaginationQuery, isStaff } from "@judge/shared";
import { authenticate } from "../middleware/auth.js";
import * as submissionService from "../services/submission.service.js";
import { getPresignedUrl } from "../utils/minio.js";
import { MINIO_BUCKETS } from "@judge/shared";

export async function submissionRoutes(app: FastifyInstance) {
  // Upload submission (student only)
  app.post(
    "/api/assignments/:id/submit",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id: assignmentId } = IdParam.parse(request.params);

      // Parse multipart files
      const parts = request.parts();
      const files: Array<{ path: string; buffer: Buffer }> = [];

      for await (const part of parts) {
        if (part.type === "file") {
          const buffer = await part.toBuffer();
          // Use the filename field; for folder uploads the browser sends the relative path
          const filePath =
            (part.fields as Record<string, { value?: string }>)?.relativePath
              ?.value || part.filename;
          files.push({ path: filePath, buffer });
        }
      }

      if (files.length === 0) {
        return reply
          .status(400)
          .send({ error: "請上傳至少一個檔案", statusCode: 400 });
      }

      const submissionId = await submissionService.createSubmission(
        assignmentId,
        request.userId,
        files,
      );

      return reply
        .status(201)
        .send({ id: submissionId, message: "作業已提交" });
    },
  );

  // List submissions for an assignment (staff: all, student: own)
  app.get(
    "/api/assignments/:id/submissions",
    { preHandler: authenticate },
    async (request) => {
      const { id: assignmentId } = IdParam.parse(request.params);
      const { page, limit } = PaginationQuery.parse(request.query);

      if (isStaff(request.userRole)) {
        return submissionService.listByAssignment(assignmentId, page, limit);
      }

      // Students see only their own
      const submissions = await submissionService.listByUser(
        request.userId,
        assignmentId,
      );
      return { submissions, total: submissions.length };
    },
  );

  // Get submission detail
  app.get(
    "/api/submissions/:id",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = IdParam.parse(request.params);
      const detail = await submissionService.getDetail(id);

      if (!detail) {
        return reply.status(404).send({ error: "提交不存在", statusCode: 404 });
      }

      // Students can only see their own
      if (request.userRole === "student" && detail.userId !== request.userId) {
        return reply.status(403).send({ error: "Forbidden", statusCode: 403 });
      }

      return detail;
    },
  );

  // Download original submission file (admin only)
  app.get(
    "/api/submission-files/:id/download",
    { preHandler: authenticate },
    async (request, reply) => {
      if (request.userRole !== "admin") {
        return reply.status(403).send({ error: "Forbidden", statusCode: 403 });
      }

      const { id } = IdParam.parse(request.params);
      const file = await submissionService.getFileForDownload(id);

      if (!file) {
        return reply.status(404).send({ error: "檔案不存在", statusCode: 404 });
      }

      const url = await getPresignedUrl(
        MINIO_BUCKETS.SUBMISSIONS,
        file.minioKey,
      );
      return { url, filename: file.path };
    },
  );

  // Rejudge submission
  app.post(
    "/api/submissions/:id/rejudge",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = IdParam.parse(request.params);
      const detail = await submissionService.getDetail(id);

      if (!detail) {
        return reply.status(404).send({ error: "提交不存在", statusCode: 404 });
      }

      if (request.userRole === "student" && detail.userId !== request.userId) {
        return reply.status(403).send({ error: "Forbidden", statusCode: 403 });
      }

      const result = await submissionService.rejudgeSubmission(id);

      if (!result.ok) {
        if (result.reason === "not_found") {
          return reply
            .status(404)
            .send({ error: "提交不存在", statusCode: 404 });
        }

        return reply
          .status(409)
          .send({ error: "此提交目前已在評測隊列中", statusCode: 409 });
      }

      return reply
        .status(201)
        .send({ message: "已重新排入評測", runId: result.runId });
    },
  );

  // Get artifact URL
  app.get(
    "/api/artifacts/:id/url",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = IdParam.parse(request.params);
      // Simple implementation: just generate a presigned URL
      // In a real system you'd look up the artifact and check permissions
      const { queryOne } = await import("../db/pool.js");
      const artifact = await queryOne<{
        minio_key: string;
        submission_id: string;
      }>(
        "SELECT minio_key, submission_id FROM submission_artifacts WHERE id = $1",
        [id],
      );
      if (!artifact) {
        return reply
          .status(404)
          .send({ error: "Artifact not found", statusCode: 404 });
      }

      const url = await getPresignedUrl(
        MINIO_BUCKETS.ARTIFACTS,
        artifact.minio_key,
      );
      return { url };
    },
  );
}
