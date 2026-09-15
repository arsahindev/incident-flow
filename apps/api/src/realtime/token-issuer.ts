import type { AuthContext } from "../auth/types.js";

export interface RealtimeTokenIssuer {
  issueToken(auth: AuthContext): Promise<{ token: string; channel: string }>;
}
