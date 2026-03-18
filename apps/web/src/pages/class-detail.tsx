import { useParams, Link } from "react-router";
import {
  useClassDetail,
  useClassScoreHistory,
  useAssignments,
} from "@/hooks/use-api";
import { useAuth } from "@/stores/auth";
import { isStaff } from "@judge/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScoreChart } from "@/components/score-chart";

export function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: cls, isLoading } = useClassDetail(id!);
  const { data: scoreHistory } = useClassScoreHistory(id!);
  const { data: assignments } = useAssignments(id!);

  if (isLoading) return <p className="text-muted-foreground">載入中...</p>;
  if (!cls) return <p className="text-muted-foreground">班級不存在</p>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{cls.name}</h1>
          <p className="text-muted-foreground">{cls.description}</p>
        </div>
        {user && isStaff(user.role) && (
          <Button asChild size="sm">
            <Link to={`/classes/${id}/assignments/new`}>出題</Link>
          </Button>
        )}
      </div>

      {/* Score chart */}
      {scoreHistory && scoreHistory.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <ScoreChart data={scoreHistory} />
          </CardContent>
        </Card>
      )}

      {/* Assignments list */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">作業列表</h2>
        {assignments?.length === 0 && (
          <p className="text-muted-foreground">尚未建立作業</p>
        )}
        {assignments?.map((assignment) => (
          <Link key={assignment.id} to={`/assignments/${assignment.id}`}>
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{assignment.title}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="secondary">{assignment.type}</Badge>
                    {assignment.dueDate && (
                      <span className="text-xs text-muted-foreground">
                        截止:{" "}
                        {new Date(assignment.dueDate).toLocaleDateString(
                          "zh-TW",
                        )}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {assignment.submissionCount} 份繳交
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Members */}
      {user && isStaff(user.role) && cls.members && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">成員 ({cls.members.length})</h2>
          <div className="rounded-lg border border-border">
            <div className="grid grid-cols-3 border-b border-border bg-muted px-4 py-2 text-sm font-medium">
              <span>帳號</span>
              <span>暱稱</span>
              <span>角色</span>
            </div>
            {cls.members.map((member) => (
              <div
                key={member.id}
                className="grid grid-cols-3 border-b border-border px-4 py-2 text-sm last:border-b-0"
              >
                <span>{member.username}</span>
                <span>{member.displayName}</span>
                <span>
                  <Badge variant="outline">{member.role}</Badge>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
