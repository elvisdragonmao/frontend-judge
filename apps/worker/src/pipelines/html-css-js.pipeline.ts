import { isSubmissionPathAllowed, MINIO_BUCKETS, normalizeSubmissionPath } from "@judge/shared";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { queryMany } from "../db.js";
import { downloadFile } from "../minio.js";
import { collectArtifacts } from "./artifacts.js";
import type { JudgeContext, JudgePipeline, JudgeResult } from "./base.pipeline.js";
import { normalizePlaywrightTestContent } from "./playwright-test-content.js";
import { stripSharedSubmissionRoot } from "./submission-paths.js";

export class HtmlCssJsPipeline implements JudgePipeline {
	private log(submissionId: string, msg: string) {
		console.log(`[pipeline:${submissionId}] ${msg}`);
	}

	async execute(ctx: JudgeContext): Promise<JudgeResult> {
		const { workDir, submissionId, spec, appendLog } = ctx;
		const siteDir = path.join(workDir, "site");
		const testDir = path.join(workDir, "tests");
		const artifactsDir = path.join(workDir, "artifacts");
		const jobCacheDir = path.join(workDir, ".cache");
		const homeDir = path.join(jobCacheDir, "home");
		const xdgCacheDir = path.join(jobCacheDir, "xdg-cache");
		const npmCacheDir = path.join(jobCacheDir, "npm-cache");
		const tempDir = path.join(jobCacheDir, "tmp");
		const containerCacheRoot = "/work/.cache";

		this.log(submissionId, "Creating directories...");
		// Create directories
		fs.mkdirSync(siteDir, { recursive: true });
		fs.mkdirSync(testDir, { recursive: true });
		fs.mkdirSync(artifactsDir, { recursive: true });
		fs.mkdirSync(homeDir, { recursive: true });
		fs.mkdirSync(xdgCacheDir, { recursive: true });
		fs.mkdirSync(npmCacheDir, { recursive: true });
		fs.mkdirSync(tempDir, { recursive: true });
		fs.chmodSync(workDir, 0o755);
		fs.chmodSync(siteDir, 0o755);
		fs.chmodSync(testDir, 0o755);
		fs.chmodSync(artifactsDir, 0o755);
		fs.chmodSync(jobCacheDir, 0o755);
		fs.chmodSync(homeDir, 0o755);
		fs.chmodSync(xdgCacheDir, 0o755);
		fs.chmodSync(npmCacheDir, 0o755);
		fs.chmodSync(tempDir, 0o755);

		// 1. Download submission files
		await appendLog("Downloading submission files from MinIO");
		this.log(submissionId, "Downloading submission files from MinIO...");
		const files = await queryMany<{
			path: string;
			minio_key: string;
		}>("SELECT path, minio_key FROM submission_files WHERE submission_id = $1", [submissionId]);
		let downloadedCount = 0;

		for (const file of stripSharedSubmissionRoot(files)) {
			const normalizedPath = normalizeSubmissionPath(file.path);
			if (!normalizedPath || !isSubmissionPathAllowed(normalizedPath, spec.allowedPaths, spec.blockedPaths)) {
				continue;
			}

			const dest = path.join(siteDir, normalizedPath);
			fs.mkdirSync(path.dirname(dest), { recursive: true });
			await downloadFile(MINIO_BUCKETS.SUBMISSIONS, file.minio_key, dest);
			downloadedCount += 1;
			this.log(submissionId, `  Downloaded: ${normalizedPath}`);
		}

		await appendLog(`Downloaded ${downloadedCount} submission files`);

		// 2. Write test file
		await appendLog("Preparing Playwright tests");
		if (spec.testContent) {
			fs.writeFileSync(path.join(testDir, "judge.spec.ts"), normalizePlaywrightTestContent(spec.testContent), "utf-8");
		} else {
			// Default test: just take a screenshot and check index.html exists
			fs.writeFileSync(
				path.join(testDir, "judge.spec.ts"),
				`
import { test, expect } from '@playwright/test';

test('page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toBeVisible();
  await page.screenshot({ path: 'artifacts/screenshot.png', fullPage: true });
});
        `.trim(),
				"utf-8"
			);
		}

		// 3. Write playwright config
		fs.writeFileSync(
			path.join(workDir, "playwright.config.ts"),
			`
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  outputDir: './artifacts',
  timeout: ${spec.timeoutMs},
  use: {
    baseURL: 'http://localhost:8080',
    screenshot: 'on',
  },
  webServer: {
    command: 'serve site -l 8080 -s',
    port: 8080,
    reuseExistingServer: false,
  },
  reporter: [['json', { outputFile: 'artifacts/results.json' }]],
});
      `.trim(),
			"utf-8"
		);

		// 4. Run in Docker rootless
		await appendLog("Starting Docker judge environment");
		this.log(submissionId, `Running in Docker (timeout: ${spec.timeoutMs}ms)...`);
		this.log(submissionId, `Docker image: ${config.JUDGE_IMAGE}`);
		this.log(submissionId, `Work dir: ${workDir}`);
		const log = await this.runInDocker(workDir, spec.timeoutMs, submissionId);

		// 5. Parse results
		return this.parseResults(workDir, log, artifactsDir);
	}

