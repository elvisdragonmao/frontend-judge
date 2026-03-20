import { useCallback, useState, useEffect } from "react";
import { useParams } from "react-router";
import { useRejudgeSubmission, useSubmissionDetail } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/page-title";
import { useRefetchCountdown } from "@/hooks/use-refetch-countdown";
import { useAuth } from "@/stores/auth";
import { api } from "@/lib/api";
import { isSubmissionActive } from "@/lib/submission-status";

function ArtifactImage({
  artifactId,
  alt,
  className,
}: {
  artifactId: string;
  alt: string;
  className?: string;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("token");
    console.log(
      `[ArtifactImage] Token exists: ${!!token}, artifactId: ${artifactId}`,
    );
    api
      .get<{ url: string }>(`/artifacts/${artifactId}/url`)
      .then((res) => {
        console.log(`[ArtifactImage] Got URL:`, res.url);
        if (!cancelled) setImageUrl(res.url);
      })
      .catch((err) => {
        console.error(`[ArtifactImage] Error:`, err);
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [artifactId]);

  if (error) {
    return (
      <div className="flex h-32 items-center justify-center bg-muted text-muted-foreground">
        無法載入圖片
      </div>
    );
  }

  if (!imageUrl) {
    return (
      <div className="flex h-32 items-center justify-center bg-muted text-muted-foreground">
        載入中...
      </div>
    );
  }

  return <img src={imageUrl} alt={alt} className={className} />;
}

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
  const { user } = useAuth();
  const {
    data: submission,
    isLoading,
    dataUpdatedAt,
  } = useSubmissionDetail(id!);
  const rejudgeMutation = useRejudgeSubmission(id!);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(
    null,
  );
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownloadFile = useCallback(async (fileId: string) => {
    setDownloadError(null);
    setDownloadingFileId(fileId);
    try {
      const result = await api.get<{ url: string }>(
        `/submission-files/${fileId}/download`,
      );
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch {
      setDownloadError("下載失敗，請稍後再試");
    } finally {
      setDownloadingFileId(null);
    }
  }, []);
  const isInQueue = submission ? isSubmissionActive(submission.status) : false;
  const refreshCountdown = useRefetchCountdown(isInQueue, 5000, dataUpdatedAt);

  if (isLoading) {
    return (
      <>
        <PageTitle title="提交載入中" />
        <p className="text-muted-foreground">載入中...</p>
      </>
    );
  }

  if (!submission) {
    return (
      <>
        <PageTitle title="提交不存在" />
        <p className="text-muted-foreground">提交不存在</p>
      </>
    );
  }

  const canRejudge =
    !!user && (user.role !== "student" || user.id === submission.userId);
  const canDownloadFiles = user?.role === "admin";

  return (
    <div className="space-y-6">
      <PageTitle title={`提交詳情 - ${submission.displayName}`} />
      <div>
        <h1 className="text-2xl font-bold">提交詳情</h1>
        <p className="text-muted-foreground">
          {submission.displayName} (@{submission.username}) /{" "}
          {new Date(submission.createdAt).toLocaleString("zh-TW")}
        </p>
      </div>

      {canRejudge && (
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={() => rejudgeMutation.mutate()}
            disabled={rejudgeMutation.isPending || isInQueue}
          >
            {rejudgeMutation.isPending ? "重新排測中..." : "重新測試"}
          </Button>
          {isInQueue && (
            <p className="text-xs text-muted-foreground">目前已在評測隊列中</p>
          )}
          {rejudgeMutation.isSuccess && (
            <p className="text-xs text-green-600">已重新排入評測</p>
          )}
          {rejudgeMutation.isError && (
            <p className="text-xs text-destructive">重新測試失敗，請稍後再試</p>
          )}
        </div>
      )}

      {/* Overview */}
      <div className="flex items-center gap-4">
        <Badge variant={statusVariant(submission.status)} className="text-sm">
          {statusLabel(submission.status)}
        </Badge>
        {isInQueue && (
          <span className="text-xs text-muted-foreground">
            {refreshCountdown} 秒後更新
          </span>
        )}
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
          {downloadError && (
            <p className="mb-2 text-xs text-destructive">{downloadError}</p>
          )}
          <div className="space-y-1">
            {submission.files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs">{file.path}</span>
                  {canDownloadFiles && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownloadFile(file.id)}
                      disabled={downloadingFileId === file.id}
                    >
                      {downloadingFileId === file.id ? "下載中..." : "下載"}
                    </Button>
                  )}
                </div>
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
                {run.log.includes("ETIMEDOUT") && (
                  <p className="text-xs text-amber-600">
                    此次評測在容器內逾時，通常是 npm install/build
                    太久或程式卡住。
                  </p>
                )}
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
                        <ArtifactImage
                          artifactId={artifact.id}
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
