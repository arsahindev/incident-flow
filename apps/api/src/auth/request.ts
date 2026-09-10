import type { FastifyRequest } from "fastify";

import { AuthenticationError } from "./errors.js";
import type { AuthContext } from "./types.js";

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthContext;
  }
}

export function extractSessionToken(request: FastifyRequest) {
  const authorization = request.headers.authorization;
  if (!authorization) throw new AuthenticationError();

  const [scheme, token, extra] = authorization.split(" ");
  if (scheme !== "Session" || !token || extra) throw new AuthenticationError();

  return token;
}
