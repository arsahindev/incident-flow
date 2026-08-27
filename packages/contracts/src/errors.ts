import { z } from "zod";

export const apiErrorCodes = [
  "invalid_request",
  "validation_error",
  "authentication_required",
  "permission_denied",
  "rate_limited",
  "not_found",
  "conflict",
  "internal_error",
] as const;

export const apiErrorCodeSchema = z.enum(apiErrorCodes);
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

export const apiErrorIssueSchema = z.object({
  path: z.string(),
  message: z.string(),
  code: z.string().optional(),
});
export type ApiErrorIssue = z.infer<typeof apiErrorIssueSchema>;

export const apiErrorDetailSchema = z.object({
  code: apiErrorCodeSchema,
  message: z.string().min(1),
  issues: z.array(apiErrorIssueSchema).optional(),
  requestId: z.string().min(1),
});
export type ApiErrorDetail = z.infer<typeof apiErrorDetailSchema>;

export const apiErrorResponseSchema = z.object({
  error: apiErrorDetailSchema,
});
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
