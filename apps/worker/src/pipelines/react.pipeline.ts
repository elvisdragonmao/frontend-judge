import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  isSubmissionPathAllowed,
  MINIO_BUCKETS,
  normalizeSubmissionPath,
} from "@judge/shared";
import { downloadFile } from "../minio.js";
import { queryMany } from "../db.js";
import { config } from "../config.js";
import type {
  JudgeContext,
  JudgePipeline,
  JudgeResult,
} from "./base.pipeline.js";

/**
 * React pipeline:
 * 1. Use a trusted React template (provided by the platform)
 * 2. Student only overwrites src/ and public/ (filtered by allowedPaths / blockedPaths)
 * 3. Platform runs `npm install && npm run build`
 * 4. Serve the build output
 * 5. Run Playwright tests
 */
export class ReactPipeline implements JudgePipeline {
  async execute(ctx: JudgeContext): Promise<JudgeResult> {
    const { workDir, submissionId, spec } = ctx;
    const projectDir = path.join(workDir, "project");
    const testDir = path.join(workDir, "tests");
    const artifactsDir = path.join(workDir, "artifacts");

    fs.mkdirSync(projectDir, { recursive: true });
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(artifactsDir, { recursive: true });
    fs.chmodSync(workDir, 0o777);
    fs.chmodSync(artifactsDir, 0o777);

    // 1. Copy trusted React template into projectDir
    // The template should be pre-built into the judge Docker image at /templates/react
    // For now, we assume it exists there.

    // 2. Download student files — only allowed paths
    const files = await queryMany<{
      path: string;
      minio_key: string;
    }>(
      "SELECT path, minio_key FROM submission_files WHERE submission_id = $1",
      [submissionId],
    );

    for (const file of files) {
      const normalizedPath = normalizeSubmissionPath(file.path);
      if (!normalizedPath) {
        continue;
      }

      if (
        !isSubmissionPathAllowed(
          normalizedPath,
          spec.allowedPaths,
          spec.blockedPaths,
        )
      ) {
        continue;
      }

      const dest = path.join(projectDir, normalizedPath);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      await downloadFile(MINIO_BUCKETS.SUBMISSIONS, file.minio_key, dest);
    }

    // 3. Write test file
    if (spec.testContent) {
      fs.writeFileSync(
        path.join(testDir, "judge.spec.ts"),
        spec.testContent,
        "utf-8",
      );
    }

    // 4. Write playwright config
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
    baseURL: 'http://localhost:3000',
    screenshot: 'on',
  },
  webServer: {
    command: 'cd project && npm install && npm run build && npx serve -s build -l 3000',
    port: 3000,
    reuseExistingServer: false,
    timeout: ${totalTimeoutMs},
  },
  reporter: [['json', { outputFile: 'artifacts/results.json' }]],
});
      `.trim(),
      "utf-8",
    );

    // 5. Run in Docker
    const log = await this.runInDocker(workDir, totalTimeoutMs, submissionId);

    // 6. Parse results (same as HTML/CSS/JS)
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
        "--network=host", // React needs npm install, so network is needed for build phase
        "--memory=1g",
        "--cpus=2",
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
        "npx playwright test --reporter=json",
      ];

      const child = spawn(config.DOCKER_BIN, args, {
        stdio: ["ignore", "pipe", "pipe"],
      });

      let timedOut = false;
      let output = "";

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, timeoutMs + 30_000);

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
              message: passed
                ? undefined
                : spec.tests?.[0]?.results?.[0]?.error?.message,
              score: passed ? 10 : 0,
            });
          }
        }
      } catch {
        testResults = [
          { name: "Overall", passed: false, message: "Parse error", score: 0 },
        ];
        maxScore = 100;
      }
    } else {
      testResults = [
        { name: "Overall", passed: false, message: "No results", score: 0 },
      ];
      maxScore = 100;
    }

    return { score, maxScore, testResults, log, artifacts };
  }
}
