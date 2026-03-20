import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useUsers,
  useCreateUser,
  useBulkImport,
  useResetPassword,
} from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageTitle } from "@/components/page-title";
import { Link } from "react-router";

export function AdminPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const { data: userData, isLoading } = useUsers(page);
  const createUserMutation = useCreateUser();
  const bulkImportMutation = useBulkImport();
  const resetPasswordMutation = useResetPassword();

  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newRole, setNewRole] = useState<"student" | "teacher" | "admin">(
    "student",
  );

  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState("");

  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkText, setBulkText] = useState("");

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    createUserMutation.mutate(
      {
        username: newUsername,
        password: newPassword,
        displayName: newDisplayName,
        role: newRole,
      },
      {
        onSuccess: () => {
          setNewUsername("");
          setNewPassword("");
          setNewDisplayName("");
          setShowCreateUser(false);
        },
      },
    );
  };

  const handleResetPassword = (userId: string) => {
    if (!resetNewPassword) return;
    resetPasswordMutation.mutate(
      { userId, newPassword: resetNewPassword },
      {
        onSuccess: () => {
          setResetUserId(null);
          setResetNewPassword("");
        },
      },
    );
  };

  const handleBulkImport = () => {
    try {
      const lines = bulkText.trim().split("\n").filter(Boolean);
      const users = lines.map((line) => {
        const [username, password, displayName, role] = line
          .split(",")
          .map((segment) => segment.trim());
        return {
          username: username!,
          password: password!,
          displayName: displayName || username!,
          role: (role as "student" | "teacher" | "admin") || "student",
        };
      });
      bulkImportMutation.mutate({ users });
    } catch {
      alert(t("pages.admin.invalidFormat"));
    }
  };

  return (
    <div className="space-y-6">
      <PageTitle title={t("pages.admin.title")} />
      <h1 className="text-2xl font-bold">{t("pages.admin.title")}</h1>

      <div className="flex gap-2">
        <Button size="sm" onClick={() => setShowCreateUser(!showCreateUser)}>
          {t("pages.admin.createUser")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowBulkImport(!showBulkImport)}
        >
          {t("pages.admin.bulkImport")}
        </Button>
      </div>

      {showCreateUser && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("pages.admin.createUserTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateUser} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder={t("pages.admin.usernamePlaceholder")}
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  required
                />
                <Input
                  placeholder={t("pages.admin.passwordPlaceholder")}
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <Input
                  placeholder={t("pages.admin.displayNamePlaceholder")}
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  required
                />
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as typeof newRole)}
                  className="rounded-md border border-border px-3 py-2 text-sm"
                >
                  <option value="student">{t("roles.student")}</option>
                  <option value="teacher">{t("roles.teacher")}</option>
                  <option value="admin">{t("roles.admin")}</option>
                </select>
              </div>
              <Button
                type="submit"
                size="sm"
                disabled={createUserMutation.isPending}
              >
                {t("pages.admin.create")}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {showBulkImport && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("pages.admin.bulkImportTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {t("pages.admin.bulkImportHelp")}
            </p>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={t("pages.admin.bulkImportPlaceholder")}
              className="min-h-[120px] w-full rounded-md border border-border bg-transparent px-3 py-2 font-mono text-sm"
            />
            <Button
              size="sm"
              onClick={handleBulkImport}
              disabled={bulkImportMutation.isPending}
            >
              {t("pages.admin.import")}
            </Button>
            {bulkImportMutation.isSuccess && (
              <p className="text-sm text-green-600">
                {t("pages.admin.importDone")}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("pages.admin.userListTitle", { count: userData?.total ?? 0 })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <p className="text-muted-foreground">{t("common.loading")}</p>
          )}

          <div className="space-y-2">
            {userData?.users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between rounded border border-border p-3"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-sm font-medium">{user.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      @{user.username}
                    </p>
                  </div>
                  <Badge variant="outline">{t(`roles.${user.role}`)}</Badge>
                  {user.classes && user.classes.length > 0 && (
                    <div className="flex items-center gap-1">
                      {user.classes.map((cls) => (
                        <Link key={cls.id} to={`/classes/${cls.id}`}>
                          <Badge
                            variant="secondary"
                            className="cursor-pointer hover:bg-secondary/80"
                          >
                            {cls.name}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  )}
                  {user.classes && user.classes.length === 0 && (
                    <span className="text-xs text-muted-foreground">
                      {t("pages.admin.noClassJoined")}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {resetUserId === user.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="password"
                        placeholder={t("pages.admin.newPasswordPlaceholder")}
                        value={resetNewPassword}
                        onChange={(e) => setResetNewPassword(e.target.value)}
                        className="h-8 w-32"
                        minLength={6}
                      />
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleResetPassword(user.id)}
                        disabled={resetPasswordMutation.isPending}
                      >
                        {t("common.confirm")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setResetUserId(null)}
                      >
                        {t("common.cancel")}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setResetUserId(user.id)}
                    >
                      {t("pages.admin.resetPassword")}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {userData && userData.total > 20 && (
            <div className="mt-4 flex justify-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                {t("pages.admin.previousPage")}
              </Button>
              <span className="flex items-center text-sm text-muted-foreground">
                {t("pages.admin.currentPage", { page })}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page * 20 >= userData.total}
                onClick={() => setPage(page + 1)}
              >
                {t("pages.admin.nextPage")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
