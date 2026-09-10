import type { ZodType } from "zod";

import {
  apiErrorResponseSchema,
  type ApiErrorIssue,
} from "@incidentflow/contracts";

export type ClientApiErrorCode =
  | "network_error"
  | "invalid_response"
  | "unknown_error"
  | import("@incidentflow/contracts").ApiErrorCode;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: ClientApiErrorCode,
    readonly issues: ApiErrorIssue[] = [],
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function validationIssues(error: { issues: readonly { path: PropertyKey[]; message: string; code: string }[] }) {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
    code: issue.code,
  }));
}

export async function parseApiResponse<T>(
  response: Response,
  schema?: ZodType<T>,
): Promise<T> {
  const headerRequestId = response.headers.get("x-request-id") ?? undefined;
  if (response.status === 204) return undefined as T;

  const responseText = await response.text();
  let body: unknown;
  try {
    body = responseText ? JSON.parse(responseText) : undefined;
  } catch {
    if (!response.ok) {
      throw new ApiError(
        "The API request failed",
        response.status,
        "unknown_error",
        [],
        headerRequestId,
      );
    }
    throw new ApiError(
      "The API returned malformed JSON",
      response.status,
      "invalid_response",
      [],
      headerRequestId,
    );
  }

  if (!response.ok) {
    const parsedError = apiErrorResponseSchema.safeParse(body);
    if (parsedError.success) {
      throw new ApiError(
        parsedError.data.error.message,
        response.status,
        parsedError.data.error.code,
        parsedError.data.error.issues,
        parsedError.data.error.requestId,
      );
    }
    throw new ApiError(
      "The API request failed",
      response.status,
      "unknown_error",
      [],
      headerRequestId,
    );
  }

  if (body === undefined) {
    throw new ApiError(
      "The API returned an empty response",
      response.status,
      "invalid_response",
      [],
      headerRequestId,
    );
  }

  if (!schema) return body as T;
  const parsedBody = schema.safeParse(body);
  if (!parsedBody.success) {
    throw new ApiError(
      "The API returned an unexpected response",
      response.status,
      "invalid_response",
      validationIssues(parsedBody.error),
      headerRequestId,
    );
  }
  return parsedBody.data;
}
