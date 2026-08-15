-- ExtendEnum
ALTER TYPE "IncidentActivityType" ADD VALUE 'AFFECTED_SERVICES_CHANGED';

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('APPLICATION', 'API', 'PLATFORM', 'INFRASTRUCTURE', 'BUSINESS', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "ServiceTier" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('OPERATIONAL', 'DEGRADED', 'DISRUPTED', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "ServiceEnvironmentKind" AS ENUM ('DEVELOPMENT', 'TEST', 'STAGING', 'PRODUCTION', 'PREVIEW', 'OTHER');

-- CreateEnum
CREATE TYPE "ServiceEnvironmentStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "owner_team_id" UUID,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "type" "ServiceType" NOT NULL,
    "tier" "ServiceTier" NOT NULL DEFAULT 'MEDIUM',
    "status" "ServiceStatus" NOT NULL DEFAULT 'OPERATIONAL',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_environments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" "ServiceEnvironmentKind" NOT NULL,
    "is_ephemeral" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3),
    "status" "ServiceEnvironmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_environments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_affected_services" (
    "organization_id" UUID NOT NULL,
    "incident_id" UUID NOT NULL,
    "service_id" UUID NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_affected_services_pkey" PRIMARY KEY ("incident_id", "service_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "services_organization_id_slug_key" ON "services"("organization_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "services_organization_id_id_key" ON "services"("organization_id", "id");

-- CreateIndex
CREATE INDEX "services_organization_id_archived_at_name_idx" ON "services"("organization_id", "archived_at", "name");

-- CreateIndex
CREATE INDEX "services_organization_id_owner_team_id_idx" ON "services"("organization_id", "owner_team_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_environments_organization_id_id_key" ON "service_environments"("organization_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "service_environments_organization_id_service_id_slug_key" ON "service_environments"("organization_id", "service_id", "slug");

-- CreateIndex
CREATE INDEX "service_environments_organization_id_service_id_status_idx" ON "service_environments"("organization_id", "service_id", "status");

-- CreateIndex
CREATE INDEX "service_environments_organization_id_expires_at_idx" ON "service_environments"("organization_id", "expires_at");

-- CreateIndex
CREATE INDEX "incident_affected_services_organization_id_service_id_created_at_idx" ON "incident_affected_services"("organization_id", "service_id", "created_at");

-- CreateIndex
CREATE INDEX "incident_affected_services_organization_id_incident_id_idx" ON "incident_affected_services"("organization_id", "incident_id");

-- Enforce at most one primary affected service per incident.
CREATE UNIQUE INDEX "incident_affected_services_one_primary_per_incident"
ON "incident_affected_services"("organization_id", "incident_id")
WHERE "is_primary" = true;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_organization_id_owner_team_id_fkey" FOREIGN KEY ("organization_id", "owner_team_id") REFERENCES "teams"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_environments" ADD CONSTRAINT "service_environments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_environments" ADD CONSTRAINT "service_environments_organization_id_service_id_fkey" FOREIGN KEY ("organization_id", "service_id") REFERENCES "services"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_affected_services" ADD CONSTRAINT "incident_affected_services_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_affected_services" ADD CONSTRAINT "incident_affected_services_organization_id_incident_id_fkey" FOREIGN KEY ("organization_id", "incident_id") REFERENCES "incidents"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_affected_services" ADD CONSTRAINT "incident_affected_services_organization_id_service_id_fkey" FOREIGN KEY ("organization_id", "service_id") REFERENCES "services"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
