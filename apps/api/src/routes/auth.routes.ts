import { LoginRequest, LoginResponse, RegisterRequest, RegistrationStatusResponse } from "@judge/shared";
import type { FastifyInstance } from "fastify";
import { createRouteSchema, toJsonSchema, withErrorResponses } from "../lib/openapi.js";
import * as settingsService from "../services/settings.service.js";
import * as userService from "../services/user.service.js";

export async function authRoutes(app: FastifyInstance) {
	app.get(
		"/api/auth/registration-status",
		{
			schema: createRouteSchema({
				tags: ["Auth"],
				summary: "Get registration status",
				response: {
					200: toJsonSchema(RegistrationStatusResponse, "RegistrationStatusResponse")
				}
			})
		},
		async () => settingsService.getRegistrationStatus()
	);

	app.post(
		"/api/auth/login",
		{
			schema: createRouteSchema({
				tags: ["Auth"],
				summary: "Login",
				body: toJsonSchema(LoginRequest, "LoginRequest"),
				response: withErrorResponses(
					{
						200: toJsonSchema(LoginResponse, "LoginResponse")
					},
					[401]
				)
			})
		},
		async (request, reply) => {
			const body = LoginRequest.parse(request.body);
			const user = await userService.verifyPassword(body.username, body.password);

			if (!user) {
				return reply.status(401).send({ error: "帳號或密碼錯誤", statusCode: 401 });
			}

			const token = app.jwt.sign({ sub: user.id, role: user.role }, { expiresIn: "7d" });

			return { token, user };
		}
	);

	app.post(
		"/api/auth/register",
		{
			schema: createRouteSchema({
				tags: ["Auth"],
				summary: "Register student account",
				body: toJsonSchema(RegisterRequest, "RegisterRequest"),
				response: withErrorResponses(
					{
						201: toJsonSchema(LoginResponse, "RegisterResponse")
					},
					[403, 409]
				)
			})
		},
		async (request, reply) => {
			const body = RegisterRequest.parse(request.body);
			const { registrationEnabled } = await settingsService.getRegistrationStatus();

			if (!registrationEnabled) {
				return reply.status(403).send({ error: "目前未開放註冊", statusCode: 403 });
			}

			try {
				const user = await userService.registerStudent(body);
				const token = app.jwt.sign({ sub: user.id, role: user.role }, { expiresIn: "7d" });
				return reply.status(201).send({ token, user });
			} catch (err: unknown) {
				const message = err instanceof Error ? err.message : "Unknown error";
				if (message.includes("uq_users_username")) {
					return reply.status(409).send({ error: "帳號已存在", statusCode: 409 });
				}
				throw err;
			}
		}
	);
}
