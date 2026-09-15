import { loadConfig } from "../src/config.js";
import { createFunctionHandler } from "../src/function-handler.js";
import { createApplicationRuntime } from "../src/application-runtime.js";
import { AblyRealtimeAdapter } from "../src/realtime/ably-adapter.js";

// Reuse the application and pool across requests; never open a listening socket here.
export default createFunctionHandler(() => {
  const config = loadConfig({ ...process.env, VERCEL: "1" });
  return createApplicationRuntime(config, () => new AblyRealtimeAdapter({
    apiKey: config.ABLY_API_KEY!,
    maxOutboundPayloadBytes: config.REALTIME_MAX_OUTBOUND_BYTES,
  }));
});
