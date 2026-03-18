import type { FastifyInstance } from "fastify";
import { LoginRequest } from "@judge/shared";
import * as userService from "../services/user.service.js";

export async function authRoutes(app: FastifyInstance) {
  app.post("/api/auth/login", async (request, reply) => {
    const body = LoginRequest.parse(request.body);
    const user = await userService.verifyPassword(body.username, body.password);

    if (!user) {
      return reply
        .status(401)
        .send({ error: "帳號或密碼錯誤", statusCode: 401 });
    }

    const token = app.jwt.sign(
      { sub: user.id, role: user.role },
      { expiresIn: "7d" },
    );

    return { token, user };
  });
}
