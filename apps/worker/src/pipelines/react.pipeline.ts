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
import { normalizePlaywrightTestContent } from "./playwright-test-content.js";
import { stripSharedSubmissionRoot } from "./submission-paths.js";

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
    const reactWebServerCommand =
      "cd project && ls && " +
      "if [ -d dist ]; then " +
      "echo 'Serving from dist' && npx serve -s dist -l 3000; " +
      "elif [ -d build ]; then " +
      "echo 'Serving from build' && npx serve -s build -l 3000; " +
      "else " +
      "echo 'No dist/ or build/ directory found after build' >&2; exit 1; " +
      "fi";

    fs.mkdirSync(projectDir, { recursive: true });
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(artifactsDir, { recursive: true });
    fs.chmodSync(workDir, 0o777);
    fs.chmodSync(artifactsDir, 0o777);

    // 1. Download student files — only allowed paths
    await appendLog("📥 Downloading submission files from MinIO");
    const files = await queryMany<{
      path: string;
      minio_key: string;
    }>(
      "SELECT path, minio_key FROM submission_files WHERE submission_id = $1",
      [submissionId],
    );
    let downloadedCount = 0;

    for (const file of stripSharedSubmissionRoot(files)) {
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
      downloadedCount += 1;
    }

    await appendLog(`📥 Downloaded ${downloadedCount} submission files`);

    // 2. Write test file
    await appendLog("📝 Preparing Playwright tests");
    if (spec.testContent) {
      fs.writeFileSync(
        path.join(testDir, "judge.spec.ts"),
        normalizePlaywrightTestContent(spec.testContent),
        "utf-8",
      );
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
    baseURL: 'http://localhost:3000',
    screenshot: 'on',
  },
  webServer: {
    command: ${JSON.stringify(`bash -lc ${JSON.stringify(reactWebServerCommand)}`)},
    port: 3000,
    reuseExistingServer: false,
    timeout: ${totalTimeoutMs},
    stdout: 'pipe',
    stderr: 'pipe',
  },
  reporter: [['json', { outputFile: 'artifacts/results.json' }]],
});
      `.trim(),
      "utf-8",
    );

    // 4. Install, build, then test in Docker
    await appendLog("🗃️ Installing dependencies with npm");
    const installLog = await this.runDockerCommand(
      workDir,
      totalTimeoutMs,
      submissionId,
      appendLog,
      'bash -lc "mkdir -p /work/artifacts && cd project && set -o pipefail && if [ -f package-lock.json ]; then npm ci; else npm install; fi 2>&1 | tee /work/artifacts/react-install.log"',
    );
    await appendLog("✅ Dependencies installed");

    await appendLog("🏗️ Building project with npm run build");
    const buildLog = await this.runDockerCommand(
      workDir,
      totalTimeoutMs,
      submissionId,
      appendLog,
      'bash -lc "mkdir -p /work/artifacts && cd project && set -o pipefail && npm run build 2>&1 | tee /work/artifacts/react-build.log"',
    );
    await appendLog("✅ Project build finished");

    await appendLog("🧪 Starting preview server and Playwright tests");
    const testLog = await this.runDockerCommand(
      workDir,
      totalTimeoutMs,
      submissionId,
      appendLog,
      "npx playwright test",
    );

    const log = [
      "[Install]",
      installLog.trim(),
      "",
      "[Build]",
      buildLog.trim(),
      "",
      "[Test]",
      testLog.trim(),
    ]
      .filter(Boolean)
      .join("\n");

    // 5. Parse results (same as HTML/CSS/JS)
    return this.parseResults(workDir, log, artifactsDir, true);
  }

  private runDockerCommand(
    workDir: string,
    timeoutMs: number,
    submissionId: string,
    appendLog: (message: string) => Promise<void>,
    command: string,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const args = [
        "run",
        "--rm",
        "--network=host",
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
        command,
      ];

      const child = spawn(config.DOCKER_BIN, args, {
        stdio: ["ignore", "pipe", "pipe"],
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

      child.on("error", (err) => {
        if (flushTimer) {
          clearTimeout(flushTimer);
        }
        clearTimeout(timer);
        flushBufferedLog(true).finally(() => reject(err));
      });

      child.on("close", async (code) => {
        if (flushTimer) {
          clearTimeout(flushTimer);
        }
        clearTimeout(timer);
        await flushBufferedLog(true);
        await flushPromise;

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
    logAlreadyStreamed = false,
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

        if (testResults.length === 0) {
          const errorMessages = (raw.errors ?? [])
            .map(
              (error: { message?: string; stack?: string }) =>
                error.message ?? error.stack,
            )
            .filter(Boolean);

          if (errorMessages.length > 0) {
            testResults = [
              {
                name: "Overall",
                passed: false,
                message: errorMessages.join("\n\n"),
                score: 0,
              },
            ];
            maxScore = 100;
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

    return { score, maxScore, testResults, log, artifacts, logAlreadyStreamed };
  }
}
