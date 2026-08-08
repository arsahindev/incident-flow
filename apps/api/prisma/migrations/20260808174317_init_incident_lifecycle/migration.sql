-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "IncidentPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IncidentActivityType" AS ENUM ('CREATED', 'STATUS_CHANGED', 'TEAM_ASSIGNED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "team_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "IncidentPriority" NOT NULL DEFAULT 'MEDIUM',
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_activity" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "incident_id" UUID NOT NULL,
    "type" "IncidentActivityType" NOT NULL,
    "message" TEXT NOT NULL,
    "from_value" TEXT,
    "to_value" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "teams_organization_id_idx" ON "teams"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "teams_organization_id_slug_key" ON "teams"("organization_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "teams_organization_id_id_key" ON "teams"("organization_id", "id");

-- CreateIndex
CREATE INDEX "incidents_organization_id_created_at_idx" ON "incidents"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "incidents_organization_id_status_idx" ON "incidents"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "incidents_organization_id_id_key" ON "incidents"("organization_id", "id");

-- CreateIndex
CREATE INDEX "incident_activity_organization_id_incident_id_created_at_idx" ON "incident_activity"("organization_id", "incident_id", "created_at");

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_organization_id_team_id_fkey" FOREIGN KEY ("organization_id", "team_id") REFERENCES "teams"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_activity" ADD CONSTRAINT "incident_activity_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_activity" ADD CONSTRAINT "incident_activity_organization_id_incident_id_fkey" FOREIGN KEY ("organization_id", "incident_id") REFERENCES "incidents"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
