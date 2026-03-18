/**
 * Abstract judge pipeline.
 * Both HTML/CSS/JS and React share the same interface.
 */
export interface JudgeResult {
  score: number;
  maxScore: number;
  testResults: Array<{
    name: string;
    passed: boolean;
    message?: string;
    score: number;
  }>;
  log: string;
  artifacts: Array<{
    type: "screenshot" | "log" | "report";
    name: string;
    localPath: string;
  }>;
}

export interface JudgeContext {
  submissionId: string;
  runId: string;
  workDir: string;
  assignmentType: "html-css-js" | "react";
  spec: {
    startCommand: string;
    testContent: string | null;
    timeoutMs: number;
    allowedPaths: string[];
    blockedPaths: string[];
  };
}

export interface JudgePipeline {
  /**
   * 1. Download submission files from MinIO to workDir
   * 2. Prepare the trusted template
   * 3. Build (for React) or serve (for static)
   * 4. Run Playwright tests in Docker
   * 5. Return results
   */
  execute(ctx: JudgeContext): Promise<JudgeResult>;
}
