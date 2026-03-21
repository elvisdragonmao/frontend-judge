import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { isSubmissionActive } from "@/lib/submission-status";
import type {
	AssignmentDetail,
	AssignmentSummary,
	ClassCumulativeScorePoint,
	ClassDetail,
	ClassSummary,
	LoginRequest,
	LoginResponse,
	MessageResponse,
	RegisterRequest,
	RegistrationStatusResponse,
	SubmissionDetail,
	SubmissionListResponse,
	UpdateRegistrationSettingsRequest,
	UserListResponse
} from "@judge/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// ─── Auth ────────────────────────────────────────────────
export function useLogin() {
	return useMutation({
		mutationFn: (data: LoginRequest) => api.post<LoginResponse>("/auth/login", data)
	});
}

export function useRegistrationStatus() {
	return useQuery({
		queryKey: queryKeys.registrationStatus(),
		queryFn: () => api.get<RegistrationStatusResponse>("/auth/registration-status")
	});
}

export function useRegister() {
	return useMutation({
		mutationFn: (data: RegisterRequest) => api.post<LoginResponse>("/auth/register", data)
	});
}

// ─── Me ──────────────────────────────────────────────────
export function useMe() {
	return useQuery({
		queryKey: queryKeys.me(),
		queryFn: () =>
			api.get<{
				id: string;
				username: string;
				displayName: string;
				role: string;
				createdAt: string;
			}>("/me"),
		retry: false
	});
}

export function useUpdateProfile() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (data: { displayName: string }) => api.patch<MessageResponse>("/me/profile", data),
		onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.me() })
	});
}

export function useChangePassword() {
	return useMutation({
		mutationFn: (data: { currentPassword: string; newPassword: string }) => api.post<MessageResponse>("/me/change-password", data)
	});
}

// ─── Classes ─────────────────────────────────────────────
export function useClasses() {
	return useQuery({
		queryKey: queryKeys.classes(),
		queryFn: () => api.get<ClassSummary[]>("/classes")
	});
}

export function useClassDetail(id: string) {
	return useQuery({
		queryKey: queryKeys.classDetail(id),
		queryFn: () => api.get<ClassDetail>(`/classes/${id}`),
		enabled: !!id
	});
}

export function useClassScoreHistory(classId: string) {
	return useQuery({
		queryKey: queryKeys.classScoreHistory(classId),
		queryFn: () => api.get<ClassCumulativeScorePoint[]>(`/classes/${classId}/score-history`),
		enabled: !!classId
	});
}

export function useCreateClass() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (data: { name: string; description: string }) => api.post("/classes", data),
		onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.classes() })
	});
}

export function useAddClassMembers(classId: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (userIds: string[]) => api.post<MessageResponse>(`/classes/${classId}/members`, { userIds }),
		onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.classDetail(classId) })
	});
}

export function useRemoveClassMember(classId: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (userId: string) => api.delete<MessageResponse>(`/classes/${classId}/members`, { userId }),
		onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.classDetail(classId) })
	});
}

// ─── Assignments ─────────────────────────────────────────
export function useAssignments(classId: string) {
	return useQuery({
		queryKey: queryKeys.assignments(classId),
		queryFn: () => api.get<AssignmentSummary[]>(`/classes/${classId}/assignments`),
		enabled: !!classId
	});
}

export function useAssignmentDetail(id: string) {
	return useQuery({
		queryKey: queryKeys.assignmentDetail(id),
		queryFn: () => api.get<AssignmentDetail>(`/assignments/${id}`),
		enabled: !!id
	});
}

export function useCreateAssignment() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (data: unknown) => api.post("/assignments", data),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["assignments"] })
	});
}

export function useUpdateAssignment(id: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (data: unknown) => api.patch(`/assignments/${id}`, data),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: queryKeys.assignmentDetail(id) });
			qc.invalidateQueries({ queryKey: ["assignments"] });
			qc.invalidateQueries({ queryKey: ["submissions"] });
		}
	});
}

// ─── Submissions ─────────────────────────────────────────
export function useSubmissions(assignmentId: string, page = 1) {
	return useQuery({
		queryKey: queryKeys.submissions(assignmentId, page),
		queryFn: () => api.get<SubmissionListResponse>(`/assignments/${assignmentId}/submissions?page=${page}`),
		enabled: !!assignmentId,
		refetchInterval: query => (query.state.data?.submissions.some(submission => isSubmissionActive(submission.status)) ? 5000 : false),
		refetchIntervalInBackground: true
	});
}

export function useSubmissionDetail(id: string) {
	return useQuery({
		queryKey: queryKeys.submissionDetail(id),
		queryFn: () => api.get<SubmissionDetail>(`/submissions/${id}`),
		enabled: !!id,
		refetchInterval: query => (query.state.data && isSubmissionActive(query.state.data.status) ? 5000 : false),
		refetchIntervalInBackground: true
	});
}

export function useRejudgeSubmission(submissionId: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: () => api.post<{ message: string; runId: string }>(`/submissions/${submissionId}/rejudge`),
		onSuccess: () => {
			qc.invalidateQueries({
				queryKey: queryKeys.submissionDetail(submissionId)
			});
			qc.invalidateQueries({ queryKey: ["submissions"] });
		}
	});
}

export function useSubmit(assignmentId: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (formData: FormData) => api.upload(`/assignments/${assignmentId}/submit`, formData),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["submissions"] });
			qc.invalidateQueries({
				queryKey: queryKeys.assignmentDetail(assignmentId)
			});
		}
	});
}

// ─── Admin ───────────────────────────────────────────────
export function useUsers(page = 1) {
	return useQuery({
		queryKey: queryKeys.users(page),
		queryFn: () => api.get<UserListResponse>(`/admin/users?page=${page}`)
	});
}

export function useAdminRegistrationSettings() {
	return useQuery({
		queryKey: queryKeys.adminRegistrationSettings(),
		queryFn: () => api.get<RegistrationStatusResponse>("/admin/settings/registration")
	});
}

export function useUpdateRegistrationSettings() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (data: UpdateRegistrationSettingsRequest) => api.patch<RegistrationStatusResponse>("/admin/settings/registration", data),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: queryKeys.adminRegistrationSettings() });
			qc.invalidateQueries({ queryKey: queryKeys.registrationStatus() });
		}
	});
}

export function useCreateUser() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (data: unknown) => api.post("/admin/users", data),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] })
	});
}

export function useBulkImport() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (data: { users: unknown[] }) => api.post("/admin/users/bulk-import", data),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] })
	});
}

export function useResetPassword() {
	return useMutation({
		mutationFn: (data: { userId: string; newPassword: string }) => api.post("/admin/users/reset-password", data)
	});
}
