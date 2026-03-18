import { z } from "zod";

export const PaginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof PaginationQuery>;

export const IdParam = z.object({
  id: z.string().uuid(),
});
export type IdParam = z.infer<typeof IdParam>;

export const MessageResponse = z.object({
  message: z.string(),
});
export type MessageResponse = z.infer<typeof MessageResponse>;

export const ErrorResponse = z.object({
  error: z.string(),
  statusCode: z.number(),
  details: z.unknown().optional(),
});
export type ErrorResponse = z.infer<typeof ErrorResponse>;
