import type { NextConfig } from "next";

import {
  ConfigurationError,
  configurationFailureLog,
  parseConfiguration,
  webClientEnvironmentSchema,
  webServerEnvironmentSchema,
} from "./src/lib/env/schema";

try {
  parseConfiguration(
    "incidentflow-web",
    webServerEnvironmentSchema(process.env.NODE_ENV),
    { API_URL: process.env.API_URL },
  );
  parseConfiguration(
    "incidentflow-web",
    webClientEnvironmentSchema(process.env.NODE_ENV),
    { NEXT_PUBLIC_REALTIME_URL: process.env.NEXT_PUBLIC_REALTIME_URL },
  );
} catch (error) {
  if (error instanceof ConfigurationError) {
    console.error(JSON.stringify(configurationFailureLog(error)));
  }
  throw error;
}

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
