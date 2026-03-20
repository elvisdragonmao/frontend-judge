import { useState } from "react";
import { Plus, UserMinus, UserPlus, Users, X } from "@/lib/icons";
import { useTranslation } from "react-i18next";
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
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageTitle } from "@/components/page-title";
import { ScoreChart } from "@/components/score-chart";
import { formatDate, i18n } from "@/i18n";

export function ClassDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: cls, isLoading } = useClassDetail(id!);
  const { data: scoreHistory } = useClassScoreHistory(id!);
  const { data: assignments } = useAssignments(id!);

  const addMembersMutation = useAddClassMembers(id!);
  const removeMemberMutation = useRemoveClassMember(id!);

  const [showAddMember, setShowAddMember] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { data: allUsers } = useUsers(1);

  if (isLoading) {
    return (
      <>
        <PageTitle title={t("pages.classDetail.loadingTitle")} />
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </>
    );
  }

  if (!cls) {
    return (
      <>
        <PageTitle title={t("pages.classDetail.notFoundTitle")} />
        <p className="text-muted-foreground">
          {t("pages.classDetail.notFoundTitle")}
        </p>
      </>
    );
  }

  const memberIds = new Set(cls.members?.map((member) => member.id) ?? []);
  const availableUsers = (allUsers?.users ?? []).filter(
    (candidate) =>
      !memberIds.has(candidate.id) &&
      (searchQuery === "" ||
        candidate.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        candidate.displayName
          .toLowerCase()
          .includes(searchQuery.toLowerCase())),
  );

  const handleAddMember = (userId: string) => {
    addMembersMutation.mutate([userId]);
  };

  const handleRemoveMember = (userId: string) => {
    removeMemberMutation.mutate(userId);
  };

  return (
    <div className="space-y-6">
      <PageTitle title={cls.name} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{cls.name}</h1>
          <p className="text-muted-foreground">{cls.description}</p>
        </div>
        {user && isStaff(user.role) && (
          <Button asChild size="sm">
            <Link to={`/classes/${id}/assignments/new`}>
              <Plus />
              {t("pages.classDetail.newAssignment")}
            </Link>
          </Button>
        )}
      </div>

      {scoreHistory && scoreHistory.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <ScoreChart data={scoreHistory} />
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">
          {t("pages.classDetail.assignmentsTitle")}
        </h2>
        {assignments?.length === 0 && (
          <p className="text-muted-foreground">
            {t("pages.classDetail.noAssignments")}
          </p>
        )}
        {assignments?.map((assignment) => (
          <Link
            key={assignment.id}
            to={`/assignments/${assignment.id}`}
            className="block"
          >
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{assignment.title}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="secondary">
                      {t(`assignmentTypes.${assignment.type}`)}
                    </Badge>
                    {assignment.dueDate && (
                      <span className="text-xs text-muted-foreground">
                        {t("pages.classDetail.dueDate", {
                          date: formatDate(assignment.dueDate),
                        })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {t("pages.classDetail.submissionsCount", {
                    count: assignment.submissionCount,
                  })}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {user && isStaff(user.role) && cls.members && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {t("pages.classDetail.membersTitle", {
                count: cls.members.length,
              })}
            </h2>
            <Button
              size="sm"
              variant={showAddMember ? "outline" : "default"}
              onClick={() => setShowAddMember(!showAddMember)}
            >
              {showAddMember ? <X /> : <Users />}
              {showAddMember
                ? t("pages.classDetail.collapse")
                : t("pages.classDetail.addMembers")}
            </Button>
          </div>

          {showAddMember && (
            <Card>
              <CardContent className="space-y-3 pt-4">
                <Input
                  placeholder={t("pages.classDetail.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {availableUsers.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {searchQuery
                      ? t("pages.classDetail.noMatchingUsers")
                      : t("pages.classDetail.noAvailableUsers")}
                  </p>
                )}
                <div className="max-h-60 space-y-1 overflow-auto">
                  {availableUsers.map((candidate) => (
                    <div
                      key={candidate.id}
                      className="flex items-center justify-between rounded border border-border px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {candidate.displayName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          @{candidate.username}
                        </span>
                        <Badge variant="outline">
                          {i18n.t(`roles.${candidate.role}`)}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleAddMember(candidate.id)}
                        disabled={addMembersMutation.isPending}
                      >
                        <UserPlus />
                        {t("pages.classDetail.join")}
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="rounded-lg border border-border">
            <div className="grid grid-cols-4 border-b border-border bg-muted px-4 py-2 text-sm font-medium">
              <span>{t("pages.classDetail.usernameHeader")}</span>
              <span>{t("pages.classDetail.displayNameHeader")}</span>
              <span>{t("pages.classDetail.roleHeader")}</span>
              <span className="text-right">
                {t("pages.classDetail.actionsHeader")}
              </span>
            </div>
            {cls.members.map((member) => (
              <div
                key={member.id}
                className="grid grid-cols-4 items-center border-b border-border px-4 py-2 text-sm last:border-b-0"
              >
                <span>{member.username}</span>
                <span>{member.displayName}</span>
                <span>
                  <Badge variant="outline">{t(`roles.${member.role}`)}</Badge>
                </span>
                <span className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleRemoveMember(member.id)}
                    disabled={removeMemberMutation.isPending}
                  >
                    <UserMinus />
                    {t("pages.classDetail.remove")}
                  </Button>
                </span>
              </div>
            ))}
            {cls.members.length === 0 && (
              <div className="px-4 py-3 text-sm text-muted-foreground">
                {t("pages.classDetail.noMembers")}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
