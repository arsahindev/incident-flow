import "server-only";

import type {
  IncidentDetail,
  IncidentPagination,
  IncidentPriority,
  IncidentStatus,
  IncidentSummary,
  Service,
  ServiceDetail,
  Team,
} from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function apiUrl(path: string) {
  const baseUrl =
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:4000";
  return new URL(path, baseUrl).toString();
}

export async function requestApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...init,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  const body = (await response.json()) as { error?: string } & T;
  if (!response.ok) {
    throw new ApiError(body.error ?? "The API request failed", response.status);
  }
  return body;
}

export function getIncidents(filters: {
  serviceId?: string;
  teamId?: string;
  status?: IncidentStatus;
  priority?: IncidentPriority;
  page?: number;
} = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const query = search.size > 0 ? `?${search.toString()}` : "";
  return requestApi<{
    incidents: IncidentSummary[];
    pagination: IncidentPagination;
  }>(`/v1/incidents${query}`);
}

export function getTeams() {
  return requestApi<{ teams: Team[] }>("/v1/teams");
}

export function getIncident(incidentId: string) {
  return requestApi<{ incident: IncidentDetail }>(`/v1/incidents/${incidentId}`);
}

export function getServices() {
  return requestApi<{ services: Service[] }>("/v1/services");
}

export function getService(serviceId: string) {
  return requestApi<{ service: ServiceDetail }>(`/v1/services/${serviceId}`);
}
