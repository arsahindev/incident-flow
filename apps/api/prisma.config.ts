import { defineConfig } from "prisma/config";

import { loadDatabaseConfig } from "./src/config.js";

// `prisma generate` runs during installation, before a developer has
// necessarily created an API environment file. Commands that connect to the
// database must instead enter the validated configuration boundary.
const DATABASE_URL = process.argv.includes("generate")
  ? process.env["DATABASE_URL"]
  : loadDatabaseConfig().DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Database commands validate and load the API-owned environment boundary;
    // Prisma generation intentionally remains install-safe.
    url: DATABASE_URL,
  },
});
