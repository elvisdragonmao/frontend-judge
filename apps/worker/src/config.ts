import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .default("postgresql://postgres:postgres@localhost:5432/judge"),

  MINIO_ENDPOINT: z.string().default("localhost"),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_ACCESS_KEY: z.string().default("minioadmin"),
  MINIO_SECRET_KEY: z.string().default("minioadmin"),
  MINIO_USE_SSL: z
    .string()
    .transform((v) => v === "true")
    .default("false"),

  WORKER_ID: z.string().default(`worker-${process.pid}`),
  POLL_INTERVAL_MS: z.coerce.number().default(3000),
  WORK_DIR: z.string().default("/tmp/judge-work"),

  /** Path to Docker binary (rootless) */
  DOCKER_BIN: z.string().default("docker"),
  /** Docker image used for judge containers */
  JUDGE_IMAGE: z.string().default("judge-runner:latest"),
});

export const config = EnvSchema.parse(process.env);
