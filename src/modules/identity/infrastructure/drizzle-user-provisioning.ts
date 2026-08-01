import type { ModuleDb } from "@/shared/db/module-db";

import type { NewAdminUser, UserProvisioning } from "../domain/user-provisioning";
import { users } from "./identity.schema";

export class DrizzleUserProvisioning implements UserProvisioning {
  constructor(private readonly db: ModuleDb) {}

  async createAdmin(user: NewAdminUser): Promise<void> {
    await this.db.insert(users).values({
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      role: "ADMIN",
      // Both NULL by the `users_reseller_requires_tier` CHECK: an ADMIN owns
      // no reseller scope and carries no price tier.
      resellerId: null,
      priceTierId: null,
      createdAt: user.createdAt,
    });
  }
}
