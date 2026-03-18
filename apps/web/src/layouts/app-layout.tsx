import { Link, Outlet, useNavigate } from "react-router";
import { useAuth } from "@/stores/auth";
import { Button } from "@/components/ui/button";
import { isStaff } from "@judge/shared";

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-lg font-bold">
              emjudge
            </Link>
            {user && (
              <nav className="flex items-center gap-4 text-sm">
                <Link
                  to="/classes"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  班級
                </Link>
                {isStaff(user.role) && (
                  <Link
                    to="/admin"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    管理
                  </Link>
                )}
              </nav>
            )}
          </div>
          {user && (
            <div className="flex items-center gap-3">
              <Link
                to="/profile"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                {user.displayName}
              </Link>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                登出
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
