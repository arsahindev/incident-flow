import "server-only";

import {
  authSessionResponseSchema,
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

export { ApiError } from "./api-response";

function apiUrl(path: string) {
  const baseUrl =
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:4000";
  return new URL(path, baseUrl).toString();
}

export async function requestApi<T>(
  path: string,
  init?: RequestInit,
  responseSchema?: ZodType<T>,
): Promise<T> {
  const sessionToken = (await cookies()).get(sessionCookieName)?.value;
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...init,
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        ...(sessionToken ? { authorization: `Session ${sessionToken}` } : {}),
        ...init?.headers,
      },
    });
  } catch {
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

export function getMembers() {
  return requestApi("/v1/members", undefined, membersResponseSchema);
}

export function getOrganizations() {
  return requestApi(
    "/v1/auth/organizations",
    undefined,
    organizationsResponseSchema,
  );
}

export function getInvitation(token: string) {
  return requestApi(
    `/v1/invitations/${token}`,
    undefined,
    invitationResponseSchema,
  );
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
