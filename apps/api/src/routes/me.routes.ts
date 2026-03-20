import type { FastifyInstance } from "fastify";
import {
  ChangePasswordRequest,
  MessageResponse,
  UpdateProfileRequest,
  UserSummary,
} from "@judge/shared";
import { authenticate } from "../middleware/auth.js";
import {
  authSecurity,
  createRouteSchema,
  toJsonSchema,
  withErrorResponses,
} from "../lib/openapi.js";
import * as userService from "../services/user.service.js";

const CurrentUserResponse = UserSummary.omit({ classes: true });

export async function meRoutes(app: FastifyInstance) {
  // Get current user profile
  app.get(
    "/api/me",
    {
      preHandler: authenticate,
      schema: createRouteSchema({
        tags: ["Me"],
        summary: "Get current user",
        security: authSecurity,
        response: withErrorResponses(
          {
            200: toJsonSchema(CurrentUserResponse, "CurrentUserResponse"),
          },
          [401, 500],
        ),
      }),
    },
    async (request) => {
      const user = await userService.findById(request.userId);
      if (!user) throw new Error("User not found");
      return {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        role: user.role,
        createdAt: user.created_at.toISOString(),
      };
    },
  );

  // Update display name
  app.patch(
    "/api/me/profile",
    {
      preHandler: authenticate,
      schema: createRouteSchema({
        tags: ["Me"],
        summary: "Update current user profile",
        security: authSecurity,
        body: toJsonSchema(UpdateProfileRequest, "UpdateProfileRequest"),
        response: withErrorResponses(
          {
            200: toJsonSchema(MessageResponse, "MessageResponse"),
          },
          [400, 401],
        ),
      }),
    },
    async (request) => {
      const body = UpdateProfileRequest.parse(request.body);
      await userService.updateProfile(request.userId, body.displayName);
      return { message: "暱稱更新成功" };
    },
  );

  // Change password
  app.post(
    "/api/me/change-password",
    {
      preHandler: authenticate,
      schema: createRouteSchema({
        tags: ["Me"],
        summary: "Change current user password",
        security: authSecurity,
        body: toJsonSchema(ChangePasswordRequest, "ChangePasswordRequest"),
        response: withErrorResponses(
          {
            200: toJsonSchema(MessageResponse, "MessageResponse"),
          },
          [400, 401],
        ),
      }),
    },
    async (request, reply) => {
      const body = ChangePasswordRequest.parse(request.body);
      const ok = await userService.changePassword(
        request.userId,
        body.currentPassword,
        body.newPassword,
      );
      if (!ok) {
        return reply
          .status(400)
          .send({ error: "目前密碼不正確", statusCode: 400 });
      }
      return { message: "密碼更新成功" };
    },
  );
}
