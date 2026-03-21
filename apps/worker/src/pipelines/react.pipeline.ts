import { isSubmissionPathAllowed, MINIO_BUCKETS, normalizeSubmissionPath } from "@judge/shared";
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { config } from "../config.js";
import { queryMany } from "../db.js";
import { downloadFile } from "../minio.js";
import { collectArtifacts } from "./artifacts.js";
import type { JudgeContext, JudgePipeline, JudgeResult } from "./base.pipeline.js";
import { normalizePlaywrightTestContent } from "./playwright-test-content.js";
import { prepareSharedPnpmStore } from "./pnpm-store.js";
import { stripSharedSubmissionRoot } from "./submission-paths.js";

interface DockerMount {
	source: string;
	target: string;
	readonly?: boolean;
}

const SHARED_PNPM_STORE_MOUNT_PATH = "/pnpm/store-seed";

/**
 * React pipeline:
 * 1. Download student files into the judge workspace
 * 2. Filter files by allowedPaths / blockedPaths
 * 3. Run dependency install and build
 * 4. Serve the build output
 * 5. Run Playwright tests
 */
export class ReactPipeline implements JudgePipeline {
	async execute(ctx: JudgeContext): Promise<JudgeResult> {
		const { workDir, submissionId, spec, appendLog } = ctx;
		const projectDir = path.join(workDir, "project");
		const testDir = path.join(workDir, "tests");
		const artifactsDir = path.join(workDir, "artifacts");
		const jobCacheDir = path.join(workDir, ".cache");
		const homeDir = path.join(jobCacheDir, "home");
		const xdgCacheDir = path.join(jobCacheDir, "xdg-cache");
		const npmCacheDir = path.join(jobCacheDir, "npm-cache");
		const tempDir = path.join(jobCacheDir, "tmp");
		const prewarmDir = path.join(workDir, ".pnpm-prewarm");
		const privatePnpmStoreDir = path.join(workDir, ".pnpm-store");
		const containerCacheRoot = "/work/.cache";
		const privatePnpmStoreMountPath = config.JUDGE_PNPM_STORE_MOUNT_PATH;
		const blockedPaths = spec.blockedPaths.filter(pattern => pattern !== "package.json");
		const webServerPort = await this.findAvailablePort();
		const reactWebServerCommand =
			"cd project && ls && " +
			"if [ -d dist ]; then " +
			`echo 'Serving from dist on ${webServerPort}' && npx serve -s dist -l ${webServerPort}; ` +
			"elif [ -d build ]; then " +
			`echo 'Serving from build on ${webServerPort}' && npx serve -s build -l ${webServerPort}; ` +
			"else " +
			"echo 'No dist/ or build/ directory found after build' >&2; exit 1; " +
			"fi";

		fs.mkdirSync(projectDir, { recursive: true });
		fs.mkdirSync(testDir, { recursive: true });
		fs.mkdirSync(artifactsDir, { recursive: true });
		fs.mkdirSync(homeDir, { recursive: true });
		fs.mkdirSync(xdgCacheDir, { recursive: true });
		fs.mkdirSync(npmCacheDir, { recursive: true });
		fs.mkdirSync(tempDir, { recursive: true });
		fs.mkdirSync(prewarmDir, { recursive: true });
		fs.mkdirSync(privatePnpmStoreDir, { recursive: true });
		fs.chmodSync(workDir, 0o755);
		fs.chmodSync(projectDir, 0o755);
		fs.chmodSync(testDir, 0o755);
		fs.chmodSync(artifactsDir, 0o755);
		fs.chmodSync(jobCacheDir, 0o755);
		fs.chmodSync(homeDir, 0o755);
		fs.chmodSync(xdgCacheDir, 0o755);
		fs.chmodSync(npmCacheDir, 0o755);
		fs.chmodSync(tempDir, 0o755);
		fs.chmodSync(prewarmDir, 0o755);
		fs.chmodSync(privatePnpmStoreDir, 0o755);

		// 1. Download student files — only allowed paths
		await appendLog("📥 Downloading submission files from MinIO");
		const files = await queryMany<{
			path: string;
			minio_key: string;
		}>("SELECT path, minio_key FROM submission_files WHERE submission_id = $1", [submissionId]);
		let downloadedCount = 0;

		for (const file of stripSharedSubmissionRoot(files)) {
			const normalizedPath = normalizeSubmissionPath(file.path);
			if (!normalizedPath) {
				continue;
			}

			if (!isSubmissionPathAllowed(normalizedPath, spec.allowedPaths, blockedPaths)) {
				continue;
			}

			const dest = path.join(projectDir, normalizedPath);
			fs.mkdirSync(path.dirname(dest), { recursive: true });
			await downloadFile(MINIO_BUCKETS.SUBMISSIONS, file.minio_key, dest);
			downloadedCount += 1;
		}

		await appendLog(`📥 Downloaded ${downloadedCount} submission files`);

		// 2. Write test file
		await appendLog("📝 Preparing Playwright tests");
		if (spec.testContent) {
			fs.writeFileSync(path.join(testDir, "judge.spec.ts"), normalizePlaywrightTestContent(spec.testContent), "utf-8");
		}

		// 3. Write playwright config
		const totalTimeoutMs = spec.timeoutMs + 120_000;

		fs.writeFileSync(
			path.join(workDir, "playwright.config.ts"),
			`
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  outputDir: './artifacts',
  timeout: ${spec.timeoutMs},
  use: {
    baseURL: 'http://127.0.0.1:${webServerPort}',
    screenshot: 'on',
  },
  webServer: {
    command: ${JSON.stringify(`bash -lc ${JSON.stringify(reactWebServerCommand)}`)},
    port: ${webServerPort},
    reuseExistingServer: false,
    timeout: ${totalTimeoutMs},
    stdout: 'pipe',
    stderr: 'pipe',
  },
  reporter: [['json', { outputFile: 'artifacts/results.json' }]],
});
      `.trim(),
			"utf-8"
		);

		// 4. Install, build, then test in Docker
		const pnpmStoreState = prepareSharedPnpmStore(config.JUDGE_PNPM_STORE_DIR, config.JUDGE_PNPM_STORE_CLEANUP_HOUR_TW);
		await appendLog(
			pnpmStoreState.cleaned
				? `🧹 Cleared shared pnpm store for TW ${pnpmStoreState.cleanupKey} ${String(config.JUDGE_PNPM_STORE_CLEANUP_HOUR_TW).padStart(2, "0")}:00 window`
				: `📦 Reusing shared pnpm store (${config.JUDGE_PNPM_STORE_DIR})`
		);
		await this.prewarmSharedPnpmStore(projectDir, prewarmDir, totalTimeoutMs, submissionId, appendLog);

		await appendLog("🗃️ Installing dependencies with pnpm");
		const installLog = await this.runDockerCommand(
			[
				{ source: workDir, target: "/work" },
				{ source: privatePnpmStoreDir, target: privatePnpmStoreMountPath },
				{ source: config.JUDGE_PNPM_STORE_DIR, target: SHARED_PNPM_STORE_MOUNT_PATH, readonly: true }
			],
			totalTimeoutMs,
			submissionId,
			appendLog,
			`bash -lc ${JSON.stringify(`mkdir -p ${containerCacheRoot}/home ${containerCacheRoot}/xdg-cache ${containerCacheRoot}/npm-cache ${containerCacheRoot}/tmp /work/artifacts ${privatePnpmStoreMountPath} && if [ -d ${SHARED_PNPM_STORE_MOUNT_PATH} ]; then cp -a ${SHARED_PNPM_STORE_MOUNT_PATH}/. ${privatePnpmStoreMountPath}/ 2>/dev/null || true; fi && cd project && set -o pipefail && pnpm config set store-dir ${privatePnpmStoreMountPath} >/dev/null && if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; else pnpm install --no-frozen-lockfile; fi 2>&1 | tee /work/artifacts/react-install.log`)}`,
			{ rejectOnNonZero: true, networkMode: "bridge" }
		);
		await appendLog("✅ Dependencies installed");

		await appendLog("🏗️ Building project with pnpm run build");
		const buildLog = await this.runDockerCommand(
			[
				{ source: workDir, target: "/work" },
				{ source: privatePnpmStoreDir, target: privatePnpmStoreMountPath }
			],
			totalTimeoutMs,
			submissionId,
			appendLog,
			'bash -lc "mkdir -p /work/artifacts && cd project && set -o pipefail && pnpm run build 2>&1 | tee /work/artifacts/react-build.log"',
			{ rejectOnNonZero: true, networkMode: "none" }
		);
		await appendLog("✅ Project build finished");

		await appendLog("🧪 Starting preview server and Playwright tests");
		const testLog = await this.runDockerCommand(
			[
				{ source: workDir, target: "/work" },
				{ source: privatePnpmStoreDir, target: privatePnpmStoreMountPath }
			],
			totalTimeoutMs,
			submissionId,
			appendLog,
			"npx playwright test",
			{ networkMode: "bridge" }
		);

		const log = ["[Install]", installLog.trim(), "", "[Build]", buildLog.trim(), "", "[Test]", testLog.trim()].filter(Boolean).join("\n");

		// 5. Parse results (same as HTML/CSS/JS)
		return this.parseResults(workDir, log, artifactsDir, true);
	}