	private runInDocker(workDir: string, timeoutMs: number, submissionId: string): Promise<string> {
		return new Promise((resolve, reject) => {
			const containerCacheRoot = "/work/.cache";
			const containerUser = typeof process.getuid === "function" && typeof process.getgid === "function" ? `${process.getuid()}:${process.getgid()}` : null;
			const args = [
				"run",
				"--rm",
				"--network=bridge",
				"--memory=512m",
				"--cpus=1",
				"--pids-limit=256",
				"--cap-drop=ALL",
				"--security-opt=no-new-privileges",
				"--read-only",
				`--stop-timeout=${Math.ceil(timeoutMs / 1000)}`,
				"-v",
				`${workDir}:/work`,
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
				...(containerUser ? ["--user", containerUser] : []),
				config.JUDGE_IMAGE,
				"sh",
				"-c",
				`mkdir -p ${containerCacheRoot}/home ${containerCacheRoot}/xdg-cache ${containerCacheRoot}/npm-cache ${containerCacheRoot}/tmp && npx playwright test`
			];

			console.log(`[docker:${submissionId}] Running: ${config.DOCKER_BIN} ${args.join(" ")}`);

			const child = spawn(config.DOCKER_BIN, args, {
				stdio: ["ignore", "pipe", "pipe"]
			});

			console.log(`[docker:${submissionId}] Docker process spawned, PID: ${child.pid}`);

			let timedOut = false;
			let output = "";

			const timer = setTimeout(() => {
				timedOut = true;
				child.kill("SIGKILL");
			}, timeoutMs + 10_000);

			child.stdout.on("data", (chunk: Buffer) => {
				const text = chunk.toString();
				output += text;
				process.stdout.write(`[judge:${submissionId}] ${text}`);
			});

			child.stderr.on("data", (chunk: Buffer) => {
				const text = chunk.toString();
				output += text;
				process.stderr.write(`[judge:${submissionId}] ${text}`);
			});

			child.on("error", err => {
				console.error(`[docker:${submissionId}] Process error:`, err);
				clearTimeout(timer);
				reject(err);
			});

			child.on("close", code => {
				clearTimeout(timer);

				if (timedOut) {
					reject(new Error(`[Docker execution]\nJudge timed out after ${Math.ceil(timeoutMs / 1000)}s\n${output}`));
					return;
				}

				if (code !== 0) {
					resolve(`[Docker execution]\n${output}`);
					return;
				}

				resolve(output);
			});
		});
	}

	private parseResults(workDir: string, log: string, artifactsDir: string): JudgeResult {
		const artifacts = collectArtifacts(artifactsDir);

		// Try to parse JSON results
		const resultsPath = path.join(artifactsDir, "results.json");
		console.log(`[parseResults] Looking for results at: ${resultsPath}`);
		console.log(`[parseResults] Exists: ${fs.existsSync(resultsPath)}`);
		let testResults: JudgeResult["testResults"] = [];
		let score = 0;
		let maxScore = 0;

		if (fs.existsSync(resultsPath)) {
			try {
				const raw = JSON.parse(fs.readFileSync(resultsPath, "utf-8"));
				const suites = raw.suites ?? [];
				for (const suite of suites) {
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
			} catch {
				// If parsing fails, treat as single pass/fail
				testResults = [
					{
						name: "Overall",
						passed: false,
						message: "Failed to parse test results",
						score: 0
					}
				];
				maxScore = 100;
			}
		} else {
			testResults = [
				{
					name: "Overall",
					passed: false,
					message: "No test results found",
					score: 0
				}
			];
			maxScore = 100;
		}

		return { score, maxScore, testResults, log, artifacts };
	}
}
