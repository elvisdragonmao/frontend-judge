import { execSync } from "node:child_process";
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

export class HtmlCssJsPipeline implements JudgePipeline {
  async execute(ctx: JudgeContext): Promise<JudgeResult> {
    const { workDir, submissionId, spec } = ctx;
    const siteDir = path.join(workDir, "site");
    const testDir = path.join(workDir, "tests");
    const artifactsDir = path.join(workDir, "artifacts");

    // Create directories
    fs.mkdirSync(siteDir, { recursive: true });
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(artifactsDir, { recursive: true });

    // 1. Download submission files
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
    }

    // 2. Write test file
    if (spec.testContent) {
      fs.writeFileSync(
        path.join(testDir, "judge.spec.ts"),
        spec.testContent,
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
    command: 'npx serve site -l 8080 -s',
    port: 8080,
    reuseExistingServer: false,
  },
  reporter: [['json', { outputFile: 'artifacts/results.json' }]],
});
      `.trim(),
      "utf-8",
    );

    // 4. Run in Docker rootless
    const log = this.runInDocker(workDir, spec.timeoutMs);

    // 5. Parse results
    return this.parseResults(workDir, log, artifactsDir);
  }

  private runInDocker(workDir: string, timeoutMs: number): string {
    try {
      const result = execSync(
        [
          config.DOCKER_BIN,
          "run",
          "--rm",
          "--network=none",
          "--memory=512m",
          "--cpus=1",
          `--stop-timeout=${Math.ceil(timeoutMs / 1000)}`,
          `-v ${workDir}:/work`,
          `-w /work`,
          config.JUDGE_IMAGE,
          "sh",
          "-c",
          '"npx playwright test --reporter=json 2>&1"',
        ].join(" "),
        {
          timeout: timeoutMs + 10_000,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        },
      );
      return result;
    } catch (err: unknown) {
      const error = err as {
        stdout?: string;
        stderr?: string;
        message?: string;
        code?: string;
      };
      if (error.code === "ETIMEDOUT") {
        throw new Error(
          `[Docker execution]\nJudge timed out after ${Math.ceil(timeoutMs / 1000)}s\n${error.stdout ?? ""}\n${error.stderr ?? ""}`,
        );
      }
      return `[Docker execution]\n${error.stdout ?? ""}\n${error.stderr ?? ""}\n${error.message ?? ""}`;
    }
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