	private async prewarmSharedPnpmStore(projectDir: string, prewarmDir: string, timeoutMs: number, submissionId: string, appendLog: (message: string) => Promise<void>) {
		const containerCacheRoot = "/work/.cache";
		const packageJsonPath = path.join(projectDir, "package.json");
		const pnpmLockPath = path.join(projectDir, "pnpm-lock.yaml");

		if (!fs.existsSync(packageJsonPath)) {
			await appendLog("⏭️ Skipped shared pnpm cache prewarm (no package.json)");
			return;
		}

		if (!fs.existsSync(pnpmLockPath)) {
			await appendLog("⏭️ Skipped shared pnpm cache prewarm (no pnpm-lock.yaml)");
			return;
		}

		fs.rmSync(prewarmDir, { recursive: true, force: true });
		fs.mkdirSync(prewarmDir, { recursive: true });
		fs.copyFileSync(packageJsonPath, path.join(prewarmDir, "package.json"));
		fs.copyFileSync(pnpmLockPath, path.join(prewarmDir, "pnpm-lock.yaml"));

		await appendLog("🔥 Prewarming shared pnpm cache from lockfile");
		await this.runDockerCommand(
			[
				{ source: prewarmDir, target: "/prewarm" },
				{ source: config.JUDGE_PNPM_STORE_DIR, target: SHARED_PNPM_STORE_MOUNT_PATH }
			],
			timeoutMs,
			submissionId,
			appendLog,
			`bash -lc ${JSON.stringify(`mkdir -p ${containerCacheRoot}/home ${containerCacheRoot}/xdg-cache ${containerCacheRoot}/npm-cache ${containerCacheRoot}/tmp && cd /prewarm && pnpm config set store-dir ${SHARED_PNPM_STORE_MOUNT_PATH} >/dev/null && pnpm fetch --frozen-lockfile --ignore-scripts 2>&1`)}`,
			{ rejectOnNonZero: true, networkMode: "bridge" }
		);
		await appendLog("✅ Shared pnpm cache prewarmed");
	}

