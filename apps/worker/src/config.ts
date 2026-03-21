import path from "node:path";
import { z } from "zod";

const EnvSchema = z.object({
	DATABASE_URL: z.string().default("postgresql://postgres:postgres@localhost:5432/judge"),

	MINIO_ENDPOINT: z.string().default("localhost"),
	MINIO_PORT: z.coerce.number().default(9000),
	MINIO_ACCESS_KEY: z.string().default("minioadmin"),
	MINIO_SECRET_KEY: z.string().default("minioadmin"),
	MINIO_USE_SSL: z
		.string()
		.transform(v => v === "true")
		.default("false"),

	WORKER_ID: z.string().default(`worker-${process.pid}`),
	POLL_INTERVAL_MS: z.coerce.number().default(3000),
	CACHE_ROOT_DIR: z
		.string()
		.default(".cache")
		.transform(value => path.resolve(value)),
	JUDGE_PNPM_STORE_MOUNT_PATH: z.string().default("/pnpm/store"),
	JUDGE_PNPM_STORE_CLEANUP_HOUR_TW: z.coerce.number().min(0).max(23).default(5),

	/** Path to Docker binary (rootless) */
	DOCKER_BIN: z.string().default("docker"),
	/** Docker image used for judge containers */
	JUDGE_IMAGE: z.string().default("judge-runner:latest")
});

const env = EnvSchema.parse(process.env);

export const config = {
	...env,
	WORK_DIR: path.join(env.CACHE_ROOT_DIR, "judge-work"),
	JUDGE_PNPM_STORE_DIR: path.join(env.CACHE_ROOT_DIR, "judge-pnpm-store")
};
