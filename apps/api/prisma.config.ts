import { defineConfig } from "prisma/config";

import "./src/config.js";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Keep generation install-safe. Commands that connect to PostgreSQL and the
    // seed entry point validate DATABASE_URL before attempting database work.
    url: process.env["DATABASE_URL"],
  },
});
