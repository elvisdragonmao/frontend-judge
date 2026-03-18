import { useParams } from "react-router";
import { useSubmissionDetail } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function statusVariant(status: string) {
  switch (status) {
    case "completed":
      return "success" as const;
    case "failed":
    case "error":
      return "destructive" as const;
    case "running":
    case "queued":
      return "warning" as const;
    default:
      return "secondary" as const;
  }
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    pending: "等待中",
    queued: "排隊中",
    running: "評測中",
    completed: "完成",
    failed: "失敗",
    error: "錯誤",
  };
  return map[status] ?? status;
}

export function SubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: submission, isLoading } = useSubmissionDetail(id!);

  if (isLoading) return <p className="text-muted-foreground">載入中...</p>;
  if (!submission) return <p className="text-muted-foreground">提交不存在</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">提交詳情</h1>
        <p className="text-muted-foreground">
          {submission.displayName} (@{submission.username}) /{" "}
          {new Date(submission.createdAt).toLocaleString("zh-TW")}
        </p>
      </div>

      {/* Overview */}
      <div className="flex items-center gap-4">
        <Badge variant={statusVariant(submission.status)} className="text-sm">
          {statusLabel(submission.status)}
        </Badge>
        {submission.score !== null && (
          <span className="text-lg font-semibold">
            {submission.score} / {submission.maxScore} 分
          </span>
        )}
        <span className="text-sm text-muted-foreground">
          {submission.fileCount} 個檔案
        </span>
      </div>

      {/* Files */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">上傳檔案</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {submission.files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="font-mono text-xs">{file.path}</span>
                <span className="text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Runs */}
      {submission.runs.map((run) => (
        <Card key={run.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">評測結果</CardTitle>
              <Badge variant={statusVariant(run.status)}>
                {statusLabel(run.status)}
              </Badge>
            </div>
            {run.startedAt && (
              <p className="text-xs text-muted-foreground">
                開始: {new Date(run.startedAt).toLocaleString("zh-TW")}
                {run.finishedAt && (
                  <>
                    {" "}
                    / 結束: {new Date(run.finishedAt).toLocaleString("zh-TW")}
                  </>
                )}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Score */}
            {run.score !== null && (
              <div className="text-lg font-semibold">
                分數: {run.score} / {run.maxScore}
              </div>
            )}

            {/* Test results */}
            {run.testResults && run.testResults.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">測試結果</h4>
                <div className="space-y-1">
                  {run.testResults.map((test, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded border border-border px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            test.passed ? "text-green-600" : "text-red-600"
                          }
                        >
                          {test.passed ? "PASS" : "FAIL"}
                        </span>
                        <span>{test.name}</span>
                      </div>
                      <span className="text-muted-foreground">
                        {test.score} 分
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Log */}
            {run.log && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Log</h4>
                <pre className="max-h-60 overflow-auto rounded bg-muted p-3 text-xs">
                  {run.log}
                </pre>
              </div>
            )}

            {/* Artifacts */}
            {run.artifacts.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">截圖與附件</h4>
                <div className="grid grid-cols-2 gap-2">
                  {run.artifacts
                    .filter((a) => a.type === "screenshot")
                    .map((artifact) => (
                      <div
                        key={artifact.id}
                        className="overflow-hidden rounded border border-border"
                      >
                        <img
                          src={`/api/artifacts/${artifact.id}/url`}
                          alt={artifact.name}
                          className="w-full"
                        />
                        <p className="p-1 text-xs text-muted-foreground">
                          {artifact.name}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
