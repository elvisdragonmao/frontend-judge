import type { FastifyInstance } from "fastify";
import {
  CreateAssignmentRequest,
  UpdateAssignmentRequest,
  IdParam,
} from "@judge/shared";
import { authenticate, requireRole } from "../middleware/auth.js";
import * as assignmentService from "../services/assignment.service.js";

export async function assignmentRoutes(app: FastifyInstance) {
  // List assignments for a class
  app.get(
    "/api/classes/:id/assignments",
    { preHandler: authenticate },
    async (request) => {
      const { id } = IdParam.parse(request.params);
      return assignmentService.listByClass(id);
    },
  );

  // Get assignment detail
  app.get(
    "/api/assignments/:id",
    { preHandler: authenticate },
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
    { preHandler: requireRole("admin", "teacher") },
    async (request, reply) => {
      const body = CreateAssignmentRequest.parse(request.body);
      const id = await assignmentService.create(body, request.userId);
      return reply.status(201).send({ id });
    },
  );

  // Update assignment
  app.patch(
    "/api/assignments/:id",
    { preHandler: requireRole("admin", "teacher") },
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
    { preHandler: requireRole("admin", "teacher") },
    async (request) => {
      const { id } = IdParam.parse(request.params);
      await assignmentService.deleteAssignment(id);
      return { message: "作業已刪除" };
    },
  );
}
