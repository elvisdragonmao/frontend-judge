import { useState } from "react";
import { useParams, Link } from "react-router";
import {
  useClassDetail,
  useClassScoreHistory,
  useAssignments,
  useUsers,
  useAddClassMembers,
  useRemoveClassMember,
} from "@/hooks/use-api";
import { useAuth } from "@/stores/auth";
import { isStaff } from "@judge/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScoreChart } from "@/components/score-chart";

export function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: cls, isLoading } = useClassDetail(id!);
  const { data: scoreHistory } = useClassScoreHistory(id!);
  const { data: assignments } = useAssignments(id!);

  const addMembersMutation = useAddClassMembers(id!);
  const removeMemberMutation = useRemoveClassMember(id!);

  // Add member state
  const [showAddMember, setShowAddMember] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { data: allUsers } = useUsers(1);

  if (isLoading) return <p className="text-muted-foreground">載入中...</p>;
  if (!cls) return <p className="text-muted-foreground">班級不存在</p>;

  const memberIds = new Set(cls.members?.map((m) => m.id) ?? []);

  // Filter users: not already members, match search query
  const availableUsers = (allUsers?.users ?? []).filter(
    (u) =>
      !memberIds.has(u.id) &&
      (searchQuery === "" ||
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.displayName.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const handleAddMember = (userId: string) => {
    addMembersMutation.mutate([userId]);
  };

  const handleRemoveMember = (userId: string) => {
    removeMemberMutation.mutate(userId);
  };

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
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              成員 ({cls.members.length})
            </h2>
            <Button
              size="sm"
              variant={showAddMember ? "outline" : "default"}
              onClick={() => setShowAddMember(!showAddMember)}
            >
              {showAddMember ? "收起" : "新增成員"}
            </Button>
          </div>

          {/* Add member panel */}
          {showAddMember && (
            <Card>
              <CardContent className="pt-4 space-y-3">
                <Input
                  placeholder="搜尋帳號或暱稱..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {availableUsers.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? "找不到符合的使用者" : "沒有可新增的使用者"}
                  </p>
                )}
                <div className="max-h-60 overflow-auto space-y-1">
                  {availableUsers.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between rounded border border-border px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {u.displayName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          @{u.username}
                        </span>
                        <Badge variant="outline">{u.role}</Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleAddMember(u.id)}
                        disabled={addMembersMutation.isPending}
                      >
                        加入
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Member list */}
          <div className="rounded-lg border border-border">
            <div className="grid grid-cols-4 border-b border-border bg-muted px-4 py-2 text-sm font-medium">
              <span>帳號</span>
              <span>暱稱</span>
              <span>角色</span>
              <span className="text-right">操作</span>
            </div>
            {cls.members.map((member) => (
              <div
                key={member.id}
                className="grid grid-cols-4 items-center border-b border-border px-4 py-2 text-sm last:border-b-0"
              >
                <span>{member.username}</span>
                <span>{member.displayName}</span>
                <span>
                  <Badge variant="outline">{member.role}</Badge>
                </span>
                <span className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleRemoveMember(member.id)}
                    disabled={removeMemberMutation.isPending}
                  >
                    移除
                  </Button>
                </span>
              </div>
            ))}
            {cls.members.length === 0 && (
              <div className="px-4 py-3 text-sm text-muted-foreground">
                尚無成員
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
