import "server-only";

import { parseConfiguration, webServerEnvironmentSchema } from "./schema";

export function parseServerEnvironment(
  environment: NodeJS.ProcessEnv,
  nodeEnvironment = environment.NODE_ENV,
) {
  return parseConfiguration(
    "incidentflow-web",
    webServerEnvironmentSchema(nodeEnvironment),
    environment,
  );
}

let cachedEnvironment: ReturnType<typeof parseServerEnvironment> | undefined;

export function getServerEnvironment() {
  cachedEnvironment ??= parseServerEnvironment(process.env);
  return cachedEnvironment;
}
