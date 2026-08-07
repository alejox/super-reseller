import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requireRole } from "@/modules/identity/application/dal";
import AccountPage from "./page";
import { AccountWorkspace } from "./account-workspace";

/**
 * PA: A Customer Creates Their Own Provider Account. Mirrors
 * `app/admin/customers/customers-access.test.tsx`'s pattern: `requireRole`
 * having been called with "CUSTOMER" is the observable proof the page is
 * gated, and the real list/create-form wiring ran behind it.
 */

const listForTenant = vi.fn();
const listSellablePlans = vi.fn();

vi.mock("@/modules/identity/application/dal", () => ({
  requireRole: vi.fn().mockResolvedValue({ role: "CUSTOMER", userId: "customer-1" }),
  getScope: vi.fn().mockResolvedValue({
    kind: "customer",
    userId: "customer-1",
    tenantId: "tenant-1",
    priceTierId: "tier-1",
    actingAdminUserId: null,
  }),
}));
vi.mock("@/shared/db/client", () => ({ getDb: vi.fn() }));
vi.mock("@/modules/provider-accounts/infrastructure/drizzle-provider-account-repository", () => ({
  DrizzleProviderAccountRepository: class {
    listForTenant = listForTenant;
  },
}));
vi.mock("@/modules/identity/infrastructure/repository-factory", () => ({
  createDrizzleScopedCatalogRepositoryFactory: () => ({
    for: () => ({ listSellablePlans }),
  }),
}));

const account = (id: string, panelUsername: string, serviceId = "service-1") => ({
  id,
  tenantId: "tenant-1",
  serviceId,
  panelUsername,
  label: null,
  createdBy: "customer-1",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  archivedAt: null,
});

const sellablePlan = (serviceId: string, serviceName: string) => ({
  plan: { id: `plan-${serviceId}`, serviceId, name: "Plan", kind: "SCREEN", durationDays: 30, createdAt: new Date(), updatedAt: new Date(), retiredAt: null },
  price: { amountMinor: 10_000, currency: "COP" },
  planPriceId: `price-${serviceId}`,
  serviceName,
  serviceSlug: serviceName.toLowerCase(),
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  listForTenant.mockResolvedValue([]);
  listSellablePlans.mockResolvedValue([]);
});

describe("AccountPage (PA: A Customer Creates Their Own Provider Account)", () => {
  it("gates the page behind requireRole('CUSTOMER')", async () => {
    render(<AccountPage />);

    await waitFor(() => expect(requireRole).toHaveBeenCalledWith("CUSTOMER"));
  });

  // Async Server Component behind Suspense — same `render(await Workspace())`
  // shape as `customers-access.test.tsx`'s `renderWorkspace` helper.
  async function renderWorkspace() {
    render(await AccountWorkspace());
  }

  it("lists this customer's own provider_account rows", async () => {
    listForTenant.mockResolvedValue([account("pa-1", "stella_juan_2024")]);

    await renderWorkspace();

    expect(screen.getByText("stella_juan_2024")).toBeVisible();
  });

  it("offers the create-account form once at least one service is sellable at this tier", async () => {
    listSellablePlans.mockResolvedValue([sellablePlan("service-1", "Stella TV")]);

    await renderWorkspace();

    expect(screen.getByRole("button", { name: "Agregar cuenta" })).toBeVisible();
  });

  it("shows an empty-state message when this customer owns no accounts yet", async () => {
    await renderWorkspace();

    expect(screen.getByText("Todavía no tiene cuentas registradas.")).toBeVisible();
  });
});
