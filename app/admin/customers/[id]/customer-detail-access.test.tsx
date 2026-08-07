import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requireRole } from "@/modules/identity/application/dal";
import AdminCustomerDetailPage from "./page";
import { CustomerDetailWorkspace } from "./customer-detail-workspace";

/**
 * PA: Provider Account Isolation / ADMIN May Create A Provider Account On A
 * Customer's Behalf. Mirrors `app/admin/customers/customers-access.test.tsx`.
 */

const listUsers = vi.fn();
const listForTenant = vi.fn();
const listServices = vi.fn();

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
vi.mock("@/modules/provider-accounts/infrastructure/drizzle-provider-account-repository", () => ({
  DrizzleProviderAccountRepository: class {
    listForTenant = listForTenant;
  },
}));
vi.mock("@/modules/identity/infrastructure/repository-factory", () => ({
  createDrizzleScopedCatalogRepositoryFactory: () => ({
    for: () => ({ listServices }),
  }),
}));

const customer = (id: string, email: string, tenantId: string) => ({
  id,
  email,
  role: "CUSTOMER" as const,
  resellerId: tenantId,
  priceTierId: "tier-1",
  deactivatedAt: null,
});

const account = (id: string, tenantId: string, panelUsername: string, serviceId = "service-1") => ({
  id,
  tenantId,
  serviceId,
  panelUsername,
  label: null,
  createdBy: "admin-1",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  archivedAt: null,
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  listUsers.mockResolvedValue([customer("customer-1", "cliente@example.com", "tenant-1")]);
  listForTenant.mockResolvedValue([]);
  listServices.mockResolvedValue([]);
});

describe("AdminCustomerDetailPage (PA: Provider Account Isolation)", () => {
  it("gates the page behind requireRole('ADMIN')", async () => {
    render(await AdminCustomerDetailPage({ params: Promise.resolve({ id: "customer-1" }) }));

    await waitFor(() => expect(requireRole).toHaveBeenCalledWith("ADMIN"));
  });

  it("shows the target customer's provider_account rows read-only", async () => {
    listForTenant.mockResolvedValue([account("pa-1", "tenant-1", "stella_juan_2024")]);

    render(await CustomerDetailWorkspace({ targetUserId: "customer-1" }));

    expect(screen.getByText("stella_juan_2024")).toBeVisible();
    expect(listForTenant).toHaveBeenCalledWith("tenant-1");
  });

  it("offers an on-behalf create form naming the target customer", async () => {
    listServices.mockResolvedValue([{ id: "service-1", slug: "stella-tv", name: "Stella TV", description: null, createdAt: new Date(), updatedAt: new Date(), retiredAt: null }]);

    render(await CustomerDetailWorkspace({ targetUserId: "customer-1" }));

    const hidden = screen.getByDisplayValue("customer-1") as HTMLInputElement;
    expect(hidden).toHaveAttribute("name", "targetUserId");
    expect(screen.getByRole("button", { name: "Agregar cuenta" })).toBeVisible();
  });
});
