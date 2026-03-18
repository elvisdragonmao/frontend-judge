import { z } from "zod";

// ─── Login ───────────────────────────────────────────────
export const LoginRequest = z.object({
  username: z.string().min(1, "帳號不得為空"),
  password: z.string().min(1, "密碼不得為空"),
});
export type LoginRequest = z.infer<typeof LoginRequest>;

export const LoginResponse = z.object({
  token: z.string(),
  user: z.object({
    id: z.string().uuid(),
    username: z.string(),
    displayName: z.string(),
    role: z.enum(["admin", "teacher", "student"]),
  }),
});
export type LoginResponse = z.infer<typeof LoginResponse>;

// ─── Change password ─────────────────────────────────────
export const ChangePasswordRequest = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6, "密碼至少 6 個字"),
});
export type ChangePasswordRequest = z.infer<typeof ChangePasswordRequest>;

// ─── Update profile ──────────────────────────────────────
export const UpdateProfileRequest = z.object({
  displayName: z.string().min(1, "暱稱不得為空").max(50),
});
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequest>;

// ─── JWT payload ─────────────────────────────────────────
export const JwtPayload = z.object({
  sub: z.string().uuid(),
  role: z.enum(["admin", "teacher", "student"]),
  iat: z.number().optional(),
  exp: z.number().optional(),
});
export type JwtPayload = z.infer<typeof JwtPayload>;
