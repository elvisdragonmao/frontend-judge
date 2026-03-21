import { IdParam, isStaff, MINIO_BUCKETS, normalizeSubmissionPath, PaginationQuery, shouldIgnoreUploadPath, SubmissionDetail, SubmissionListResponse } from "@judge/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authSecurity, createRouteSchema, toJsonSchema, withErrorResponses } from "../lib/openapi.js";
import { authenticate } from "../middleware/auth.js";
import * as submissionService from "../services/submission.service.js";
import { getPresignedUrl } from "../utils/minio.js";

const SubmissionCreatedResponse = z.object({
	id: z.string().uuid(),
	message: z.string()
});

const DownloadUrlResponse = z.object({
	url: z.string()
});

const SubmissionFileDownloadResponse = z.object({
	url: z.string(),
	filename: z.string()
});

const RejudgeResponse = z.object({
	message: z.string(),
	runId: z.string().uuid()
});

export async function submissionRoutes(app: FastifyInstance) {
	// Upload submission (student only)
	app.post(
		"/api/assignments/:id/submit",
		{
			preHandler: authenticate,
			schema: createRouteSchema({
				tags: ["Submissions"],
				summary: "Submit assignment files",
				security: authSecurity,
				params: toJsonSchema(IdParam, "SubmissionAssignmentIdParam"),
				consumes: ["multipart/form-data"],
				body: {
					type: "object",
					properties: {
						path: {
							type: "array",
							items: { type: "string" },
							description: "Optional repeated path fields aligned with uploaded files."
						},
						file: {
							type: "array",
							items: { type: "string", format: "binary" },
							description: "One or more uploaded files."
						}
					}
				},
				response: withErrorResponses(
					{
						201: toJsonSchema(SubmissionCreatedResponse, "SubmissionCreatedResponse")
					},
					[400, 401]
				)
			})
		},
		async (request, reply) => {
			const { id: assignmentId } = IdParam.parse(request.params);

			// Parse multipart files
			const parts = request.parts();
			const files: Array<{ path: string; buffer: Buffer }> = [];
			const pendingPaths: string[] = [];

			for await (const part of parts) {
				if (part.type === "file") {
					const submittedPath = pendingPaths.shift();
					const normalizedPath = normalizeSubmissionPath(submittedPath ?? part.filename);
					const buffer = await part.toBuffer();

					if (!normalizedPath || shouldIgnoreUploadPath(normalizedPath)) {
						continue;
					}

					files.push({ path: normalizedPath, buffer });
					continue;
				}

				if (part.fieldname === "path" && typeof part.value === "string") {
					pendingPaths.push(part.value);
				}
			}

			if (files.length === 0) {
				return reply.status(400).send({ error: "請上傳至少一個檔案", statusCode: 400 });
			}

			const submissionId = await submissionService.createSubmission(assignmentId, request.userId, files);

			return reply.status(201).send({ id: submissionId, message: "作業已提交" });
		}
	);

	// List submissions for an assignment (staff: all, student: own)
	app.get(
		"/api/assignments/:id/submissions",
		{
			preHandler: authenticate,
			schema: createRouteSchema({
				tags: ["Submissions"],
				summary: "List submissions for assignment",
				security: authSecurity,
				params: toJsonSchema(IdParam, "SubmissionListAssignmentIdParam"),
				querystring: toJsonSchema(PaginationQuery, "SubmissionPaginationQuery"),
				response: withErrorResponses(
					{
						200: toJsonSchema(SubmissionListResponse, "SubmissionListResponse")
					},
					[401]
				)
			})
		},
		async request => {
			const { id: assignmentId } = IdParam.parse(request.params);
			const { page, limit } = PaginationQuery.parse(request.query);

			if (isStaff(request.userRole)) {
				return submissionService.listByAssignment(assignmentId, page, limit);
			}

			// Students see only their own
			const submissions = await submissionService.listByUser(request.userId, assignmentId);
			return { submissions, total: submissions.length };
		}
	);

	// Get submission detail
	app.get(
		"/api/submissions/:id",
		{
			preHandler: authenticate,
			schema: createRouteSchema({
				tags: ["Submissions"],
				summary: "Get submission detail",
				security: authSecurity,
				params: toJsonSchema(IdParam, "SubmissionIdParam"),
				response: withErrorResponses(
					{
						200: toJsonSchema(SubmissionDetail, "SubmissionDetail")
					},
					[401, 403, 404]
				)
			})
		},
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
		}
	);

	// Download original submission file (admin only)
	app.get(
		"/api/submission-files/:id/download",
		{
			preHandler: authenticate,
			schema: createRouteSchema({
				tags: ["Submissions"],
				summary: "Get submission file download URL",
				security: authSecurity,
				params: toJsonSchema(IdParam, "SubmissionFileIdParam"),
				response: withErrorResponses(
					{
						200: toJsonSchema(SubmissionFileDownloadResponse, "SubmissionFileDownloadResponse")
					},
					[401, 403, 404]
				)
			})
		},
		async (request, reply) => {
			if (request.userRole !== "admin") {
				return reply.status(403).send({ error: "Forbidden", statusCode: 403 });
			}

			const { id } = IdParam.parse(request.params);
			const file = await submissionService.getFileForDownload(id);

			if (!file) {
				return reply.status(404).send({ error: "檔案不存在", statusCode: 404 });
			}

			const url = await getPresignedUrl(MINIO_BUCKETS.SUBMISSIONS, file.minioKey);
			return { url, filename: file.path };
		}
	);

	// Rejudge submission
	app.post(
		"/api/submissions/:id/rejudge",
		{
			preHandler: authenticate,
			schema: createRouteSchema({
				tags: ["Submissions"],
				summary: "Requeue submission for judging",
				security: authSecurity,
				params: toJsonSchema(IdParam, "RejudgeSubmissionIdParam"),
				response: withErrorResponses(
					{
						201: toJsonSchema(RejudgeResponse, "RejudgeResponse")
					},
					[401, 403, 404, 409]
				)
			})
		},
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
					return reply.status(404).send({ error: "提交不存在", statusCode: 404 });
				}

				return reply.status(409).send({ error: "此提交目前已在評測隊列中", statusCode: 409 });
			}

			return reply.status(201).send({ message: "已重新排入評測", runId: result.runId });
		}
	);

	// Get artifact URL
	app.get(
		"/api/artifacts/:id/url",
		{
			preHandler: authenticate,
			schema: createRouteSchema({
				tags: ["Submissions"],
				summary: "Get artifact URL",
				security: authSecurity,
				params: toJsonSchema(IdParam, "ArtifactIdParam"),
				response: withErrorResponses(
					{
						200: toJsonSchema(DownloadUrlResponse, "DownloadUrlResponse")
					},
					[401, 403, 404]
				)
			})
		},
		async (request, reply) => {
			const { id } = IdParam.parse(request.params);
			const { queryOne } = await import("../db/pool.js");
			const artifact = await queryOne<{
				minio_key: string;
				submission_id: string;
				user_id: string;
			}>(
				`SELECT sa.minio_key, sa.submission_id, s.user_id
				 FROM submission_artifacts sa
				 JOIN submissions s ON s.id = sa.submission_id
				 WHERE sa.id = $1`,
				[id]
			);
			if (!artifact) {
				return reply.status(404).send({ error: "Artifact not found", statusCode: 404 });
			}

			if (request.userRole === "student" && artifact.user_id !== request.userId) {
				return reply.status(403).send({ error: "Forbidden", statusCode: 403 });
			}

			const url = await getPresignedUrl(MINIO_BUCKETS.ARTIFACTS, artifact.minio_key);
			return { url };
		}
	);
}
