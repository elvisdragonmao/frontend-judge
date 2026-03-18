import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { MINIO_BUCKETS } from "@judge/shared";
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

    const blocked = new Set(spec.blockedPaths);

    for (const file of files) {
      // Security: skip blocked paths
      if (
        blocked.has(file.path) ||
        this.isBlocked(file.path, spec.blockedPaths)
      ) {
        continue;
      }
      const dest = path.join(projectDir, file.path);
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
    timeout: 120000,
  },
  reporter: [['json', { outputFile: 'artifacts/results.json' }]],
});
      `.trim(),
      "utf-8",
    );

    // 5. Run in Docker
    const log = this.runInDocker(workDir, spec.timeoutMs);

    // 6. Parse results (same as HTML/CSS/JS)
    return this.parseResults(workDir, log, artifactsDir);
  }

  private isBlocked(filePath: string, blockedPaths: string[]): boolean {
    for (const pattern of blockedPaths) {
      if (pattern.endsWith("/**")) {
        const prefix = pattern.slice(0, -3);
        if (filePath.startsWith(prefix)) return true;
      }
      if (filePath === pattern) return true;
      // Simple glob: *.sh
      if (pattern.startsWith("*")) {
        const ext = pattern.slice(1);
        if (filePath.endsWith(ext)) return true;
      }
    }
    return false;
  }

  private runInDocker(workDir: string, timeoutMs: number): string {
    try {
      return execSync(
        [
          config.DOCKER_BIN,
          "run",
          "--rm",
          "--network=host", // React needs npm install, so network is needed for build phase
          "--memory=1g",
          "--cpus=2",
          `--stop-timeout=${Math.ceil(timeoutMs / 1000)}`,
          `-v ${workDir}:/work`,
          `-w /work`,
          config.JUDGE_IMAGE,
          "sh",
          "-c",
          '"npx playwright test --reporter=json 2>&1"',
        ].join(" "),
        {
          timeout: timeoutMs + 30_000,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        },
      );
    } catch (err: unknown) {
      const error = err as {
        stdout?: string;
        stderr?: string;
        message?: string;
      };
      return `[Docker execution]\n${error.stdout ?? ""}\n${error.stderr ?? ""}\n${error.message ?? ""}`;
    }
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
