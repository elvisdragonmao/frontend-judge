import { useState, useCallback } from "react";
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
import { ApiError } from "@/lib/api";

export function AssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: assignment, isLoading } = useAssignmentDetail(id!);
  const { data: submissionData } = useSubmissions(id!);
  const submitMutation = useSubmit(id!);

  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");

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
        return "提交失敗：檔案數量超過上限，請確認已排除 node_modules、dist 等產物後再試。";
      }

      return error.message;
    }

    return "提交失敗，請重試。";
  })();

  const handleUpload = useCallback(
    (files: File[]) => {
      const formData = new FormData();
      for (const file of files) {
        formData.append("file", file, file.webkitRelativePath || file.name);
      }
      submitMutation.mutate(formData);
    },
    [submitMutation],
  );

  if (isLoading) {
    return (
      <>
        <PageTitle title="作業載入中" />
        <p className="text-muted-foreground">載入中...</p>
      </>
    );
  }

  if (!assignment) {
    return (
      <>
        <PageTitle title="作業不存在" />
        <p className="text-muted-foreground">作業不存在</p>
      </>
    );
  }

  const isExpired = assignment.dueDate
    ? new Date(assignment.dueDate) < new Date()
    : false;

  return (
    <div className="space-y-6">
      <PageTitle title={assignment.title} />
      {/* Assignment header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{assignment.title}</h1>
          <Badge variant="secondary">{assignment.type}</Badge>
          {isExpired && <Badge variant="destructive">已截止</Badge>}
          {user && isStaff(user.role) && (
            <Button asChild size="sm" variant="outline">
              <Link to={`/assignments/${assignment.id}/edit`}>編輯題目</Link>
            </Button>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {assignment.className}
          {assignment.dueDate && (
            <> / 截止: {new Date(assignment.dueDate).toLocaleString("zh-TW")}</>
          )}
        </p>
      </div>

      {/* Description */}
      {assignment.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">題目描述</CardTitle>
          </CardHeader>
          <CardContent>
            <MarkdownRenderer content={assignment.description} />
          </CardContent>
        </Card>
      )}

      {/* Upload section (student only) */}
      {user?.role === "student" && !isExpired && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">繳交作業</CardTitle>
          </CardHeader>
          <CardContent>
            <FileUploader
              onUpload={handleUpload}
              isLoading={submitMutation.isPending}
            />
            {submitMutation.isSuccess && (
              <p className="mt-3 text-sm text-green-600">作業已成功提交！</p>
            )}
            {submitErrorMessage && (
              <p className="mt-3 text-sm text-destructive">
                {submitErrorMessage}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Submissions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            繳交紀錄 ({submissionData?.total ?? 0})
          </h2>
          <div className="flex gap-1">
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("list")}
            >
              列表
            </Button>
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("grid")}
            >
              網格
            </Button>
          </div>
        </div>

        {submissionData?.submissions.length === 0 && (
          <p className="text-muted-foreground">尚無繳交紀錄</p>
        )}

        {submissionData &&
          submissionData.submissions.length > 0 &&
          (viewMode === "grid" ? (
            <SubmissionGrid submissions={submissionData.submissions} />
          ) : (
            <SubmissionList submissions={submissionData.submissions} />
          ))}
      </div>
    </div>
  );
}
