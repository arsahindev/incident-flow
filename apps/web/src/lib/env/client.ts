import { parseConfiguration, webClientEnvironmentSchema } from "./schema";

export function parseClientEnvironment(
  environment: { NEXT_PUBLIC_REALTIME_URL?: string },
  nodeEnvironment = process.env.NODE_ENV,
) {
  return parseConfiguration(
    "incidentflow-web",
    webClientEnvironmentSchema(nodeEnvironment),
    environment,
  );
}

export const clientEnvironment = parseClientEnvironment({
  NEXT_PUBLIC_REALTIME_URL: process.env.NEXT_PUBLIC_REALTIME_URL,
});
