import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import {
  useAssignmentDetail,
  useSubmissions,
  useSubmit,
} from "@/hooks/use-api";
import { useAuth } from "@/stores/auth";
import { isStaff } from "@judge/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageTitle } from "@/components/page-title";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { FileUploader } from "@/components/file-uploader";
import { SubmissionGrid, SubmissionList } from "@/components/submission-grid";
import { useRefetchCountdown } from "@/hooks/use-refetch-countdown";
import { ApiError } from "@/lib/api";
import { isSubmissionActive } from "@/lib/submission-status";
import { formatDateTime } from "@/i18n";

export function AssignmentDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: assignment, isLoading } = useAssignmentDetail(id!);
  const { data: submissionData, dataUpdatedAt: submissionsUpdatedAt } =
    useSubmissions(id!);
  const submitMutation = useSubmit(id!);

  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");
  const [showLatestOnly, setShowLatestOnly] = useState(true);

  const submitErrorMessage = (() => {
    if (!submitMutation.isError) {
      return null;
    }

    const error = submitMutation.error;
    if (error instanceof ApiError) {
      if (
        error.statusCode === 413 ||
        error.message.includes("reach files limit")
      ) {
        return t("pages.assignmentDetail.uploadFailedTooManyFiles");
      }

      return error.message;
    }

    return t("pages.assignmentDetail.uploadFailedDefault");
  })();

  const handleUpload = useCallback(
    (files: File[]) => {
      const formData = new FormData();
      for (const file of files) {
        const relativePath = file.webkitRelativePath || file.name;
        formData.append("path", relativePath);
        formData.append("file", file, relativePath);
      }
      submitMutation.mutate(formData);
    },
    [submitMutation],
  );

  const hasActiveSubmissions =
    submissionData?.submissions.some((submission) =>
      isSubmissionActive(submission.status),
    ) ?? false;

  const visibleSubmissions = useMemo(() => {
    const submissions = submissionData?.submissions ?? [];

    if (!showLatestOnly) {
      return submissions;
    }

    const seenUsers = new Set<string>();

    return submissions.filter((submission) => {
      if (seenUsers.has(submission.userId)) {
        return false;
      }

      seenUsers.add(submission.userId);
      return true;
    });
  }, [submissionData?.submissions, showLatestOnly]);

  const submissionsRefreshCountdown = useRefetchCountdown(
    hasActiveSubmissions,
    5000,
    submissionsUpdatedAt,
  );

  if (isLoading) {
    return (
      <>
        <PageTitle title={t("pages.assignmentDetail.loadingTitle")} />
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </>
    );
  }

  if (!assignment) {
    return (
      <>
        <PageTitle title={t("pages.assignmentDetail.notFoundTitle")} />
        <p className="text-muted-foreground">
          {t("pages.assignmentDetail.notFoundTitle")}
        </p>
      </>
    );
  }

  const isExpired = assignment.dueDate
    ? new Date(assignment.dueDate) < new Date()
    : false;

  return (
    <div className="space-y-6">
      <PageTitle title={assignment.title} />

      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{assignment.title}</h1>
          <Badge variant="secondary">
            {t(`assignmentTypes.${assignment.type}`)}
          </Badge>
          {isExpired && (
            <Badge variant="destructive">
              {t("pages.assignmentDetail.expired")}
            </Badge>
          )}
          {user && isStaff(user.role) && (
            <Button asChild size="sm" variant="outline">
              <Link to={`/assignments/${assignment.id}/edit`}>
                {t("pages.assignmentDetail.editAssignment")}
              </Link>
            </Button>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {assignment.className}
          {assignment.dueDate && (
            <>
              {" / "}
              {t("pages.assignmentDetail.dueAt", {
                date: formatDateTime(assignment.dueDate),
              })}
            </>
          )}
        </p>
      </div>

      {assignment.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("pages.assignmentDetail.description")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MarkdownRenderer content={assignment.description} />
          </CardContent>
        </Card>
      )}

      {user?.role === "student" && !isExpired && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("pages.assignmentDetail.submitAssignment")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FileUploader
              onUpload={handleUpload}
              isLoading={submitMutation.isPending}
            />
            {submitMutation.isSuccess && (
              <p className="mt-3 text-sm text-green-600">
                {t("pages.assignmentDetail.submitSuccess")}
              </p>
            )}
            {submitErrorMessage && (
              <p className="mt-3 text-sm text-destructive">
                {submitErrorMessage}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              {t("pages.assignmentDetail.submissionsTitle", {
                count: visibleSubmissions.length,
              })}
            </h2>
            {showLatestOnly &&
              visibleSubmissions.length !== (submissionData?.total ?? 0) && (
                <p className="text-xs text-muted-foreground">
                  {t("pages.assignmentDetail.hiddenDuplicates")}
                </p>
              )}
            {hasActiveSubmissions && (
              <p className="text-xs text-muted-foreground">
                {t("pages.assignmentDetail.refreshIn", {
                  seconds: submissionsRefreshCountdown,
                })}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={showLatestOnly}
                onChange={(e) => setShowLatestOnly(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              {t("pages.assignmentDetail.latestOnly")}
            </label>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("list")}
            >
              {t("pages.assignmentDetail.list")}
            </Button>
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("grid")}
            >
              {t("pages.assignmentDetail.grid")}
            </Button>
          </div>
        </div>

        {visibleSubmissions.length === 0 && (
          <p className="text-muted-foreground">
            {t("pages.assignmentDetail.noSubmissions")}
          </p>
        )}

        {visibleSubmissions.length > 0 &&
          (viewMode === "grid" ? (
            <SubmissionGrid submissions={visibleSubmissions} />
          ) : (
            <SubmissionList submissions={visibleSubmissions} />
          ))}
      </div>
    </div>
  );
}
