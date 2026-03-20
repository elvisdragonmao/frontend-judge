import { useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { PageTitle } from "@/components/page-title";
import { useAuth } from "@/stores/auth";
import { useLogin } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginPage() {
  const { t } = useTranslation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();
  const loginMutation = useLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(
      { username, password },
      {
        onSuccess: (data) => {
          login(data.token, data.user);
          navigate("/classes");
        },
      },
    );
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <PageTitle title={t("pages.login.title")} />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center text-xl">
            {t("pages.login.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t("pages.login.username")}
              </label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t("pages.login.usernamePlaceholder")}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t("pages.login.password")}
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("pages.login.passwordPlaceholder")}
              />
            </div>
            {loginMutation.isError && (
              <p className="text-sm text-destructive">
                {t("pages.login.invalidCredentials")}
              </p>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending
                ? t("pages.login.submitting")
                : t("pages.login.submit")}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              {t("pages.login.hint")}
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
