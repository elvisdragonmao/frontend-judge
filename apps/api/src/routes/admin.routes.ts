import type { FastifyInstance } from "fastify";
import {
  CreateUserRequest,
  BulkImportRequest,
  ResetPasswordRequest,
  PaginationQuery,
} from "@judge/shared";
import { requireRole } from "../middleware/auth.js";
import * as userService from "../services/user.service.js";

export async function adminRoutes(app: FastifyInstance) {
  const adminOnly = requireRole("admin");

  // List all users
  app.get("/api/admin/users", { preHandler: adminOnly }, async (request) => {
    const { page, limit } = PaginationQuery.parse(request.query);
    return userService.listUsers(page, limit);
  });

  // Create a single user
  app.post(
    "/api/admin/users",
    { preHandler: adminOnly },
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

  // Bulk import users
  app.post(
    "/api/admin/users/bulk-import",
    { preHandler: adminOnly },
    async (request) => {
      const body = BulkImportRequest.parse(request.body);
      return userService.bulkImport(body.users, request.userId);
    },
  );

  // Reset user password
  app.post(
    "/api/admin/users/reset-password",
    { preHandler: adminOnly },
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
