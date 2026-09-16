import { ConfigurationError, configurationFailureLog } from "./lib/env/schema";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    const { getServerEnvironment } = await import("./lib/env/server");
    getServerEnvironment();
  } catch (error) {
    if (error instanceof ConfigurationError) {
      console.error(JSON.stringify(configurationFailureLog(error)));
    }
    throw error;
  }
}
