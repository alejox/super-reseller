import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

/**
 * Neon HTTP driver: one statement per HTTP request, no transaction
 * continuity across calls. This is why Postgres RLS via `SET LOCAL` is
 * rejected for this change (design.md: "Postgres RLS is rejected").
 */
function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Provision a Neon branch and export DATABASE_URL before using src/shared/db/client.",
    );
  }
  return url;
}

const sqlClient = neon(getDatabaseUrl());

export const db = drizzle(sqlClient, { schema });
