import type { FastifyInstance } from "fastify";
import {
  AssignmentDetail,
  AssignmentSummary,
  CreateAssignmentRequest,
  IdParam,
  MessageResponse,
  UpdateAssignmentRequest,
} from "@judge/shared";
import { authenticate, requireRole } from "../middleware/auth.js";
import {
  authSecurity,
  createRouteSchema,
  toJsonSchema,
  withErrorResponses,
} from "../lib/openapi.js";
import * as assignmentService from "../services/assignment.service.js";

export async function assignmentRoutes(app: FastifyInstance) {
  // List assignments for a class
  app.get(
    "/api/classes/:id/assignments",
    {
      preHandler: authenticate,
      schema: createRouteSchema({
        tags: ["Assignments"],
        summary: "List assignments for class",
        security: authSecurity,
        params: toJsonSchema(IdParam, "AssignmentClassIdParam"),
        response: withErrorResponses(
          {
            200: toJsonSchema(
              AssignmentSummary.array(),
              "AssignmentSummaryList",
            ),
          },
          [401],
        ),
      }),
    },
    async (request) => {
      const { id } = IdParam.parse(request.params);
      return assignmentService.listByClass(id);
    },
  );

  // Get assignment detail
  app.get(
    "/api/assignments/:id",
    {
      preHandler: authenticate,
      schema: createRouteSchema({
        tags: ["Assignments"],
        summary: "Get assignment detail",
        security: authSecurity,
        params: toJsonSchema(IdParam, "AssignmentIdParam"),
        response: withErrorResponses(
          {
            200: toJsonSchema(AssignmentDetail, "AssignmentDetail"),
          },
          [401, 404],
        ),
      }),
    },
    async (request, reply) => {
      const { id } = IdParam.parse(request.params);
      const assignment = await assignmentService.getById(id);
      if (!assignment) {
        return reply.status(404).send({ error: "作業不存在", statusCode: 404 });
      }
      return assignment;
    },
  );

  // Create assignment
  app.post(
    "/api/assignments",
    {
      preHandler: requireRole("admin", "teacher"),
      schema: createRouteSchema({
        tags: ["Assignments"],
        summary: "Create assignment",
        security: authSecurity,
        body: toJsonSchema(CreateAssignmentRequest, "CreateAssignmentRequest"),
        response: withErrorResponses(
          {
            201: {
              type: "object",
              required: ["id"],
              properties: { id: { type: "string", format: "uuid" } },
            },
          },
          [400, 401, 403],
        ),
      }),
    },
    async (request, reply) => {
      const body = CreateAssignmentRequest.parse(request.body);
      const id = await assignmentService.create(body, request.userId);
      return reply.status(201).send({ id });
    },
  );

  // Update assignment
  app.patch(
    "/api/assignments/:id",
    {
      preHandler: requireRole("admin", "teacher"),
      schema: createRouteSchema({
        tags: ["Assignments"],
        summary: "Update assignment",
        security: authSecurity,
        params: toJsonSchema(IdParam, "UpdateAssignmentIdParam"),
        body: toJsonSchema(UpdateAssignmentRequest, "UpdateAssignmentRequest"),
        response: withErrorResponses(
          {
            200: toJsonSchema(MessageResponse, "AssignmentUpdatedResponse"),
          },
          [400, 401, 403],
        ),
      }),
    },
    async (request) => {
      const { id } = IdParam.parse(request.params);
      const body = UpdateAssignmentRequest.parse(request.body);
      await assignmentService.update(id, body);
      return { message: "作業已更新" };
    },
  );

  // Delete assignment
  app.delete(
    "/api/assignments/:id",
    {
      preHandler: requireRole("admin", "teacher"),
      schema: createRouteSchema({
        tags: ["Assignments"],
        summary: "Delete assignment",
        security: authSecurity,
        params: toJsonSchema(IdParam, "DeleteAssignmentIdParam"),
        response: withErrorResponses(
          {
            200: toJsonSchema(MessageResponse, "AssignmentDeletedResponse"),
          },
          [401, 403],
        ),
      }),
    },
    async (request) => {
      const { id } = IdParam.parse(request.params);
      await assignmentService.deleteAssignment(id);
      return { message: "作業已刪除" };
    },
  );
}
