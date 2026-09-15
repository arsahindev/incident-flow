import type { publicDemoAccount } from "@incidentflow/contracts";

import type { PrismaClient } from "../generated/prisma/client.js";
import { hashPassword } from "./passwords.js";

export async function seedDemoAccount(
  prisma: PrismaClient,
  account: ReturnType<typeof publicDemoAccount>,
  organizationId: string,
  teamId: string,
  passwordPepper: Buffer,
) {
  const passwordHash = await hashPassword(account.password, passwordPepper);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { email: account.email },
      include: { organizationMemberships: true },
    });
    if (existing && (existing.id !== account.id || existing.organizationMemberships.some(
      (membership) => membership.role === "OWNER" || membership.role === "ADMIN",
    ))) {
      throw new Error("Public demo seed refuses to overwrite an existing or privileged account");
    }
    const user = await tx.user.upsert({
      where: { email: account.email },
      update: { displayName: account.displayName, passwordHash, status: "ACTIVE" },
      create: {
        id: account.id,
        email: account.email,
        displayName: account.displayName,
        passwordHash,
      },
    });
    await tx.organizationMembership.upsert({
      where: { organizationId_userId: { organizationId, userId: user.id } },
      update: { role: "RESPONDER", status: "ACTIVE" },
      create: { organizationId, userId: user.id, role: "RESPONDER" },
    });
    await tx.teamMembership.upsert({
      where: { organizationId_teamId_userId: { organizationId, teamId, userId: user.id } },
      update: {},
      create: { organizationId, teamId, userId: user.id },
    });
    return user;
  });
}
