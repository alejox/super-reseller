/**
 * Schema barrel for drizzle-kit and the runtime Drizzle client.
 *
 * Slice 4 adds the identity schema — each module's
 * `infrastructure/*.schema.ts` file gets re-exported here so drizzle-kit's
 * single `schema` entry point in `drizzle.config.ts` can see every table.
 *
 * Relative import (not `@/modules/*`) on purpose: `drizzle-kit generate`
 * loads this file standalone and is not guaranteed to resolve tsconfig path
 * aliases the way Vitest does via `vite-tsconfig-paths`.
 */
export * from "../../modules/catalog/infrastructure/catalog.schema";
export * from "../../modules/identity/infrastructure/identity.schema";
export * from "../../modules/wallet/infrastructure/wallet.schema";
export * from "../../modules/ordering/infrastructure/ordering.schema";
export * from "../../modules/provider-accounts/infrastructure/provider-account.schema";
export * from "@/modules/support/infrastructure/support.schema";
export * from "@/modules/inventory/infrastructure/inventory.schema";
