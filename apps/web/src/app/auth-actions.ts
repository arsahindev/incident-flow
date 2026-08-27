"use server";

import {
  createdInvitationResponseSchema,
  memberResponseSchema,
  sessionResultResponseSchema,
} from "@incidentflow/contracts";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { sessionCookieName, sessionMaxAgeSeconds } from "@/lib/auth-constants";
import { ApiError, requestApi } from "@/lib/api";
import type { SessionResult } from "@/lib/types";

export type AuthFormState = { error: string | null };
export type InvitationFormState = {
  error: string | null;
  invitationUrl: string | null;
};

function value(formData: FormData, key: string) {
  const nextValue = formData.get(key);
  return typeof nextValue === "string" ? nextValue : "";
}

async function setSessionCookie(session: SessionResult) {
  (await cookies()).set(sessionCookieName, session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionMaxAgeSeconds,
    expires: new Date(session.expiresAt),
    priority: "high",
  });
}

function message(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export async function loginAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  try {
    const { session } = await requestApi(
      "/v1/auth/login",
      {
        method: "POST",
        body: JSON.stringify({
          email: value(formData, "email"),
          password: value(formData, "password"),
        }),
      },
      sessionResultResponseSchema,
    );
    await setSessionCookie(session);
  } catch (error) {
    return { error: message(error, "Unable to sign in") };
  }
  redirect("/");
}

export async function logoutAction() {
  try {
    await requestApi("/v1/auth/logout", { method: "POST" });
  } finally {
    (await cookies()).delete(sessionCookieName);
  }
  redirect("/login");
}

export async function switchOrganizationAction(formData: FormData) {
  const { session } = await requestApi(
    "/v1/auth/switch-organization",
    {
      method: "POST",
      body: JSON.stringify({ organizationSlug: value(formData, "organizationSlug") }),
    },
    sessionResultResponseSchema,
  );
  await setSessionCookie(session);
  redirect("/");
}

export async function acceptInvitationAction(
  token: string,
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  try {
    const { session } = await requestApi(
      `/v1/invitations/${token}/accept`,
      {
        method: "POST",
        body: JSON.stringify({
          displayName: value(formData, "displayName"),
          password: value(formData, "password"),
        }),
      },
      sessionResultResponseSchema,
    );
    await setSessionCookie(session);
  } catch (error) {
    return { error: message(error, "Unable to accept the invitation") };
  }
  redirect("/");
}

export async function createInvitationAction(
  _state: InvitationFormState,
  formData: FormData,
): Promise<InvitationFormState> {
  try {
    const { invitation } = await requestApi(
      "/v1/invitations",
      {
        method: "POST",
        body: JSON.stringify({
          email: value(formData, "email"),
          role: value(formData, "role"),
        }),
      },
      createdInvitationResponseSchema,
    );
    return { error: null, invitationUrl: `/invite/${invitation.token}` };
  } catch (error) {
    return { error: message(error, "Unable to create the invitation"), invitationUrl: null };
  }
}

export async function updateMemberAction(
  userId: string,
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  try {
    await requestApi(
      `/v1/members/${userId}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          role: value(formData, "role"),
          status: value(formData, "status"),
        }),
      },
      memberResponseSchema,
    );
    revalidatePath("/settings/members");
  } catch (error) {
    return { error: message(error, "Unable to update the member") };
  }
  redirect("/settings/members");
}

export async function updateTeamMembershipAction(
  teamId: string,
  userId: string,
  assigned: boolean,
) {
  await requestApi(`/v1/teams/${teamId}/members/${userId}`, {
    method: assigned ? "PUT" : "DELETE",
  });
  redirect("/settings/members");
}
