import { z } from "zod";

export type ConfigurationIssue = {
  variable: string;
  reason: string;
};

export class ConfigurationError extends Error {
  constructor(
    readonly service: string,
    readonly issues: readonly ConfigurationIssue[],
  ) {
    super(
      `Invalid ${service} configuration: ${issues
        .map((issue) => `${issue.variable}: ${issue.reason}`)
        .join("; ")}`,
    );
    this.name = "ConfigurationError";
  }
}

function isLoopbackHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function httpOriginSchema(nodeEnvironment: string | undefined) {
  return z
    .string({ error: "is required" })
    .trim()
    .min(1, "is required")
    .pipe(z.url("must be a valid absolute URL"))
    .superRefine((value, context) => {
      const url = new URL(value);

      if (url.protocol !== "http:" && url.protocol !== "https:") {
        context.addIssue({
          code: "custom",
          message: "must use http or https",
        });
      }
      if (url.username || url.password) {
        context.addIssue({
          code: "custom",
          message: "must not contain credentials",
        });
      }
      if (url.pathname !== "/" || url.search || url.hash) {
        context.addIssue({
          code: "custom",
          message: "must be an origin without a path, query, or fragment",
        });
      }
      if (
        nodeEnvironment === "production" &&
        url.protocol !== "https:" &&
        !isLoopbackHostname(url.hostname)
      ) {
        context.addIssue({
          code: "custom",
          message: "must use https outside local development",
        });
      }
    })
    .transform((value) => new URL(value).origin);
}

export function webServerEnvironmentSchema(nodeEnvironment: string | undefined) {
  return z.object({
    API_URL: httpOriginSchema(nodeEnvironment),
  });
}

export function webClientEnvironmentSchema(nodeEnvironment: string | undefined) {
  return z.object({
    NEXT_PUBLIC_REALTIME_URL: httpOriginSchema(nodeEnvironment),
  });
}

export function parseConfiguration<T>(
  service: string,
  schema: z.ZodType<T>,
  environment: unknown,
): T {
  const result = schema.safeParse(environment);
  if (result.success) return result.data;

  throw new ConfigurationError(
    service,
    result.error.issues.map((issue) => ({
      variable: issue.path.map(String).join(".") || "environment",
      reason: issue.message,
    })),
  );
}

export function configurationFailureLog(error: ConfigurationError) {
  return {
    level: "fatal",
    event: "configuration_validation_failed",
    service: error.service,
    issues: error.issues,
  };
}
