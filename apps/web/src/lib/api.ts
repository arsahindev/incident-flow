import "server-only";

import {
  authSessionResponseSchema,
  incidentResponseSchema,
  incidentsResponseSchema,
  invitationResponseSchema,
  membersResponseSchema,
  organizationsResponseSchema,
} from "@incidentflow/contracts";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ZodType } from "zod";

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
import { sessionCookieName } from "./auth-constants";
import { ApiError, parseApiResponse } from "./api-response";
import { getServerEnvironment } from "./env/server";

export { ApiError } from "./api-response";

function apiUrl(path: string) {
  return new URL(path, getServerEnvironment().API_URL).toString();
}

export async function requestApi<T>(
  path: string,
  init?: RequestInit,
  responseSchema?: ZodType<T>,
): Promise<T> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(sessionCookieName)?.value;

  const headers = new Headers(init?.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (sessionToken) {
    headers.set("authorization", `Session ${sessionToken}`);
  }

  const url = apiUrl(path);
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      cache: init?.cache ?? "no-store",
      headers,
    });
  } catch (error) {
    console.error("Network error while making API request:", error);
    throw new ApiError("Unable to reach the API", 0, "network_error");
  }
  return parseApiResponse(response, responseSchema);
}

export async function getOptionalSession() {
  try {
    return (await requestApi("/v1/auth/session", undefined, authSessionResponseSchema))
      .session;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export async function requireSession() {
  const session = await getOptionalSession();
  if (!session) redirect("/login");
  return session;
}

export async function getMembers() {
  return requestApi("/v1/members", undefined, membersResponseSchema);
}

export async function getOrganizations() {
  return requestApi(
    "/v1/auth/organizations",
    undefined,
    organizationsResponseSchema,
  );
}

export async function getInvitation(token: string) {
  return requestApi(
    `/v1/invitations/${token}`,
    undefined,
    invitationResponseSchema,
  );
}

export async function getTeams() {
  return requestApi<{ teams: Team[] }>("/v1/teams");
}

export async function getIncidents(filters: {
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
  }>(`/v1/incidents${query}`, undefined, incidentsResponseSchema);
}
export async function getIncident(incidentId: string) {
  return requestApi<{ incident: IncidentDetail }>(
    `/v1/incidents/${incidentId}`,
    undefined,
    incidentResponseSchema,
  );
}

export async function getServices() {
  return requestApi<{ services: Service[] }>("/v1/services");
}
export async function getService(serviceId: string) {
  return requestApi<{ service: ServiceDetail }>(`/v1/services/${serviceId}`);
}
