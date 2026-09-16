import type {
  AuthContext,
  RealtimeIncidentSignal,
} from "@incidentflow/contracts";

import type { RealtimePublisher } from "../realtime/publisher.js";
import type { IncidentRepository } from "./repository.js";
import type {
  CreateIncidentInput,
  IncidentMutationChange,
  UpdateIncidentInput,
} from "./types.js";

const signalTypeByChange: Record<
  IncidentMutationChange,
  RealtimeIncidentSignal["type"]
> = {
  created: "incident.created",
  status: "incident.status_changed",
  assignment: "incident.assignment_changed",
  affected_services: "incident.affected_services_changed",
  activity: "incident.activity_updated",
};

export class IncidentApplicationService {
  constructor(
    private readonly repository: IncidentRepository,
    private readonly realtimePublisher: RealtimePublisher,
    private readonly reportPublishError: (error: unknown) => void = () => {},
  ) {}

  async createIncident(context: AuthContext, input: CreateIncidentInput) {
    const result = await this.repository.createIncident(
      context.organizationSlug,
      input,
      context.userId,
    );
    await this.publishChanges(
      context.organizationId,
      result.incident,
      result.changes,
    );
    return result.incident;
  }

  async updateIncident(
    context: AuthContext,
    incidentId: string,
    input: UpdateIncidentInput,
  ) {
    const result = await this.repository.updateIncident(
      context.organizationSlug,
      incidentId,
      input,
      context.userId,
    );
    await this.publishChanges(
      context.organizationId,
      result.incident,
      result.changes,
    );
    return result.incident;
  }

  private async publishChanges(
    organizationId: string,
    incident: { id: string; version: number; updatedAt: string },
    changes: IncidentMutationChange[],
  ) {
    const publications = changes.map((change) =>
      this.realtimePublisher.publishIncidentSignal(
        organizationId,
        incident.id,
        {
          schemaVersion: 1,
          type: signalTypeByChange[change],
          incidentId: incident.id,
          incidentVersion: incident.version,
          occurredAt: incident.updatedAt,
        },
      ),
    );
    const results = await Promise.allSettled(publications);
    for (const result of results) {
      if (result.status === "rejected") this.reportPublishError(result.reason);
    }
  }
}
