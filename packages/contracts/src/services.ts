import z from "zod";

export const serviceTypes = ["application", "api", "platform", "infrastructure", "business", "external"] as const;
export const serviceTypeSchema = z.enum(serviceTypes);
export type ServiceType = z.infer<typeof serviceTypeSchema>;

export const serviceStatuses = ["operational", "degraded", "disrupted", "maintenance"] as const;
export const serviceStatusSchema = z.enum(serviceStatuses);
export type ServiceStatus = z.infer<typeof serviceStatusSchema>;