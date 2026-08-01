import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "../../src/shared/db/schema";
import { provisionAdmin, MINIMUM_PASSWORD_LENGTH } from "../../src/modules/identity/application/admin/provision-admin";
import { PRODUCTION_HASHER_PARAMS } from "../../src/modules/identity/domain/password-hasher";
import { DrizzleCredentialsRepository } from "../../src/modules/identity/infrastructure/drizzle-credentials-repository";
import { DrizzleUserProvisioning } from "../../src/modules/identity/infrastructure/drizzle-user-provisioning";
import { NodeRsArgon2Hasher } from "../../src/modules/identity/infrastructure/node-rs-argon2-hasher";

/**
 * Creates the first ADMIN account, which is the only account that cannot be
 * created through the application itself: every other path requires a
 * session, and a fresh database has none.
 *
 * Credentials come from the environment, never from argv — anything on the
 * command line lands in shell history and in the process list, where any
 * other user on the machine can read it:
 *
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' npm run db:seed-admin
 */
async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Export it (a Neon branch connection string) before running db:seed-admin.",
    );
  }

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "ADMIN_EMAIL and ADMIN_PASSWORD must both be set. Example:\n" +
        "  ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a long passphrase' npm run db:seed-admin",
    );
  }

  const db = drizzle(neon(databaseUrl), { schema });

  const result = await provisionAdmin(
    {
      users: new DrizzleCredentialsRepository(db),
      provisioning: new DrizzleUserProvisioning(db),
      // Production parameters: this hash is the real credential, so it is
      // never seeded with the cheap test parameters.
      hasher: new NodeRsArgon2Hasher(PRODUCTION_HASHER_PARAMS),
      newUserId: () => crypto.randomUUID(),
    },
    { email, password },
  );

  if (!result.ok) {
    const explanation =
      result.reason === "email-taken"
        ? `A user with the email ${email} already exists.`
        : `ADMIN_PASSWORD must be at least ${MINIMUM_PASSWORD_LENGTH} characters.`;
    throw new Error(explanation);
  }

  console.log(`ADMIN created: ${result.user.email} (${result.user.id})`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
