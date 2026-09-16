import {
  realtimeIncidentSignalSchema,
  type RealtimeIncidentSignal,
} from "@incidentflow/contracts";
import { SignJWT } from "jose";
import { z } from "zod";

import { requirePermission } from "../auth/permissions.js";
import type { AuthContext } from "../auth/types.js";
import type { RealtimePublisher, RealtimeSessionRevoker } from "./publisher.js";
import type { RealtimeTokenIssuer } from "./token-issuer.js";

const uuid = z.uuid();

function organizationChannel(organizationId: string) {
  return `incidentflow:organization:${uuid.parse(organizationId)}`;
}

function userRevocationKey(organizationId: string, userId: string) {
  return `${uuid.parse(organizationId)}:${uuid.parse(userId)}`;
}

export class AblyRealtimeAdapter
  implements RealtimePublisher, RealtimeSessionRevoker, RealtimeTokenIssuer
{
  private readonly keyName: string;
  private readonly keySecret: Uint8Array;
  private readonly authorization: string;

  constructor(
    private readonly options: {
      apiKey: string;
      maxOutboundPayloadBytes?: number;
      fetch?: typeof fetch;
    },
  ) {
    const match = /^([\w-]+\.[\w-]+):([\w+/=-]+)$/.exec(options.apiKey);
    if (!match)
      throw new Error("ABLY_API_KEY must contain a key name and secret");
    this.keyName = match[1]!;
    this.keySecret = new TextEncoder().encode(match[2]!);
    this.authorization = `Basic ${Buffer.from(options.apiKey).toString("base64")}`;
  }

  async issueToken(auth: AuthContext) {
    requirePermission(auth, "incidents.read");
    const channel = organizationChannel(auth.organizationId);
    const token = await new SignJWT({
      "x-ably-capability": JSON.stringify({ [channel]: ["subscribe"] }),
      "x-ably-clientId": uuid.parse(auth.sessionId),
      "x-ably-revocation-key": userRevocationKey(
        auth.organizationId,
        auth.userId,
      ),
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT", kid: this.keyName })
      .setIssuedAt()
      .setExpirationTime("60s")
      .sign(this.keySecret);
    return { token, channel };
  }

  async publishIncidentSignal(
    organizationId: string,
    incidentId: string,
    signal: RealtimeIncidentSignal,
  ) {
    const channel = organizationChannel(organizationId);
    const parsed = realtimeIncidentSignalSchema.parse(signal);
    if (parsed.incidentId !== uuid.parse(incidentId)) {
      throw new Error("Realtime publication is invalid");
    }
    if (
      Buffer.byteLength(JSON.stringify(parsed)) >
      (this.options.maxOutboundPayloadBytes ?? 1_024)
    ) {
      throw new Error("Realtime publication exceeds the payload limit");
    }
    await this.post(
      `https://rest.ably.io/channels/${encodeURIComponent(channel)}/messages`,
      {
        name: "realtime:incident",
        data: parsed,
      },
    );
  }

  async disconnectSession(sessionId: string) {
    await this.revoke(`clientId:${uuid.parse(sessionId)}`);
  }

  async disconnectUser(organizationId: string, userId: string) {
    await this.revoke(
      `revocationKey:${userRevocationKey(organizationId, userId)}`,
    );
  }

  private async revoke(target: string) {
    await this.post(
      `https://main.realtime.ably.net/keys/${this.keyName}/revokeTokens`,
      {
        targets: [target],
        allowReauthMargin: false,
      },
    );
  }

  private async post(url: string, body: unknown) {
    // Do not include provider responses or fetch causes in errors: they can contain credentials.
    let response: Response;
    try {
      response = await (this.options.fetch ?? fetch)(url, {
        method: "POST",
        headers: {
          authorization: this.authorization,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5_000),
        redirect: "error",
      });
    } catch {
      throw new Error("Realtime provider request failed");
    }
    await response.body?.cancel();
    if (!response.ok)
      throw new Error(`Realtime provider returned HTTP ${response.status}`);
  }
}
