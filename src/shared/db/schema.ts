/**
 * Schema barrel for drizzle-kit and the runtime Drizzle client.
 *
 * Empty in slices 1-2: no product tables exist yet. Slice 3b adds the
 * catalog schema, slice 4 adds the identity schema — each module's
 * `infrastructure/*.schema.ts` file gets re-exported here so drizzle-kit's
 * single `schema` entry point in `drizzle.config.ts` can see every table.
 */
export {};
