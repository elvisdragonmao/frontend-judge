import { Link } from "react-router";
import { useAuth } from "@/stores/auth";
import { Button } from "@/components/ui/button";

export function HomePage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="flex flex-col items-center py-20">
      <h1 className="text-4xl font-bold">emjudge</h1>
      <p className="mt-4 max-w-lg text-center text-lg text-muted-foreground">
        前端作業繳交與自動評測平台。上傳你的 HTML / CSS / JS 或 React 作業，
        系統會自動執行 Playwright 測試並產出分數、截圖與評測報告。
      </p>
      <div className="mt-8">
        {isAuthenticated ? (
          <Button asChild>
            <Link to="/classes">進入班級</Link>
          </Button>
        ) : (
          <Button asChild>
            <Link to="/login">登入</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
