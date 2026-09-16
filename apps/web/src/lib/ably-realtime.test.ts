import assert from "node:assert/strict";
import { test } from "node:test";
import type { ClientOptions, Realtime } from "ably";
import { connectAblyRealtime } from "./ably-realtime";
import { realtimeTokenResponse } from "./realtime-token";
import { ApiError } from "./api-response";

const issued = {
  token: "test-token",
  channel: "incidentflow:organization:11111111-1111-4111-8111-111111111111",
};

function harness(fetcher: typeof fetch = async () => Response.json(issued)) {
  let options: ClientOptions;
  let closed = 0;
  let refetches = 0;
  let rejected = 0;
  const statuses: string[] = [];
  const signals: unknown[] = [];
  const channelEvents = new Map<
    string,
    (change: { resumed?: boolean }) => void
  >();
  let messageHandler: (message: { data: unknown }) => void;
  let connectionHandler: (change: { current: string }) => void;
  const channel = {
    state: "attached",
    on: (event: string, callback: (change: { resumed?: boolean }) => void) =>
      channelEvents.set(event, callback),
    subscribe: async (_event: string, callback: typeof messageHandler) => {
      messageHandler = callback;
    },
  };
  const cleanup = connectAblyRealtime(
    {
      status: (status) => statuses.push(status),
      signal: (signal) => signals.push(signal),
      refetch: () => {
        refetches++;
      },
      authenticationRequired: () => {
        rejected++;
      },
    },
    {
      fetch: fetcher,
      createClient: (configuration) => {
        options = configuration;
        return {
          connect() {},
          close() {
            closed++;
          },
          channels: {
            get: (name: string) => {
              assert.equal(name, issued.channel);
              return channel;
            },
          },
          connection: {
            on: (callback: typeof connectionHandler) => {
              connectionHandler = callback;
            },
          },
        } as unknown as Realtime;
      },
    },
  );
  return {
    cleanup,
    statuses,
    signals,
    counts: () => ({ closed, refetches, rejected }),
    authorize: async () => {
      let result: unknown;
      await options.authCallback!({}, (error, token) => {
        result = { error, token };
      });
      return result;
    },
    attach: () => channelEvents.get("attached")!({}),
    gap: () => channelEvents.get("update")!({ resumed: false }),
    reconnect: () => connectionHandler({ current: "connected" }),
    message: (data: unknown) => messageHandler({ data }),
  };
}

test("token bridge preserves auth status, sanitizes failures and never caches credentials", async () => {
  const response = await realtimeTokenResponse(async () => ({
    ...issued,
    private: "hidden",
  }));
  assert.deepEqual(await response.json(), issued);
  assert.equal(response.headers.get("cache-control"), "no-store");
  for (const status of [401, 403, 500]) {
    const failure = await realtimeTokenResponse(async () => {
      throw new ApiError("private", status, "unknown_error");
    });
    assert.equal(failure.status, status === 500 ? 503 : status);
    assert.doesNotMatch(await failure.text(), /private/);
    assert.equal(failure.headers.get("cache-control"), "no-store");
  }
  assert.equal(
    (
      await realtimeTokenResponse(async () => ({
        token: "private",
        channel: "*",
      }))
    ).status,
    503,
  );
});

test("Ably renews via same-origin POST and refetches after attachment and reconnect gaps", async () => {
  let requests = 0;
  const h = harness(async (url, init) => {
    assert.equal(url, "/api/realtime/token");
    assert.equal(init!.credentials, "same-origin");
    assert.equal(init!.method, "POST");
    assert.equal(init!.cache, "no-store");
    assert.equal(init!.headers, undefined);
    requests++;
    return Response.json(issued);
  });
  assert.deepEqual(await h.authorize(), { error: null, token: issued.token });
  await h.authorize();
  assert.equal(requests, 2);
  h.attach();
  h.gap();
  h.reconnect();
  h.message({ version: 2 });
  assert.equal(h.counts().refetches, 3);
  assert.deepEqual(h.signals, [{ version: 2 }]);
  h.cleanup();
  h.attach();
  h.message("late");
  assert.equal(h.counts().refetches, 3);
  assert.equal(h.signals.length, 1);
});

test("revoked auth and changed tenant close Ably; temporary outages do not log out", async () => {
  for (const status of [401, 403, 503]) {
    const h = harness(async () => new Response(null, { status }));
    await h.authorize();
    assert.equal(h.counts().rejected, status === 503 ? 0 : 1);
    h.cleanup();
  }
  let changed = false;
  const h = harness(async () =>
    Response.json(
      changed
        ? { ...issued, channel: issued.channel.replace(/1$/, "2") }
        : issued,
    ),
  );
  await h.authorize();
  changed = true;
  await h.authorize();
  assert.equal(h.counts().rejected, 1);
  h.cleanup();
});

test("unmount aborts pending authorization without creating a subscription", async () => {
  let release: (response: Response) => void;
  let signal: AbortSignal | undefined;
  const h = harness(async (_url, init) => {
    signal = init!.signal!;
    return new Promise<Response>((resolve) => {
      release = resolve;
    });
  });
  const pending = h.authorize();
  h.cleanup();
  assert.equal(signal!.aborted, true);
  release!(Response.json(issued));
  assert.equal(await pending, undefined);
  assert.deepEqual(h.counts(), { closed: 1, rejected: 0, refetches: 0 });
});
