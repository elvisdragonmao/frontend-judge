import { Navigate, Outlet } from "react-router";
import { useAuth } from "@/stores/auth";
import type { Role } from "@judge/shared";

interface AuthGuardProps {
  allowedRoles?: Role[];
}

export function AuthGuard({ allowedRoles }: AuthGuardProps) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
