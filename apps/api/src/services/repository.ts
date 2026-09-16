import type {
  CreateServiceEnvironmentInput,
  CreateServiceInput,
  ServiceDetailRecord,
  ServiceEnvironmentRecord,
  ServiceRecord,
  UpdateServiceEnvironmentInput,
  UpdateServiceInput,
} from "./types.js";

export interface ServiceRepository {
  listServices(organizationSlug: string): Promise<ServiceRecord[]>;
  getService(
    organizationSlug: string,
    serviceId: string,
  ): Promise<ServiceDetailRecord>;
  createService(
    organizationSlug: string,
    input: CreateServiceInput,
    actorUserId: string,
  ): Promise<ServiceDetailRecord>;
  updateService(
    organizationSlug: string,
    serviceId: string,
    input: UpdateServiceInput,
    actorUserId: string,
  ): Promise<ServiceDetailRecord>;
  createEnvironment(
    organizationSlug: string,
    serviceId: string,
    input: CreateServiceEnvironmentInput,
    actorUserId: string,
  ): Promise<ServiceEnvironmentRecord>;
  updateEnvironment(
    organizationSlug: string,
    serviceId: string,
    environmentId: string,
    input: UpdateServiceEnvironmentInput,
    actorUserId: string,
  ): Promise<ServiceEnvironmentRecord>;
}
