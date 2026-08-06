import { z } from "zod";

const environmentSchema = z.object({
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().max(65_535).default(4000),
});

export function loadConfig(environment: NodeJS.ProcessEnv = process.env) {
  return environmentSchema.parse(environment);
}
