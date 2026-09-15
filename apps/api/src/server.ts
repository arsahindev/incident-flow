import { ConfigurationError, configurationFailureLog, loadConfig } from "./config.js";
import { createRuntime } from "./runtime.js";

try {
  const config = loadConfig(process.env);
  const app = createRuntime(config);
  await app.listen({ host: config.API_HOST, port: config.API_PORT });
} catch (error) {
  if (error instanceof ConfigurationError) {
    console.error(JSON.stringify(configurationFailureLog(error)));
  } else {
    console.error(error);
  }
  process.exitCode = 1;
}
