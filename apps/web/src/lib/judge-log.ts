import { i18n } from "@/i18n";

export interface JudgeStage {
  id: string;
  label: string;
  state: "pending" | "done" | "current";
}

const ANSI_PATTERN = /\u001b\[[0-?]*[ -/]*[@-~]/g;
const OSC_PATTERN = /\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g;
const VISIBLE_ESCAPE_PATTERN = /␛\[[0-?]*[ -/]*[@-~]/g;
const CARRIAGE_RETURN_PATTERN = /\r+/g;
const CONTROL_PATTERN = /[\u0000-\u0008\u000b-\u001f\u007f]/g;

const STAGE_DEFINITIONS = [
  {
    id: "download",
    match:
      /Downloading submission files from MinIO|Downloaded \d+ submission files|Downloaded:/,
  },
  {
    id: "prepare",
    match:
      /Preparing judge workspace|Preparing Playwright tests|Starting Docker judge environment|Starting judge pipeline execution/,
  },
  {
    id: "install",
    match:
      /pnpm install|Progress: resolved|Packages: \+[0-9]+|Already up to date|Lockfile is up to date/,
  },
  {
    id: "build",
    match:
      /> .* build|vite build|building client environment|transforming\.\.\.|rendering chunks|computing gzip size|built in \d+(?:\.\d+)?(?:ms|s)/,
  },
  {
    id: "test",
    match:
      /Running \d+ tests using|tests\/judge\.spec\.ts|\[\d+\/\d+\]|GET \/|expect\(/,
  },
  {
    id: "upload",
    match: /Pipeline finished, uploading artifacts|Artifact uploaded:/,
  },
  {
    id: "persist",
    match: /Judge result summary|Results persisted/,
  },
] as const;

export function sanitizeJudgeLog(log: string) {
  return log
    .replace(OSC_PATTERN, "")
    .replace(ANSI_PATTERN, "")
    .replace(VISIBLE_ESCAPE_PATTERN, "")
    .replace(CARRIAGE_RETURN_PATTERN, "\n")
    .replace(CONTROL_PATTERN, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function getJudgeStages(
  log: string | null,
  status: string,
): JudgeStage[] {
  const sanitized = log ? sanitizeJudgeLog(log) : "";
  let reachedStageIndex = -1;

  STAGE_DEFINITIONS.forEach((stage, index) => {
    if (stage.match.test(sanitized)) {
      reachedStageIndex = index;
    }
  });

  const isActive =
    status === "pending" || status === "queued" || status === "running";

  return STAGE_DEFINITIONS.map((stage, index) => {
    const label = i18n.t(`judgeStages.${stage.id}`);

    if (index < reachedStageIndex) {
      return { ...stage, label, state: "done" as const };
    }

    if (index === reachedStageIndex) {
      return {
        ...stage,
        label,
        state: isActive ? ("current" as const) : ("done" as const),
      };
    }

    if (reachedStageIndex === -1 && isActive && index === 0) {
      return { ...stage, label, state: "current" as const };
    }

    return { ...stage, label, state: "pending" as const };
  });
}
