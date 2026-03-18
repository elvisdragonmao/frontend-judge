import type { FastifyInstance } from "fastify";
import {
  CreateClassRequest,
  UpdateClassRequest,
  AddClassMembersRequest,
  RemoveClassMemberRequest,
  IdParam,
} from "@judge/shared";
import { authenticate, requireRole } from "../middleware/auth.js";
import { isStaff } from "@judge/shared";
import * as classService from "../services/class.service.js";

export async function classRoutes(app: FastifyInstance) {
  // List classes (staff: all, student: only enrolled)
  app.get("/api/classes", { preHandler: authenticate }, async (request) => {
    if (isStaff(request.userRole)) {
      return classService.listClasses();
    }
    return classService.listClassesForUser(request.userId);
  });

  // Get class detail
  app.get(
    "/api/classes/:id",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = IdParam.parse(request.params);

      // Students can only view their own classes
      if (request.userRole === "student") {
        const inClass = await classService.isUserInClass(request.userId, id);
        if (!inClass) {
          return reply
            .status(403)
            .send({ error: "Forbidden", statusCode: 403 });
        }
      }

      const cls = await classService.getClassDetail(id);
      if (!cls) {
        return reply.status(404).send({ error: "班級不存在", statusCode: 404 });
      }
      return cls;
    },
  );

  // Get score history for a class (for the student)
  app.get(
    "/api/classes/:id/score-history",
    { preHandler: authenticate },
    async (request) => {
      const { id } = IdParam.parse(request.params);
      return classService.getScoreHistory(id, request.userId);
    },
  );

  // Create class (staff only)
  app.post(
    "/api/classes",
    { preHandler: requireRole("admin", "teacher") },
    async (request, reply) => {
      const body = CreateClassRequest.parse(request.body);
      const cls = await classService.createClass(
        body.name,
        body.description,
        request.userId,
      );
      return reply.status(201).send(cls);
    },
  );

  // Update class
  app.patch(
    "/api/classes/:id",
    { preHandler: requireRole("admin", "teacher") },
    async (request) => {
      const { id } = IdParam.parse(request.params);
      const body = UpdateClassRequest.parse(request.body);
      await classService.updateClass(id, body);
      return { message: "班級已更新" };
    },
  );

  // Add members
  app.post(
    "/api/classes/:id/members",
    { preHandler: requireRole("admin", "teacher") },
    async (request) => {
      const { id } = IdParam.parse(request.params);
      const body = AddClassMembersRequest.parse(request.body);
      await classService.addMembers(id, body.userIds);
      return { message: "成員已加入" };
    },
  );

  // Remove member
  app.delete(
    "/api/classes/:id/members",
    { preHandler: requireRole("admin", "teacher") },
    async (request) => {
      const { id } = IdParam.parse(request.params);
      const body = RemoveClassMemberRequest.parse(request.body);
      await classService.removeMember(id, body.userId);
      return { message: "成員已移除" };
    },
  );
}
