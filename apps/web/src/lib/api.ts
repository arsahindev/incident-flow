import "server-only";

import type { IncidentDetail, IncidentSummary, Team } from "./types";

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

export function getIncidents() {
  return requestApi<{ incidents: IncidentSummary[] }>("/v1/incidents");
}

export function getTeams() {
  return requestApi<{ teams: Team[] }>("/v1/teams");
}

export function getIncident(incidentId: string) {
  return requestApi<{ incident: IncidentDetail }>(`/v1/incidents/${incidentId}`);
}
