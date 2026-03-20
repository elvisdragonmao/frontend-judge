import type { FastifyInstance } from "fastify";
import {
  CreateClassRequest,
  UpdateClassRequest,
  AddClassMembersRequest,
  ClassCumulativeScorePoint,
  ClassDetail,
  ClassSummary,
  RemoveClassMemberRequest,
  IdParam,
  MessageResponse,
} from "@judge/shared";
import { authenticate, requireRole } from "../middleware/auth.js";
import { isStaff } from "@judge/shared";
import {
  authSecurity,
  createRouteSchema,
  toJsonSchema,
  withErrorResponses,
} from "../lib/openapi.js";
import * as classService from "../services/class.service.js";

export async function classRoutes(app: FastifyInstance) {
  // List classes (staff: all, student: only enrolled)
  app.get(
    "/api/classes",
    {
      preHandler: authenticate,
      schema: createRouteSchema({
        tags: ["Classes"],
        summary: "List classes",
        security: authSecurity,
        response: withErrorResponses(
          {
            200: toJsonSchema(ClassSummary.array(), "ClassSummaryList"),
          },
          [401],
        ),
      }),
    },
    async (request) => {
      if (isStaff(request.userRole)) {
        return classService.listClasses();
      }
      return classService.listClassesForUser(request.userId);
    },
  );

  // Get class detail
  app.get(
    "/api/classes/:id",
    {
      preHandler: authenticate,
      schema: createRouteSchema({
        tags: ["Classes"],
        summary: "Get class detail",
        security: authSecurity,
        params: toJsonSchema(IdParam, "IdParam"),
        response: withErrorResponses(
          {
            200: toJsonSchema(ClassDetail, "ClassDetail"),
          },
          [401, 403, 404],
        ),
      }),
    },
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

  // Get cumulative class score history
  app.get(
    "/api/classes/:id/score-history",
    {
      preHandler: authenticate,
      schema: createRouteSchema({
        tags: ["Classes"],
        summary: "Get class score history",
        security: authSecurity,
        params: toJsonSchema(IdParam, "ClassIdParam"),
        response: withErrorResponses(
          {
            200: toJsonSchema(
              ClassCumulativeScorePoint.array(),
              "ClassCumulativeScorePointList",
            ),
          },
          [401, 403],
        ),
      }),
    },
    async (request, reply) => {
      const { id } = IdParam.parse(request.params);

      if (request.userRole === "student") {
        const inClass = await classService.isUserInClass(request.userId, id);
        if (!inClass) {
          return reply
            .status(403)
            .send({ error: "Forbidden", statusCode: 403 });
        }
      }

      return classService.getClassScoreHistory(id);
    },
  );

  // Create class (staff only)
  app.post(
    "/api/classes",
    {
      preHandler: requireRole("admin", "teacher"),
      schema: createRouteSchema({
        tags: ["Classes"],
        summary: "Create class",
        security: authSecurity,
        body: toJsonSchema(CreateClassRequest, "CreateClassRequest"),
        response: withErrorResponses(
          {
            201: toJsonSchema(ClassSummary, "CreatedClassSummary"),
          },
          [400, 401, 403],
        ),
      }),
    },
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
    {
      preHandler: requireRole("admin", "teacher"),
      schema: createRouteSchema({
        tags: ["Classes"],
        summary: "Update class",
        security: authSecurity,
        params: toJsonSchema(IdParam, "UpdateClassIdParam"),
        body: toJsonSchema(UpdateClassRequest, "UpdateClassRequest"),
        response: withErrorResponses(
          {
            200: toJsonSchema(MessageResponse, "ClassUpdatedResponse"),
          },
          [400, 401, 403],
        ),
      }),
    },
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
    {
      preHandler: requireRole("admin", "teacher"),
      schema: createRouteSchema({
        tags: ["Classes"],
        summary: "Add class members",
        security: authSecurity,
        params: toJsonSchema(IdParam, "AddClassMemberIdParam"),
        body: toJsonSchema(AddClassMembersRequest, "AddClassMembersRequest"),
        response: withErrorResponses(
          {
            200: toJsonSchema(MessageResponse, "ClassMembersAddedResponse"),
          },
          [400, 401, 403],
        ),
      }),
    },
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
    {
      preHandler: requireRole("admin", "teacher"),
      schema: createRouteSchema({
        tags: ["Classes"],
        summary: "Remove class member",
        security: authSecurity,
        params: toJsonSchema(IdParam, "RemoveClassMemberIdParam"),
        body: toJsonSchema(
          RemoveClassMemberRequest,
          "RemoveClassMemberRequest",
        ),
        response: withErrorResponses(
          {
            200: toJsonSchema(MessageResponse, "ClassMemberRemovedResponse"),
          },
          [400, 401, 403],
        ),
      }),
    },
    async (request) => {
      const { id } = IdParam.parse(request.params);
      const body = RemoveClassMemberRequest.parse(request.body);
      await classService.removeMember(id, body.userId);
      return { message: "成員已移除" };
    },
  );
}
