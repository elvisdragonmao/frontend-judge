import { z } from "zod";
import { UserSummary } from "./user.js";

export const CreateClassRequest = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).default(""),
});
export type CreateClassRequest = z.infer<typeof CreateClassRequest>;

export const UpdateClassRequest = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});
export type UpdateClassRequest = z.infer<typeof UpdateClassRequest>;

export const ClassSummary = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  memberCount: z.number(),
  assignmentCount: z.number(),
  createdAt: z.string().datetime(),
});
export type ClassSummary = z.infer<typeof ClassSummary>;

export const ClassDetail = ClassSummary.extend({
  members: z.array(UserSummary),
});
export type ClassDetail = z.infer<typeof ClassDetail>;

export const AddClassMembersRequest = z.object({
  userIds: z.array(z.string().uuid()).min(1),
});
export type AddClassMembersRequest = z.infer<typeof AddClassMembersRequest>;

export const RemoveClassMemberRequest = z.object({
  userId: z.string().uuid(),
});
export type RemoveClassMemberRequest = z.infer<typeof RemoveClassMemberRequest>;

// ─── Score history for chart ─────────────────────────────
export const ScoreHistoryPoint = z.object({
  date: z.string(),
  score: z.number(),
  assignmentTitle: z.string(),
});
export type ScoreHistoryPoint = z.infer<typeof ScoreHistoryPoint>;

export const ClassScoreHistory = z.object({
  classId: z.string().uuid(),
  points: z.array(ScoreHistoryPoint),
});
export type ClassScoreHistory = z.infer<typeof ClassScoreHistory>;
