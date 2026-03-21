import { AppLayout } from "@/layouts/app-layout";
import { AuthGuard } from "@/layouts/auth-guard";
import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Route, Routes } from "react-router";

const HomePage = lazy(() => import("@/pages/home").then(module => ({ default: module.HomePage })));
const LoginPage = lazy(() => import("@/pages/login").then(module => ({ default: module.LoginPage })));
const RegisterPage = lazy(() => import("@/pages/register").then(module => ({ default: module.RegisterPage })));
const ProfilePage = lazy(() => import("@/pages/profile").then(module => ({ default: module.ProfilePage })));
const ClassesPage = lazy(() => import("@/pages/classes").then(module => ({ default: module.ClassesPage })));
const ClassDetailPage = lazy(() =>
	import("@/pages/class-detail").then(module => ({
		default: module.ClassDetailPage
	}))
);
const AssignmentDetailPage = lazy(() =>
	import("@/pages/assignment-detail").then(module => ({
		default: module.AssignmentDetailPage
	}))
);
const AssignmentCreatePage = lazy(() =>
	import("@/pages/assignment-create").then(module => ({
		default: module.AssignmentCreatePage
	}))
);
const AssignmentEditPage = lazy(() =>
	import("@/pages/assignment-edit").then(module => ({
		default: module.AssignmentEditPage
	}))
);
const SubmissionDetailPage = lazy(() =>
	import("@/pages/submission-detail").then(module => ({
		default: module.SubmissionDetailPage
	}))
);
const AdminPage = lazy(() => import("@/pages/admin").then(module => ({ default: module.AdminPage })));
const NotFoundPage = lazy(() => import("@/pages/not-found").then(module => ({ default: module.NotFoundPage })));

function PageFallback() {
	const { t } = useTranslation();

	return (
		<div className="flex items-center justify-center h-screen">
			<p className="text-muted-foreground">{t("common.loading")}</p>
		</div>
	);
}

export function App() {
	return (
		<Suspense fallback={<PageFallback />}>
			<Routes>
				<Route element={<AppLayout />}>
					{/* Public */}
					<Route index element={<HomePage />} />
					<Route path="login" element={<LoginPage />} />
					<Route path="register" element={<RegisterPage />} />

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
						<Route path="classes/:classId/assignments/new" element={<AssignmentCreatePage />} />
						<Route path="assignments/:id/edit" element={<AssignmentEditPage />} />
					</Route>

					{/* Admin only */}
					<Route element={<AuthGuard allowedRoles={["admin"]} />}>
						<Route path="admin" element={<AdminPage />} />
					</Route>

					<Route path="*" element={<NotFoundPage />} />
				</Route>
			</Routes>
		</Suspense>
	);
}
