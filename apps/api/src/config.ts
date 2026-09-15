import { resolve } from "node:path";

import { config as loadEnvironmentFile } from "dotenv";
import { z } from "zod";
import { publicDemoEnvironmentSchema } from "@incidentflow/contracts";

const defaultEnvironmentFilePath = resolve(import.meta.dirname, "../.env");

export type ConfigurationIssue = {
  variable: string;
  reason: string;
};
export class ConfigurationError extends Error {
  constructor(readonly issues: readonly ConfigurationIssue[]) {
    super(
      `Invalid incidentflow-api configuration: ${issues
        .map((issue) => `${issue.variable}: ${issue.reason}`)
        .join("; ")}`,
    );
    this.name = "ConfigurationError";
  }
}

const requiredString = z
  .string({ error: "is required" })
  .trim()
  .min(1, "is required");

const databaseUrlSchema = requiredString
  .pipe(z.url("must be a valid PostgreSQL URL"))
  .superRefine((value, context) => {
    const protocol = new URL(value).protocol;
    if (protocol !== "postgresql:" && protocol !== "postgres:") {
      context.addIssue({
        code: "custom",
        message: "must use the postgresql or postgres protocol",
      });
    }
  });

const webOriginSchema = requiredString
  .pipe(z.url("must be a valid absolute URL"))
  .superRefine((value, context) => {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      context.addIssue({ code: "custom", message: "must use http or https" });
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
  })
  .transform((value) => new URL(value).origin);

const passwordPepperSchema = requiredString
  .superRefine((value, context) => {
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) {
      context.addIssue({
        code: "custom",
        message: "must be valid base64",
      });
      return;
    }
    if (Buffer.from(value, "base64").byteLength < 32) {
      context.addIssue({
        code: "custom",
        message: "must contain at least 32 random bytes",
      });
    }
  })
  .transform((value) => Buffer.from(value, "base64"));

const databaseEnvironmentSchema = z.object({
  DATABASE_URL: databaseUrlSchema,
});

const seedEnvironmentSchema = databaseEnvironmentSchema.extend({
  PASSWORD_PEPPER: passwordPepperSchema,
  PUBLIC_DEMO_ENVIRONMENT: publicDemoEnvironmentSchema.optional(),
});

const environmentSchema = z.object({
  API_HOST: z.string().trim().min(1).default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().max(65_535).default(4000),
  WEB_ORIGIN: webOriginSchema,
  PASSWORD_PEPPER: passwordPepperSchema,
  DATABASE_URL: databaseUrlSchema,
  REALTIME_MAX_INBOUND_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .max(65_536)
    .default(4_096),
  REALTIME_MAX_OUTBOUND_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .max(16_384)
    .default(1_024),
  REALTIME_MAX_INCIDENT_ROOMS: z.coerce
    .number()
    .int()
    .positive()
    .max(100)
    .default(10),
  REALTIME_MAX_PENDING_PACKETS: z.coerce
    .number()
    .int()
    .positive()
    .max(1_000)
    .default(20),
  REALTIME_SESSION_REVALIDATE_MS: z.coerce
    .number()
    .int()
    .positive()
    .min(1_000)
    .max(300_000)
    .default(60_000),
});

function parseEnvironment<T>(schema: z.ZodType<T>, environment: NodeJS.ProcessEnv) {
  const result = schema.safeParse(environment);
  if (result.success) return result.data;

  throw new ConfigurationError(
    result.error.issues.map((issue) => ({
      variable: issue.path.map(String).join(".") || "environment",
      reason: issue.message,
    })),
  );
}

function environmentWithFile(
  environment: NodeJS.ProcessEnv,
  environmentFilePath: string,
  required: boolean,
) {
  const { error } = loadEnvironmentFile({
    path: environmentFilePath,
    processEnv: environment,
    quiet: true,
  });
  if (!error) return environment;

  const errorCode = "code" in error ? String(error.code) : "UNKNOWN";
  if (!required && errorCode === "ENOENT") return environment;

  throw new ConfigurationError([
    {
      variable: "ENV_FILE",
      reason: `could not be read (${errorCode})`,
    },
  ]);
}

function resolveEnvironment(
  environment: NodeJS.ProcessEnv,
  environmentFilePath?: string,
) {
  if (environmentFilePath !== undefined) {
    return environmentWithFile(environment, environmentFilePath, true);
  }
  if (environment === process.env) {
    return environmentWithFile(environment, defaultEnvironmentFilePath, false);
  }
  return environment;
}

export function loadConfig(
  environment: NodeJS.ProcessEnv = process.env,
  environmentFilePath?: string,
) {
  return parseEnvironment(
    environmentSchema,
    resolveEnvironment(environment, environmentFilePath),
  );
}

export function loadDatabaseConfig(
  environment: NodeJS.ProcessEnv = process.env,
  environmentFilePath?: string,
) {
  return parseEnvironment(
    databaseEnvironmentSchema,
    resolveEnvironment(environment, environmentFilePath),
  );
}

export function loadSeedConfig(
  environment: NodeJS.ProcessEnv = process.env,
  environmentFilePath?: string,
) {
  return parseEnvironment(
    seedEnvironmentSchema,
    resolveEnvironment(environment, environmentFilePath),
  );
}

export function configurationFailureLog(error: ConfigurationError) {
  return {
    level: "fatal",
    event: "configuration_validation_failed",
    service: "incidentflow-api",
    issues: error.issues,
  };
}
