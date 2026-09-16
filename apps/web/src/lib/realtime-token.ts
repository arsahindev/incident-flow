import { z } from "zod";
import { ApiError } from "./api-response";

export const realtimeTokenSchema = z.object({
  token: z.string().min(1).max(16_384),
  channel: z.string().regex(/^incidentflow:organization:[0-9a-f-]{36}$/i),
});

export async function realtimeTokenResponse(issue: () => Promise<unknown>) {
  const headers = { "cache-control": "no-store" };
  try {
    return Response.json(realtimeTokenSchema.parse(await issue()), { headers });
  } catch (error) {
    const status =
      error instanceof ApiError && [401, 403].includes(error.status)
        ? error.status
        : 503;
    return Response.json(
      { error: "Live updates unavailable" },
      { status, headers },
    );
  }
}