	private runDockerCommand(
		mounts: DockerMount[],
		timeoutMs: number,
		submissionId: string,
		appendLog: (message: string) => Promise<void>,
		command: string,
		options: { rejectOnNonZero?: boolean; networkMode?: string } = {}
	): Promise<string> {
		return new Promise((resolve, reject) => {
			const containerCacheRoot = "/work/.cache";
			const containerUser = typeof process.getuid === "function" && typeof process.getgid === "function" ? `${process.getuid()}:${process.getgid()}` : null;
			const args = [
				"run",
				"--rm",
				`--network=${options.networkMode ?? "bridge"}`,
				"--memory=1g",
				"--cpus=2",
				"--pids-limit=256",
				"--cap-drop=ALL",
				"--security-opt=no-new-privileges",
				"--read-only",
				`--stop-timeout=${Math.ceil(timeoutMs / 1000)}`,
				"-w",
				"/work",
				"-e",
				`HOME=${containerCacheRoot}/home`,
				"-e",
				`XDG_CACHE_HOME=${containerCacheRoot}/xdg-cache`,
				"-e",
				`npm_config_cache=${containerCacheRoot}/npm-cache`,
				"-e",
				`TMPDIR=${containerCacheRoot}/tmp`,
				"-e",
				`TMP=${containerCacheRoot}/tmp`,
				"-e",
				`TEMP=${containerCacheRoot}/tmp`,
				"-e",
				"NODE_PATH=/usr/lib/node_modules",
				"-e",
				`PNPM_STORE_DIR=${config.JUDGE_PNPM_STORE_MOUNT_PATH}`,
				...(containerUser ? ["--user", containerUser] : []),
				...mounts.flatMap(mount => ["-v", `${mount.source}:${mount.target}${mount.readonly ? ":ro" : ""}`]),
				config.JUDGE_IMAGE,
				"sh",
				"-c",
				command
			];

			const child = spawn(config.DOCKER_BIN, args, {
				stdio: ["ignore", "pipe", "pipe"]
			});

			let timedOut = false;
			let output = "";
			let logBuffer = "";
			let flushPromise = Promise.resolve();
			let flushTimer: NodeJS.Timeout | null = null;

			const flushBufferedLog = (force = false) => {
				if (!force && logBuffer.length < 400) {
					return flushPromise;
				}

				if (!logBuffer) {
					return flushPromise;
				}

				const chunk = logBuffer;
				logBuffer = "";
				flushPromise = flushPromise.then(() => appendLog(chunk.trimEnd()));
				return flushPromise;
			};

			const queueLogChunk = (text: string) => {
				logBuffer += text;

				if (!flushTimer) {
					flushTimer = setTimeout(() => {
						flushTimer = null;
						void flushBufferedLog(true);
					}, 1000);
				}

				void flushBufferedLog(false);
			};

			const timer = setTimeout(() => {
				timedOut = true;
				child.kill("SIGKILL");
			}, timeoutMs + 30_000);

			child.stdout.on("data", (chunk: Buffer) => {
				const text = chunk.toString();
				output += text;
				process.stdout.write(`[judge:${submissionId}] ${text}`);
				queueLogChunk(text);
			});

			child.stderr.on("data", (chunk: Buffer) => {
				const text = chunk.toString();
				output += text;
				process.stderr.write(`[judge:${submissionId}] ${text}`);
				queueLogChunk(text);
			});

			child.on("error", err => {
				if (flushTimer) {
					clearTimeout(flushTimer);
				}
				clearTimeout(timer);
				flushBufferedLog(true).finally(() => reject(err));
			});

			child.on("close", async code => {
				if (flushTimer) {
					clearTimeout(flushTimer);
				}
				clearTimeout(timer);
				await flushBufferedLog(true);
				await flushPromise;

				if (timedOut) {
					reject(new Error(`[Docker execution]\nJudge timed out after ${Math.ceil(timeoutMs / 1000)}s\n${output}`));
					return;
				}

				if (code !== 0) {
					if (options.rejectOnNonZero) {
						reject(new Error(`[Docker execution]\n${output}`));
						return;
					}

					resolve(`[Docker execution]\n${output}`);
					return;
				}

				resolve(output);
			});
		});
	}

