ALTER TABLE "incidents"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "incidents"
ADD CONSTRAINT "incidents_version_positive" CHECK ("version" > 0);
