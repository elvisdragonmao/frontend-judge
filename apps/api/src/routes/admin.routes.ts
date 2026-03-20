import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  BulkImportRequest,
  CreateUserRequest,
  MessageResponse,
  PaginationQuery,
  ResetPasswordRequest,
  UserListResponse,
  UserSummary,
} from "@judge/shared";
import { requireRole } from "../middleware/auth.js";
import {
  authSecurity,
  createRouteSchema,
  toJsonSchema,
  withErrorResponses,
} from "../lib/openapi.js";
import * as userService from "../services/user.service.js";

const BulkImportResult = z.object({
  totalCount: z.number(),
  successCount: z.number(),
  errorCount: z.number(),
  errors: z.array(
    z.object({
      username: z.string(),
      error: z.string(),
    }),
  ),
});

export async function adminRoutes(app: FastifyInstance) {
  const adminOnly = requireRole("admin");

  app.get(
    "/api/admin/users",
    {
      preHandler: adminOnly,
      schema: createRouteSchema({
        tags: ["Admin"],
        summary: "List users",
        security: authSecurity,
        querystring: toJsonSchema(PaginationQuery, "PaginationQuery"),
        response: withErrorResponses(
          {
            200: toJsonSchema(UserListResponse, "UserListResponse"),
          },
          [401, 403],
        ),
      }),
    },
    async (request) => {
      const { page, limit } = PaginationQuery.parse(request.query);
      return userService.listUsers(page, limit);
    },
  );

  app.post(
    "/api/admin/users",
    {
      preHandler: adminOnly,
      schema: createRouteSchema({
        tags: ["Admin"],
        summary: "Create user",
        security: authSecurity,
        body: toJsonSchema(CreateUserRequest, "CreateUserRequest"),
        response: withErrorResponses(
          {
            201: toJsonSchema(UserSummary, "UserSummary"),
          },
          [401, 403, 409],
        ),
      }),
    },
    async (request, reply) => {
      const body = CreateUserRequest.parse(request.body);
      try {
        const user = await userService.createUser(body);
        return reply.status(201).send(user);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        if (message.includes("uq_users_username")) {
          return reply
            .status(409)
            .send({ error: "帳號已存在", statusCode: 409 });
        }
        throw err;
      }
    },
  );

  app.post(
    "/api/admin/users/bulk-import",
    {
      preHandler: adminOnly,
      schema: createRouteSchema({
        tags: ["Admin"],
        summary: "Bulk import users",
        security: authSecurity,
        body: toJsonSchema(BulkImportRequest, "BulkImportRequest"),
        response: withErrorResponses(
          {
            200: toJsonSchema(BulkImportResult, "BulkImportResult"),
          },
          [400, 401, 403],
        ),
      }),
    },
    async (request) => {
      const body = BulkImportRequest.parse(request.body);
      return userService.bulkImport(body.users, request.userId);
    },
  );

  app.post(
    "/api/admin/users/reset-password",
    {
      preHandler: adminOnly,
      schema: createRouteSchema({
        tags: ["Admin"],
        summary: "Reset user password",
        security: authSecurity,
        body: toJsonSchema(ResetPasswordRequest, "ResetPasswordRequest"),
        response: withErrorResponses(
          {
            200: toJsonSchema(MessageResponse, "MessageResponse"),
          },
          [400, 401, 403],
        ),
      }),
    },
    async (request) => {
      const body = ResetPasswordRequest.parse(request.body);
      await userService.resetPassword(
        body.userId,
        body.newPassword,
        request.userId,
      );
      return { message: "密碼已重置" };
    },
  );
}
