import type { AuthContext } from "../auth/types.js";
import type { PrismaClient } from "../generated/prisma/client.js";

export interface RealtimeRoomAuthorizer {
  canJoinIncident(context: AuthContext, incidentId: string): Promise<boolean>;
}

export class PrismaRealtimeRoomAuthorizer implements RealtimeRoomAuthorizer {
  constructor(private readonly prisma: PrismaClient) {}

  async canJoinIncident(context: AuthContext, incidentId: string) {
    if (!context.permissions.includes("incidents.read")) return false;
    return (
      (await this.prisma.incident.count({
        where: { id: incidentId, organizationId: context.organizationId },
      })) === 1
    );
  }
}
