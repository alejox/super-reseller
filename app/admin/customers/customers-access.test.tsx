import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requireRole } from "@/modules/identity/application/dal";
import AdminCustomersPage from "./page";
import { CustomersWorkspace } from "./customers-workspace";

/**
 * CI: Only ADMIN Provisions A Customer. Mirrors `admin-views.test.tsx`'s
 * "mounts the catalog page behind authorization" case: `requireRole`
 * having been called with "ADMIN" is the observable proof the page is
 * gated, and the real customers list/create-form wiring ran behind it.
 */

const listUsers = vi.fn();
const listPriceTiers = vi.fn();

vi.mock("@/modules/identity/application/dal", () => ({
  requireRole: vi.fn().mockResolvedValue({ role: "ADMIN" }),
  getScope: vi.fn().mockResolvedValue({ kind: "admin", userId: "admin-1" }),
}));
vi.mock("@/shared/db/client", () => ({ getDb: vi.fn() }));
vi.mock("@/modules/identity/infrastructure/drizzle-users-repository", () => ({
  DrizzleScopedUsersRepository: class {
    listUsers = listUsers;
  },
}));
vi.mock("@/modules/identity/infrastructure/drizzle-user-provisioning", () => ({
  DrizzleUserProvisioning: class {},
}));
vi.mock("@/modules/identity/infrastructure/drizzle-credentials-repository", () => ({
  DrizzleCredentialsRepository: class {},
}));
vi.mock("@/modules/identity/infrastructure/repository-factory", () => ({
  createDrizzleScopedCatalogRepositoryFactory: () => ({
    for: () => ({ listPriceTiers }),
  }),
}));

const customer = (email: string, tierId: string | null, deactivatedAt: Date | null = null) => ({
  id: `user-${email}`,
  email,
  role: "CUSTOMER" as const,
  resellerId: `tenant-${email}`,
  priceTierId: tierId,
  deactivatedAt,
});

const reseller = (email: string) => ({
  id: `user-${email}`,
  email,
  role: "RESELLER" as const,
  resellerId: `tenant-${email}`,
  priceTierId: "tier-1",
  deactivatedAt: null,
});

const tier = (id: string, code: string, name: string) => ({ id, code, name });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  listUsers.mockResolvedValue([]);
  listPriceTiers.mockResolvedValue([]);
});

describe("AdminCustomersPage (CI: Only ADMIN Provisions A Customer)", () => {
  it("gates the page behind requireRole('ADMIN')", async () => {
    render(<AdminCustomersPage />);

    await waitFor(() => expect(requireRole).toHaveBeenCalledWith("ADMIN"));
  });

  // `CustomersWorkspace` is an async Server Component; Testing Library
  // renders with the CLIENT renderer, which cannot resolve an async
  // component nested behind Suspense (see admin-views.test.tsx's identical
  // `renderWorkspace` helper for `CatalogWorkspace`). Awaiting the call
  // directly resolves it to plain elements — the component's own body,
  // including every real collaborator, still runs.
  async function renderWorkspace() {
    render(await CustomersWorkspace());
  }

  it("lists only CUSTOMER rows, excluding resellers seen through the same admin scope", async () => {
    listUsers.mockResolvedValue([
      customer("cliente@example.com", "tier-1"),
      reseller("revendedor@example.com"),
    ]);
    listPriceTiers.mockResolvedValue([tier("tier-1", "RETAIL", "Retail")]);

    await renderWorkspace();

    expect(screen.getByText("cliente@example.com")).toBeVisible();
    expect(screen.queryByText("revendedor@example.com")).not.toBeInTheDocument();
  });

  it("offers the create-customer form once a price tier exists", async () => {
    listPriceTiers.mockResolvedValue([tier("tier-1", "RETAIL", "Retail")]);

    await renderWorkspace();

    expect(screen.getByRole("button", { name: "Crear cliente" })).toBeVisible();
  });

  it("withholds the form when no price tier exists yet (CI: Retail Tier Is A Prerequisite For Provisioning)", async () => {
    await renderWorkspace();

    expect(
      screen.getByText("Cree un nivel de precio antes de dar de alta clientes."),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Crear cliente" })).not.toBeInTheDocument();
  });
});
