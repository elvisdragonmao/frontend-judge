import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/stores/auth";
import { useLogin } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginPage() {
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
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center text-xl">登入</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">帳號</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="請輸入帳號"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">密碼</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="請輸入密碼"
              />
            </div>
            {loginMutation.isError && (
              <p className="text-sm text-destructive">帳號或密碼錯誤</p>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? "登入中..." : "登入"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              此平台不開放註冊，請聯繫管理員取得帳號。
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
