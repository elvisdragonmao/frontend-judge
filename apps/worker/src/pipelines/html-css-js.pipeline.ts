import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { MINIO_BUCKETS } from "@judge/shared";
import { downloadFile, uploadFile } from "../minio.js";
import { queryMany } from "../db.js";
import { config } from "../config.js";
import type {
  JudgeContext,
  JudgePipeline,
  JudgeResult,
} from "./base.pipeline.js";
import { normalizePlaywrightTestContent } from "./playwright-test-content.js";

export class HtmlCssJsPipeline implements JudgePipeline {
  private log(submissionId: string, msg: string) {
    console.log(`[pipeline:${submissionId}] ${msg}`);
  }

  async execute(ctx: JudgeContext): Promise<JudgeResult> {
    const { workDir, submissionId, spec } = ctx;
    const siteDir = path.join(workDir, "site");
    const testDir = path.join(workDir, "tests");
    const artifactsDir = path.join(workDir, "artifacts");

    this.log(submissionId, "Creating directories...");
    // Create directories
    fs.mkdirSync(siteDir, { recursive: true });
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(artifactsDir, { recursive: true });
    fs.chmodSync(workDir, 0o777);
    fs.chmodSync(artifactsDir, 0o777);

    // 1. Download submission files
    this.log(submissionId, "Downloading submission files from MinIO...");
    const files = await queryMany<{
      path: string;
      minio_key: string;
    }>(
      "SELECT path, minio_key FROM submission_files WHERE submission_id = $1",
      [submissionId],
    );

    for (const file of files) {
      const dest = path.join(siteDir, file.path);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      await downloadFile(MINIO_BUCKETS.SUBMISSIONS, file.minio_key, dest);
      this.log(submissionId, `  Downloaded: ${file.path}`);
    }

    // 2. Write test file
    if (spec.testContent) {
      fs.writeFileSync(
        path.join(testDir, "judge.spec.ts"),
        normalizePlaywrightTestContent(spec.testContent),
        "utf-8",
      );
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
        "utf-8",
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
      "utf-8",
    );

    // 4. Run in Docker rootless
    this.log(
      submissionId,
      `Running in Docker (timeout: ${spec.timeoutMs}ms)...`,
    );
    this.log(submissionId, `Docker image: ${config.JUDGE_IMAGE}`);
    this.log(submissionId, `Work dir: ${workDir}`);
    const log = await this.runInDocker(workDir, spec.timeoutMs, submissionId);

    // 5. Parse results
    return this.parseResults(workDir, log, artifactsDir);
  }

  private runInDocker(
    workDir: string,
    timeoutMs: number,
    submissionId: string,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = [
        "run",
        "--rm",
        // "--network=none", // TODO: re-enable for security after pre-installing deps in image
        "--memory=512m",
        "--cpus=1",
        `--stop-timeout=${Math.ceil(timeoutMs / 1000)}`,
        "-v",
        `${workDir}:/work`,
        "-w",
        "/work",
        "-e",
        "NODE_PATH=/usr/lib/node_modules",
        config.JUDGE_IMAGE,
        "sh",
        "-c",
        "npx playwright test",
      ];

      console.log(
        `[docker:${submissionId}] Running: ${config.DOCKER_BIN} ${args.join(" ")}`,
      );

      const child = spawn(config.DOCKER_BIN, args, {
        stdio: ["ignore", "pipe", "pipe"],
      });

      console.log(
        `[docker:${submissionId}] Docker process spawned, PID: ${child.pid}`,
      );

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

      child.on("error", (err) => {
        console.error(`[docker:${submissionId}] Process error:`, err);
        clearTimeout(timer);
        reject(err);
      });

      child.on("close", (code) => {
        clearTimeout(timer);

        if (timedOut) {
          reject(
            new Error(
              `[Docker execution]\nJudge timed out after ${Math.ceil(timeoutMs / 1000)}s\n${output}`,
            ),
          );
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

  private parseResults(
    workDir: string,
    log: string,
    artifactsDir: string,
  ): JudgeResult {
    const artifacts: JudgeResult["artifacts"] = [];

    // Collect screenshots
    if (fs.existsSync(artifactsDir)) {
      const entries = fs.readdirSync(artifactsDir, {
        recursive: true,
        withFileTypes: false,
      }) as string[];
      for (const entry of entries) {
        const fullPath = path.join(artifactsDir, entry);
        if (fs.statSync(fullPath).isFile()) {
          const ext = path.extname(entry).toLowerCase();
          const type =
            ext === ".png" || ext === ".jpg"
              ? ("screenshot" as const)
              : ("log" as const);
          artifacts.push({ type, name: entry, localPath: fullPath });
        }
      }
    }

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
              message: passed
                ? undefined
                : spec.tests?.[0]?.results?.[0]?.error?.message,
              score: passed ? 10 : 0,
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
            score: 0,
          },
        ];
        maxScore = 100;
      }
    } else {
      testResults = [
        {
          name: "Overall",
          passed: false,
          message: "No test results found",
          score: 0,
        },
      ];
      maxScore = 100;
    }

    return { score, maxScore, testResults, log, artifacts };
  }
}
