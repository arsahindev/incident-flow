"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ApiError, requestApi } from "@/lib/api";
import type { IncidentDetail } from "@/lib/types";

import type { IncidentFormState } from "./form-state";

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function errorState(error: unknown): IncidentFormState {
  return {
    error: error instanceof ApiError ? error.message : "Unable to save the incident",
    message: null,
  };
}

export async function createIncidentAction(
  _previousState: IncidentFormState,
  formData: FormData,
): Promise<IncidentFormState> {
  let incidentId: string;
  try {
    const response = await requestApi<{ incident: IncidentDetail }>("/v1/incidents", {
      method: "POST",
      body: JSON.stringify({
        title: formValue(formData, "title"),
        description: formValue(formData, "description"),
        priority: formValue(formData, "priority"),
        teamId: formValue(formData, "teamId") || null,
      }),
    });
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
    await requestApi(`/v1/incidents/${incidentId}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: formValue(formData, "status"),
        teamId: formValue(formData, "teamId") || null,
      }),
    });
  } catch (error) {
    return errorState(error);
  }

  revalidatePath("/");
  revalidatePath(`/incidents/${incidentId}`);
  return { error: null, message: "Incident updated" };
}
