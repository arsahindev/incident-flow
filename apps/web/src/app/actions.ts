"use server";

import { incidentResponseSchema } from "@incidentflow/contracts";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ApiError, requestApi } from "@/lib/api";
import type {
  IncidentDetail,
  ServiceDetail,
  ServiceEnvironment,
} from "@/lib/types";

import type { IncidentFormState } from "./form-state";

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function formValues(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    );
}

function errorState(error: unknown): IncidentFormState {
  return {
    error:
      error instanceof ApiError ? error.message : "Unable to save the incident",
    message: null,
  };
}

export async function createIncidentAction(
  _previousState: IncidentFormState,
  formData: FormData,
): Promise<IncidentFormState> {
  let incidentId: string;
  try {
    const response = await requestApi<{ incident: IncidentDetail }>(
      "/v1/incidents",
      {
        method: "POST",
        body: JSON.stringify({
          title: formValue(formData, "title"),
          description: formValue(formData, "description"),
          priority: formValue(formData, "priority"),
          teamId: formValue(formData, "teamId") || null,
          serviceIds: formValues(formData, "serviceIds"),
          primaryServiceId: formValue(formData, "primaryServiceId") || null,
        }),
      },
      incidentResponseSchema,
    );
    incidentId = response.incident.id;
  } catch (error) {
    return errorState(error);
  }

  revalidatePath("/");
  redirect(`/incidents/${incidentId}`);
}

export async function updateIncidentAction(
  incidentId: string,
  _previousState: IncidentFormState,
  formData: FormData,
): Promise<IncidentFormState> {
  try {
    await requestApi(
      `/v1/incidents/${incidentId}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status: formValue(formData, "status"),
          teamId: formValue(formData, "teamId") || null,
          serviceIds: formValues(formData, "serviceIds"),
          primaryServiceId: formValue(formData, "primaryServiceId") || null,
        }),
      },
      incidentResponseSchema,
    );
  } catch (error) {
    return errorState(error);
  }

  revalidatePath("/");
  revalidatePath(`/incidents/${incidentId}`);
  return { error: null, message: "Incident updated" };
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function createServiceAction(
  _previousState: IncidentFormState,
  formData: FormData,
): Promise<IncidentFormState> {
  const environmentKinds = formValues(formData, "environments");
  let serviceId: string;
  try {
    const response = await requestApi<{ service: ServiceDetail }>(
      "/v1/services",
      {
        method: "POST",
        body: JSON.stringify({
          name: formValue(formData, "name"),
          slug: slugify(
            formValue(formData, "slug") || formValue(formData, "name"),
          ),
          description: formValue(formData, "description") || null,
          type: formValue(formData, "type"),
          tier: formValue(formData, "tier"),
          ownerTeamId: formValue(formData, "ownerTeamId") || null,
          environments: environmentKinds.map((kind) => ({
            name: kind[0]!.toUpperCase() + kind.slice(1),
            slug: kind,
            kind,
            isEphemeral: false,
          })),
        }),
      },
    );
    serviceId = response.service.id;
  } catch (error) {
    return {
      error:
        error instanceof ApiError
          ? error.message
          : "Unable to create the service",
      message: null,
    };
  }

  revalidatePath("/");
  revalidatePath("/services");
  redirect(`/services/${serviceId}`);
}

export async function createServiceEnvironmentAction(
  serviceId: string,
  _previousState: IncidentFormState,
  formData: FormData,
): Promise<IncidentFormState> {
  const name = formValue(formData, "name");
  const isEphemeral = formData.get("isEphemeral") === "on";
  try {
    await requestApi<{ environment: ServiceEnvironment }>(
      `/v1/services/${serviceId}/environments`,
      {
        method: "POST",
        body: JSON.stringify({
          name,
          slug: slugify(formValue(formData, "slug") || name),
          kind: formValue(formData, "kind"),
          isEphemeral,
          expiresAt:
            isEphemeral && formValue(formData, "expiresAt")
              ? new Date(formValue(formData, "expiresAt")).toISOString()
              : null,
        }),
      },
    );
  } catch (error) {
    return {
      error:
        error instanceof ApiError
          ? error.message
          : "Unable to create the environment",
      message: null,
    };
  }

  revalidatePath(`/services/${serviceId}`);
  revalidatePath("/services");
  return { error: null, message: "Environment created" };
}

export async function archiveServiceEnvironmentAction(
  serviceId: string,
  environmentId: string,
) {
  await requestApi(`/v1/services/${serviceId}/environments/${environmentId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "archived" }),
  });
  revalidatePath(`/services/${serviceId}`);
  revalidatePath("/services");
}

export async function updateServiceAction(
  serviceId: string,
  _previousState: IncidentFormState,
  formData: FormData,
): Promise<IncidentFormState> {
  try {
    await requestApi(`/v1/services/${serviceId}`, {
      method: "PATCH",
      body: JSON.stringify({
        tier: formValue(formData, "tier"),
        status: formValue(formData, "status"),
        ownerTeamId: formValue(formData, "ownerTeamId") || null,
      }),
    });
  } catch (error) {
    return {
      error:
        error instanceof ApiError
          ? error.message
          : "Unable to update the service",
      message: null,
    };
  }
  revalidatePath("/");
  revalidatePath("/services");
  revalidatePath(`/services/${serviceId}`);
  redirect(`/services/${serviceId}?updated=1`);
}

export async function archiveServiceAction(serviceId: string) {
  await requestApi(`/v1/services/${serviceId}`, {
    method: "PATCH",
    body: JSON.stringify({ archived: true }),
  });
  revalidatePath("/");
  revalidatePath("/services");
  redirect("/services");
}
