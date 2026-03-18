import { Routes, Route } from "react-router";
import { AppLayout } from "@/layouts/app-layout";
import { AuthGuard } from "@/layouts/auth-guard";
import { HomePage } from "@/pages/home";
import { LoginPage } from "@/pages/login";
import { ProfilePage } from "@/pages/profile";
import { ClassesPage } from "@/pages/classes";
import { ClassDetailPage } from "@/pages/class-detail";
import { AssignmentDetailPage } from "@/pages/assignment-detail";
import { AssignmentCreatePage } from "@/pages/assignment-create";
import { AssignmentEditPage } from "@/pages/assignment-edit";
import { SubmissionDetailPage } from "@/pages/submission-detail";
import { AdminPage } from "@/pages/admin";

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* Public */}
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />

        {/* Authenticated */}
        <Route element={<AuthGuard />}>
          <Route path="profile" element={<ProfilePage />} />
          <Route path="classes" element={<ClassesPage />} />
          <Route path="classes/:id" element={<ClassDetailPage />} />
          <Route path="assignments/:id" element={<AssignmentDetailPage />} />
          <Route path="submissions/:id" element={<SubmissionDetailPage />} />
        </Route>

        {/* Staff only */}
        <Route element={<AuthGuard allowedRoles={["admin", "teacher"]} />}>
          <Route
            path="classes/:classId/assignments/new"
            element={<AssignmentCreatePage />}
          />
          <Route path="assignments/:id/edit" element={<AssignmentEditPage />} />
        </Route>

        {/* Admin only */}
        <Route element={<AuthGuard allowedRoles={["admin"]} />}>
          <Route path="admin" element={<AdminPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
