import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import { useRejudgeSubmission, useSubmissionDetail } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/page-title";
import { useRefetchCountdown } from "@/hooks/use-refetch-countdown";
import { useAuth } from "@/stores/auth";
import { api } from "@/lib/api";
import {
  getSubmissionStatusLabel,
  getSubmissionStatusVariant,
  isSubmissionActive,
} from "@/lib/submission-status";
import { getJudgeStages, sanitizeJudgeLog } from "@/lib/judge-log";
import { formatDateTime } from "@/i18n";

function ArtifactImage({
  artifactId,
  alt,
  className,
}: {
  artifactId: string;
  alt: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    api
      .get<{ url: string }>(`/artifacts/${artifactId}/url`)
      .then((res) => {
        if (!cancelled) setImageUrl(res.url);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [artifactId]);

  if (error) {
    return (
      <div className="flex h-32 items-center justify-center bg-muted text-muted-foreground">
        {t("pages.submissionDetail.imageLoadFailed")}
      </div>
    );
  }

  if (!imageUrl) {
    return (
      <div className="flex h-32 items-center justify-center bg-muted text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  return <img src={imageUrl} alt={alt} className={className} />;
}

export function SubmissionDetailPage() {
  const { t } = useTranslation();
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

  const handleDownloadFile = useCallback(
    async (fileId: string) => {
      setDownloadError(null);
      setDownloadingFileId(fileId);

      try {
        const result = await api.get<{ url: string }>(
          `/submission-files/${fileId}/download`,
        );
        window.open(result.url, "_blank", "noopener,noreferrer");
      } catch {
        setDownloadError(t("pages.submissionDetail.downloadFailed"));
      } finally {
        setDownloadingFileId(null);
      }
    },
    [t],
  );

  const isInQueue = submission ? isSubmissionActive(submission.status) : false;
  const refreshCountdown = useRefetchCountdown(isInQueue, 5000, dataUpdatedAt);

  if (isLoading) {
    return (
      <>
        <PageTitle title={t("pages.submissionDetail.loadingTitle")} />
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </>
    );
  }

  if (!submission) {
    return (
      <>
        <PageTitle title={t("pages.submissionDetail.notFoundTitle")} />
        <p className="text-muted-foreground">
          {t("pages.submissionDetail.notFoundTitle")}
        </p>
      </>
    );
  }

  const canRejudge =
    !!user && (user.role !== "student" || user.id === submission.userId);
  const canDownloadFiles = user?.role === "admin";
  const runsWithDerivedState = submission.runs.map((run) => ({
    ...run,
    cleanLog: run.log ? sanitizeJudgeLog(run.log) : null,
    stages: getJudgeStages(run.log, run.status),
  }));

  return (
    <div className="space-y-6">
      <PageTitle
        title={t("pages.submissionDetail.pageTitle", {
          name: submission.displayName,
        })}
      />

      <div>
        <Button asChild variant="outline" size="sm" className="mb-3">
          <Link to={`/assignments/${submission.assignmentId}`}>
            {t("pages.submissionDetail.backToAssignment")}
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">
          {t("pages.submissionDetail.title")}
        </h1>
        <p className="text-muted-foreground">
          {t("pages.submissionDetail.meta", {
            name: submission.displayName,
            username: submission.username,
            date: formatDateTime(submission.createdAt),
          })}
        </p>
      </div>

      {canRejudge && (
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={() => rejudgeMutation.mutate()}
            disabled={rejudgeMutation.isPending || isInQueue}
          >
            {rejudgeMutation.isPending
              ? t("pages.submissionDetail.rejudging")
              : t("pages.submissionDetail.rejudge")}
          </Button>
          {isInQueue && (
            <p className="text-xs text-muted-foreground">
              {t("pages.submissionDetail.inQueue")}
            </p>
          )}
          {rejudgeMutation.isSuccess && (
            <p className="text-xs text-green-600">
              {t("pages.submissionDetail.rejudgeSuccess")}
            </p>
          )}
          {rejudgeMutation.isError && (
            <p className="text-xs text-destructive">
              {t("pages.submissionDetail.rejudgeFailed")}
            </p>
          )}
        </div>
      )}

      <div className="flex items-center gap-4">
        <Badge
          variant={getSubmissionStatusVariant(submission.status)}
          className="text-sm"
        >
          {getSubmissionStatusLabel(submission.status)}
        </Badge>
        {isInQueue && (
          <span className="text-xs text-muted-foreground">
            {t("pages.submissionDetail.refreshIn", {
              seconds: refreshCountdown,
            })}
          </span>
        )}
        {submission.score !== null && (
          <span className="text-lg font-semibold">
            {t("pages.submissionDetail.scoreValue", {
              score: submission.score,
              maxScore: submission.maxScore,
            })}
          </span>
        )}
        <span className="text-sm text-muted-foreground">
          {t("pages.submissionDetail.filesCount", {
            count: submission.fileCount,
          })}
        </span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("pages.submissionDetail.uploadedFiles")}
          </CardTitle>
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
                      {downloadingFileId === file.id
                        ? t("pages.submissionDetail.downloading")
                        : t("pages.submissionDetail.download")}
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

      {runsWithDerivedState.map((run) => (
        <Card key={run.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {t("pages.submissionDetail.judgeResult")}
              </CardTitle>
              <Badge variant={getSubmissionStatusVariant(run.status)}>
                {getSubmissionStatusLabel(run.status)}
              </Badge>
            </div>
            {run.startedAt && (
              <p className="text-xs text-muted-foreground">
                {t("pages.submissionDetail.startedAt", {
                  date: formatDateTime(run.startedAt),
                })}
                {run.finishedAt && (
                  <>
                    {" / "}
                    {t("pages.submissionDetail.finishedAt", {
                      date: formatDateTime(run.finishedAt),
                    })}
                  </>
                )}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {run.score !== null && (
              <div className="text-lg font-semibold">
                {t("pages.submissionDetail.scoreLabel", {
                  score: run.score,
                  maxScore: run.maxScore,
                })}
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-sm font-medium">
                {t("pages.submissionDetail.stages")}
              </h4>
              <div className="flex flex-wrap gap-2">
                {run.stages.map((stage) => (
                  <Badge
                    key={stage.id}
                    variant={
                      stage.state === "done"
                        ? "success"
                        : stage.state === "current"
                          ? "info"
                          : "outline"
                    }
                  >
                    {stage.label}
                  </Badge>
                ))}
              </div>
            </div>

            {run.testResults && run.testResults.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">
                  {t("pages.submissionDetail.tests")}
                </h4>
                <div className="space-y-1">
                  {run.testResults.map((test, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded border border-border px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            test.passed ? "text-green-600" : "text-red-600"
                          }
                        >
                          {test.passed
                            ? t("pages.submissionDetail.pass")
                            : t("pages.submissionDetail.fail")}
                        </span>
                        <span>{test.name}</span>
                      </div>
                      <span className="text-muted-foreground">
                        {t("pages.submissionDetail.points", {
                          count: test.score,
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {run.cleanLog && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Log</h4>
                {run.cleanLog.includes("ETIMEDOUT") && (
                  <p className="text-xs text-amber-600">
                    {t("pages.submissionDetail.timeoutHint")}
                  </p>
                )}
                <pre className="max-h-60 overflow-auto rounded bg-muted p-3 text-xs">
                  {run.cleanLog}
                </pre>
              </div>
            )}

            {run.artifacts.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">
                  {t("pages.submissionDetail.artifacts")}
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {run.artifacts
                    .filter((artifact) => artifact.type === "screenshot")
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
