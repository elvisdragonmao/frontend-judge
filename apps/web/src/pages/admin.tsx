import { useState } from "react";
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
import { Link } from "react-router";

export function AdminPage() {
  const [page, setPage] = useState(1);
  const { data: userData, isLoading } = useUsers(page);
  const createUserMutation = useCreateUser();
  const bulkImportMutation = useBulkImport();
  const resetPasswordMutation = useResetPassword();

  // Create user form
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newRole, setNewRole] = useState<"student" | "teacher" | "admin">(
    "student",
  );

  // Reset password
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState("");

  // Bulk import
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
      // Expected format: CSV lines "username,password,displayName,role"
      const lines = bulkText.trim().split("\n").filter(Boolean);
      const users = lines.map((line) => {
        const [username, password, displayName, role] = line
          .split(",")
          .map((s) => s.trim());
        return {
          username: username!,
          password: password!,
          displayName: displayName || username!,
          role: (role as "student" | "teacher" | "admin") || "student",
        };
      });
      bulkImportMutation.mutate({ users });
    } catch {
      alert("格式錯誤");
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">管理後台</h1>

      <div className="flex gap-2">
        <Button size="sm" onClick={() => setShowCreateUser(!showCreateUser)}>
          建立使用者
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowBulkImport(!showBulkImport)}
        >
          批次匯入
        </Button>
      </div>

      {/* Create user form */}
      {showCreateUser && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">建立使用者</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateUser} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="帳號"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  required
                />
                <Input
                  placeholder="密碼"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <Input
                  placeholder="暱稱"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  required
                />
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as typeof newRole)}
                  className="rounded-md border border-border px-3 py-2 text-sm"
                >
                  <option value="student">學生</option>
                  <option value="teacher">老師</option>
                  <option value="admin">管理員</option>
                </select>
              </div>
              <Button
                type="submit"
                size="sm"
                disabled={createUserMutation.isPending}
              >
                建立
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Bulk import */}
      {showBulkImport && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">批次匯入</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              每行一筆，格式: 帳號,密碼,暱稱,角色(student/teacher/admin)
            </p>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="student01,pass123,小明,student"
              className="min-h-[120px] w-full rounded-md border border-border bg-transparent px-3 py-2 font-mono text-sm"
            />
            <Button
              size="sm"
              onClick={handleBulkImport}
              disabled={bulkImportMutation.isPending}
            >
              匯入
            </Button>
            {bulkImportMutation.isSuccess && (
              <p className="text-sm text-green-600">匯入完成</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* User list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            使用者列表 ({userData?.total ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-muted-foreground">載入中...</p>}

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
                  <Badge variant="outline">{user.role}</Badge>
                  {/* Show classes */}
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
                      未加入班級
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {resetUserId === user.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="password"
                        placeholder="新密碼"
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
                        確認
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setResetUserId(null)}
                      >
                        取消
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setResetUserId(user.id)}
                    >
                      重置密碼
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {userData && userData.total > 20 && (
            <div className="mt-4 flex justify-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                上一頁
              </Button>
              <span className="flex items-center text-sm text-muted-foreground">
                第 {page} 頁
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page * 20 >= userData.total}
                onClick={() => setPage(page + 1)}
              >
                下一頁
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
