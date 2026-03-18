import { useState } from "react";
import { useAuth } from "@/stores/auth";
import { updateUser } from "@/stores/auth";
import { useUpdateProfile, useChangePassword } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ProfilePage() {
  const { user } = useAuth();
  const updateProfileMutation = useUpdateProfile();
  const changePasswordMutation = useChangePassword();

  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [profileMsg, setProfileMsg] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(
      { displayName },
      {
        onSuccess: () => {
          updateUser({ displayName });
          setProfileMsg("暱稱已更新");
        },
        onError: () => setProfileMsg("更新失敗"),
      },
    );
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    changePasswordMutation.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setPasswordMsg("密碼已更新");
          setCurrentPassword("");
          setNewPassword("");
        },
        onError: () => setPasswordMsg("密碼更新失敗，請檢查目前密碼是否正確"),
      },
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">個人設定</h1>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile info */}
        <Card>
          <CardHeader>
            <CardTitle>帳號資訊</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <span className="text-sm text-muted-foreground">帳號:</span>{" "}
              <span className="text-sm font-medium">{user?.username}</span>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">角色:</span>{" "}
              <span className="text-sm font-medium">{user?.role}</span>
            </div>
            <form onSubmit={handleUpdateProfile} className="space-y-3 pt-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">暱稱</label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              {profileMsg && (
                <p className="text-sm text-muted-foreground">{profileMsg}</p>
              )}
              <Button
                type="submit"
                size="sm"
                disabled={updateProfileMutation.isPending}
              >
                更新暱稱
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Change password */}
        <Card>
          <CardHeader>
            <CardTitle>修改密碼</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">目前密碼</label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">新密碼</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                />
              </div>
              {passwordMsg && (
                <p className="text-sm text-muted-foreground">{passwordMsg}</p>
              )}
              <Button
                type="submit"
                size="sm"
                disabled={changePasswordMutation.isPending}
              >
                更新密碼
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
