import type { ApiErrorCode, ApiErrorIssue } from "@incidentflow/contracts";
import type { FastifyReply } from "fastify";
import type { ZodError } from "zod";

export function sendApiError(
  reply: FastifyReply,
  status: number,
  code: ApiErrorCode,
  message: string,
  issues?: ApiErrorIssue[],
) {
  return reply.code(status).send({
    error: {
      code,
      message,
      ...(issues?.length ? { issues } : {}),
      requestId: String(reply.request.id),
    },
  });
}

export function sendValidationError(reply: FastifyReply, error: ZodError) {
  return sendApiError(
    reply,
    400,
    "validation_error",
    "Validation failed",
    error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
      code: issue.code,
    })),
  );
}
