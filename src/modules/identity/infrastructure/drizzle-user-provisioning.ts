import type { ModuleDb } from "@/shared/db/module-db";

import type {
  NewAdminUser,
  NewCustomerUser,
  NewResellerUser,
  UserProvisioning,
} from "../domain/user-provisioning";
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

  async createReseller(user: NewResellerUser): Promise<void> {
    await this.db.insert(users).values({
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      role: "RESELLER",
      // The mirror image of createAdmin: the same CHECK that forces both
      // columns NULL for an ADMIN forces both NON-NULL here.
      resellerId: user.resellerId,
      priceTierId: user.priceTierId,
      createdAt: user.createdAt,
    });
  }

  async createCustomer(user: NewCustomerUser): Promise<void> {
    await this.db.insert(users).values({
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      role: "CUSTOMER",
      // Same tier-required shape as createReseller — `users_tier_matches_role`
      // demands both columns NON-NULL for CUSTOMER exactly as it does for
      // RESELLER (IT: Tier Requirement Matches Role).
      resellerId: user.resellerId,
      priceTierId: user.priceTierId,
      createdAt: user.createdAt,
    });
  }
}
