import type { SubmissionSummary } from "@judge/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router";

interface SubmissionGridProps {
  submissions: SubmissionSummary[];
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

export function SubmissionGrid({ submissions }: SubmissionGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {submissions.map((sub) => (
        <Link key={sub.id} to={`/submissions/${sub.id}`}>
          <Card className="overflow-hidden transition-shadow hover:shadow-md">
            {/* Screenshot */}
            <div className="aspect-video bg-muted">
              {sub.screenshotUrl ? (
                <img
                  src={sub.screenshotUrl}
                  alt={`${sub.displayName} 的截圖`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  無截圖
                </div>
              )}
            </div>
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{sub.displayName}</span>
                <Badge variant={statusVariant(sub.status)}>
                  {statusLabel(sub.status)}
                </Badge>
              </div>
              {sub.score !== null && (
                <p className="mt-1 text-xs text-muted-foreground">
                  分數: {sub.score} / {sub.maxScore}
                </p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(sub.createdAt).toLocaleString("zh-TW")}
              </p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

export function SubmissionList({ submissions }: SubmissionGridProps) {
  return (
    <div className="space-y-2">
      {submissions.map((sub) => (
        <Link key={sub.id} to={`/submissions/${sub.id}`}>
          <div className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted">
            <div className="flex items-center gap-4">
              <div>
                <p className="font-medium">{sub.displayName}</p>
                <p className="text-sm text-muted-foreground">
                  @{sub.username} / {sub.fileCount} 個檔案
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {sub.score !== null && (
                <span className="text-sm font-medium">
                  {sub.score} / {sub.maxScore}
                </span>
              )}
              <Badge variant={statusVariant(sub.status)}>
                {statusLabel(sub.status)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(sub.createdAt).toLocaleString("zh-TW")}
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
