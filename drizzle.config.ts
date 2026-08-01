import { defineConfig } from "drizzle-kit";

// `drizzle-kit generate` is a static analysis of `schema` and needs no
// network access; `dbCredentials.url` is only read by commands that touch a
// live database (`migrate`, `push`, `studio`), none of which this change's
// CI path invokes. DATABASE_URL is required at that point, not at import
// time, so an empty fallback keeps `generate` usable without a Neon branch.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/shared/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
