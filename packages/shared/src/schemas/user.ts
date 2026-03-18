import { z } from "zod";

export const UserSummary = z.object({
  id: z.string().uuid(),
  username: z.string(),
  displayName: z.string(),
  role: z.enum(["admin", "teacher", "student"]),
  createdAt: z.string().datetime(),
});
export type UserSummary = z.infer<typeof UserSummary>;

export const CreateUserRequest = z.object({
  username: z.string().min(2).max(50),
  password: z.string().min(6),
  displayName: z.string().min(1).max(50),
  role: z.enum(["admin", "teacher", "student"]).default("student"),
});
export type CreateUserRequest = z.infer<typeof CreateUserRequest>;

export const BulkImportRow = z.object({
  username: z.string().min(2).max(50),
  password: z.string().min(6),
  displayName: z.string().min(1).max(50),
  role: z.enum(["admin", "teacher", "student"]).default("student"),
});
export type BulkImportRow = z.infer<typeof BulkImportRow>;

export const BulkImportRequest = z.object({
  users: z.array(BulkImportRow).min(1).max(500),
});
export type BulkImportRequest = z.infer<typeof BulkImportRequest>;

export const ResetPasswordRequest = z.object({
  userId: z.string().uuid(),
  newPassword: z.string().min(6),
});
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequest>;

export const UserListResponse = z.object({
  users: z.array(UserSummary),
  total: z.number(),
});
export type UserListResponse = z.infer<typeof UserListResponse>;
