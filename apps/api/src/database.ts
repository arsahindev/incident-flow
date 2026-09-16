import { PrismaPg } from "@prisma/adapter-pg";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";

import { PrismaClient } from "./generated/prisma/client.js";

export function createPrismaClient(
  databaseUrl: string,
  options: { vercel?: boolean } = {},
) {
  if (options.vercel) {
    const pool = new Pool({
      connectionString: databaseUrl,
      max: 5,
      idleTimeoutMillis: 5_000,
      connectionTimeoutMillis: 10_000,
      allowExitOnIdle: true,
    });
    // An idle connection can disappear when Neon suspends; never log its credentials.
    pool.on("error", () => console.warn("Database idle connection closed"));
    attachDatabasePool(pool);
    return new PrismaClient({
      adapter: new PrismaPg(pool, { disposeExternalPool: true }),
    });
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
}
