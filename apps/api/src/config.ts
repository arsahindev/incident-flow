import { resolve } from "node:path";

import { config as loadEnvironmentFile } from "dotenv";
import { z } from "zod";

loadEnvironmentFile({ path: resolve(process.cwd(), "../../.env"), quiet: true });

const environmentSchema = z.object({
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().max(65_535).default(4000),
  WEB_ORIGIN: z.url().default("http://localhost:3000"),
  DATABASE_URL: z.url()
    .default(
      "postgresql://incidentflow:incidentflow_dev@localhost:5432/incidentflow",
    ),
  DEVELOPMENT_ORGANIZATION_SLUG: z.string().min(1).default("incidentflow-dev"),
});

export function loadConfig(environment: NodeJS.ProcessEnv = process.env) {
  return environmentSchema.parse(environment);
}
