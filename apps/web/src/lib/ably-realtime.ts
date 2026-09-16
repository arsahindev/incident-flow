import { Realtime, type ClientOptions } from "ably";
import { realtimeTokenSchema } from "./realtime-token";
import type { SocketConnectionStatus } from "./realtime";

export function connectAblyRealtime(
  handlers: {
    status: (status: SocketConnectionStatus) => void;
    signal: (payload: unknown) => void;
    refetch: () => void;
    authenticationRequired: () => void;
  },
  dependencies: {
    fetch?: typeof fetch;
    createClient?: (options: ClientOptions) => Realtime;
  } = {},
) {
  let closed = false;
  let channelName: string | undefined;
  const pending = new AbortController();
  const failAuthentication = () => {
    if (closed) return;
    closed = true;
    pending.abort();
    client.close();
    handlers.authenticationRequired();
  };
  const client = (
    dependencies.createClient ?? ((options) => new Realtime(options))
  )({
    autoConnect: false,
    logLevel: 0,
    authCallback: async (_params, callback) => {
      try {
        const response = await (dependencies.fetch ?? fetch)(
          "/api/realtime/token",
          {
            method: "POST",
            credentials: "same-origin",
            cache: "no-store",
            signal: AbortSignal.any([
              pending.signal,
              AbortSignal.timeout(10_000),
            ]),
          },
        );
        if (closed) return;
        if (response.status === 401 || response.status === 403) {
          callback("Authentication required", null);
          failAuthentication();
          return;
        }
        if (!response.ok) throw new Error("Token request failed");
        const issued = realtimeTokenSchema.parse(await response.json());
        if (closed) return;
        if (channelName && channelName !== issued.channel) {
          callback("Session organization changed", null);
          failAuthentication();
          return;
        }
        if (!channelName) {
          channelName = issued.channel;
          const channel = client.channels.get(channelName);
          channel.on("attached", () => {
            if (closed) return;
            handlers.status("connected");
            // Also refetch on first attachment to cover the render-to-subscribe gap.
            handlers.refetch();
          });
          channel.on("update", (change) => {
            if (!closed && !change.resumed) handlers.refetch();
          });
          for (const event of ["detached", "suspended", "failed"] as const) {
            channel.on(event, () => {
              if (!closed) handlers.status("disconnected");
            });
          }
          void channel
            .subscribe("realtime:incident", (message) => {
              if (!closed) handlers.signal(message.data);
            })
            .catch(() => {
              if (!closed) handlers.status("disconnected");
            });
        }
        callback(null, issued.token);
      } catch {
        if (!closed) {
          handlers.status("disconnected");
          callback("Live updates authorization unavailable", null);
        }
      }
    },
  });
  client.connection.on((change) => {
    if (closed) return;
    if (change.current === "connected") {
      if (
        channelName &&
        client.channels.get(channelName).state === "attached"
      ) {
        handlers.status("connected");
        handlers.refetch();
      }
    } else {
      handlers.status(
        change.current === "connecting" ? "connecting" : "disconnected",
      );
    }
  });
  client.connect();
  return () => {
    closed = true;
    pending.abort();
    client.close();
  };
}
