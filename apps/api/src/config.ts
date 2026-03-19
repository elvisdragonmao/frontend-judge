import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default("0.0.0.0"),

  DATABASE_URL: z
    .string()
    .default("postgresql://postgres:postgres@localhost:5432/judge"),

  JWT_SECRET: z.string().default("dev-secret-change-in-production"),
  JWT_EXPIRES_IN: z.string().default("7d"),

  MINIO_ENDPOINT: z.string().default("localhost"),
  MINIO_PORT: z.preprocess((v) => v || "9000", z.coerce.number()).default(9000),
  MINIO_ACCESS_KEY: z.string().default("minioadmin"),
  MINIO_SECRET_KEY: z.string().default("minioadmin"),
  MINIO_USE_SSL: z
    .string()
    .transform((v) => v === "true")
    .default("false"),

  CORS_ORIGIN: z.string().default("http://localhost:5173"),

  DEFAULT_ADMIN_PASSWORD: z.string().default("admin123"),
});

export const config = EnvSchema.parse(process.env);
export type Config = typeof config;