	private findAvailablePort(): Promise<number> {
		return new Promise((resolve, reject) => {
			const server = net.createServer();

			server.unref();
			server.on("error", reject);
			server.listen(0, "127.0.0.1", () => {
				const address = server.address();
				if (!address || typeof address === "string") {
					server.close(() => reject(new Error("Failed to allocate port")));
					return;
				}

				const { port } = address;
				server.close(err => {
					if (err) {
						reject(err);
						return;
					}
					resolve(port);
				});
			});
		});
	}

	private parseResults(workDir: string, log: string, artifactsDir: string, logAlreadyStreamed = false): JudgeResult {
		const artifacts = collectArtifacts(artifactsDir);

		const resultsPath = path.join(artifactsDir, "results.json");
		let testResults: JudgeResult["testResults"] = [];
		let score = 0;
		let maxScore = 0;

		if (fs.existsSync(resultsPath)) {
			try {
				const raw = JSON.parse(fs.readFileSync(resultsPath, "utf-8"));
				for (const suite of raw.suites ?? []) {
					for (const spec of suite.specs ?? []) {
						maxScore += 10;
						const passed = spec.ok === true;
						if (passed) score += 10;
						testResults.push({
							name: spec.title ?? "unknown",
							passed,
							message: passed ? undefined : spec.tests?.[0]?.results?.[0]?.error?.message,
							score: passed ? 10 : 0
						});
					}
				}

				if (testResults.length === 0) {
					const errorMessages = (raw.errors ?? []).map((error: { message?: string; stack?: string }) => error.message ?? error.stack).filter(Boolean);

					if (errorMessages.length > 0) {
						testResults = [
							{
								name: "Overall",
								passed: false,
								message: errorMessages.join("\n\n"),
								score: 0
							}
						];
						maxScore = 100;
					}
				}
			} catch {
				testResults = [{ name: "Overall", passed: false, message: "Parse error", score: 0 }];
				maxScore = 100;
			}
		} else {
			testResults = [{ name: "Overall", passed: false, message: "No results", score: 0 }];
			maxScore = 100;
		}

		return { score, maxScore, testResults, log, artifacts, logAlreadyStreamed };
	}
}
