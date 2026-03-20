import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PageTitle } from "@/components/page-title";
import { useAuth } from "@/stores/auth";
import { updateUser } from "@/stores/auth";
import { useUpdateProfile, useChangePassword } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ProfilePage() {
  const { t } = useTranslation();
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
          setProfileMsg(t("pages.profile.displayNameUpdated"));
        },
        onError: () =>
          setProfileMsg(t("pages.profile.displayNameUpdateFailed")),
      },
    );
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    changePasswordMutation.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setPasswordMsg(t("pages.profile.passwordUpdated"));
          setCurrentPassword("");
          setNewPassword("");
        },
        onError: () => setPasswordMsg(t("pages.profile.passwordUpdateFailed")),
      },
    );
  };

  return (
    <div className="space-y-6">
      <PageTitle title={t("pages.profile.title")} />
      <h1 className="text-2xl font-bold">{t("pages.profile.title")}</h1>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile info */}
        <Card>
          <CardHeader>
            <CardTitle>{t("pages.profile.accountInfo")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <span className="text-sm text-muted-foreground">
                {t("pages.profile.username")}:
              </span>{" "}
              <span className="text-sm font-medium">{user?.username}</span>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">
                {t("pages.profile.role")}:
              </span>{" "}
              <span className="text-sm font-medium">
                {user?.role ? t(`pages.profile.roles.${user.role}`) : ""}
              </span>
            </div>
            <form onSubmit={handleUpdateProfile} className="space-y-3 pt-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {t("pages.profile.displayName")}
                </label>
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
                {t("pages.profile.updateDisplayName")}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Change password */}
        <Card>
          <CardHeader>
            <CardTitle>{t("pages.profile.changePassword")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {t("pages.profile.currentPassword")}
                </label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {t("pages.profile.newPassword")}
                </label>
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
                {t("pages.profile.updatePassword")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
