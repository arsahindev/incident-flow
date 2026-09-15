import { z } from "zod";

export const publicDemoEnvironmentSchema = z.enum(["local", "dev", "prod"]);

// Intentionally public portfolio credentials. Never use these for administrators
// or real customer data. Both the seed and login page consume this definition.
export function publicDemoAccount(environment: z.infer<typeof publicDemoEnvironmentSchema>) {
  return {
    id: "99999999-9999-4999-8999-999999999999",
    email: `demo+${environment}@incidentflow.demo`,
    password: `IncidentFlow-Demo-${environment}-2026!`,
    displayName: "Portfolio Demo",
  };
}
