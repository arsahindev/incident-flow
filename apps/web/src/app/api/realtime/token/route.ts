import { requestApi } from "@/lib/api";
import { realtimeTokenResponse } from "@/lib/realtime-token";

export async function POST() {
  // requestApi reads the host-only HttpOnly cookie and authenticates server to server.
  return realtimeTokenResponse(() => requestApi("/v1/realtime/token", {
    method: "POST",
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(10_000),
  }));
}
