import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { config } from "./config.js";
import { ensureBuckets } from "./utils/minio.js";
import { authRoutes } from "./routes/auth.routes.js";
import { meRoutes } from "./routes/me.routes.js";
import { adminRoutes } from "./routes/admin.routes.js";
import { classRoutes } from "./routes/class.routes.js";
import { assignmentRoutes } from "./routes/assignment.routes.js";
import { submissionRoutes } from "./routes/submission.routes.js";
import { ZodError } from "zod";

async function main() {
  const app = Fastify({ logger: true });

  // ─── Plugins ─────────────────────────────────────────
  await app.register(cors, { origin: config.CORS_ORIGIN, credentials: true });
  await app.register(jwt, { secret: config.JWT_SECRET });
  await app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
      files: 200,
    },
  });
  await app.register(swagger, {
    openapi: {
      info: {
        title: "emjudge API",
        description: "OpenAPI docs for the emjudge backend.",
        version: "0.0.0",
      },
      servers: [{ url: `http://${config.HOST}:${config.PORT}` }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
      tags: [
        { name: "Auth" },
        { name: "Me" },
        { name: "Admin" },
        { name: "Classes" },
        { name: "Assignments" },
        { name: "Submissions" },
        { name: "System" },
      ],
    },
  });
  await app.register(swaggerUi, {
    routePrefix: "/api/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: false,
    },
  });

  // ─── Error handler ───────────────────────────────────
  app.setErrorHandler((err, _request, reply) => {
    if (err instanceof ZodError) {
      return reply.status(400).send({
        error: "Validation error",
        statusCode: 400,
        details: err.flatten(),
      });
    }
    const error = err as Error & { statusCode?: number };
    app.log.error(error);
    const statusCode = error.statusCode ?? 500;
    const message = error.message || "Internal server error";
    return reply.status(statusCode).send({
      error: message,
      statusCode,
    });
  });

  // ─── Routes ──────────────────────────────────────────
  await app.register(authRoutes);
  await app.register(meRoutes);
  await app.register(adminRoutes);
  await app.register(classRoutes);
  await app.register(assignmentRoutes);
  await app.register(submissionRoutes);

  // Health check
  app.get(
    "/api/health",
    {
      schema: {
        tags: ["System"],
        summary: "Health check",
        response: {
          200: {
            type: "object",
            required: ["status"],
            properties: {
              status: { type: "string", example: "ok" },
            },
          },
        },
      },
    },
    async () => ({ status: "ok" }),
  );

  // ─── Start ───────────────────────────────────────────
  try {
    await ensureBuckets();
    app.log.info("MinIO buckets ensured");
  } catch (err) {
    app.log.warn("MinIO not available, continuing without it: %s", err);
  }

  await app.listen({ port: config.PORT, host: config.HOST });
  app.log.info(`API server running on ${config.HOST}:${config.PORT}`);
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
