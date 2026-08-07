import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { requireRole } from "@/modules/identity/application/dal";

/**
 * Closes the second live bug design.md calls out for `/panel`: today
 * `app/panel/page.tsx` calls only `verifySession()`, so an ADMIN can render
 * it and see unfiltered reseller wallet/order data — `tenantWhere` returns
 * no filter for an admin scope. `route-access.ts`'s proxy-level gate is an
 * "optimistic check only" (AUTH: Proxy Performs an Optimistic Check Only),
 * so the PAGE itself must also assert `requireRole("RESELLER")`, mirroring
 * `app/admin/page.tsx`'s `AdminAccessStatus` defense-in-depth pattern.
 */

vi.mock("@/modules/identity/application/dal", () => ({
  verifySession: vi.fn().mockResolvedValue({
    sessionId: "session-1",
    userId: "reseller-1",
    role: "RESELLER",
    resellerId: "reseller-1",
    priceTierId: "tier-1",
  }),
  requireRole: vi.fn().mockResolvedValue({
    sessionId: "session-1",
    userId: "reseller-1",
    role: "RESELLER",
    resellerId: "reseller-1",
    priceTierId: "tier-1",
  }),
}));
vi.mock("../logout-button", () => ({ LogoutButton: () => null }));
vi.mock("./reseller-catalog", () => ({ ResellerCatalog: () => null }));
vi.mock("./reseller-orders", () => ({ ResellerOrders: () => null }));
vi.mock("./reseller-wallet", () => ({ ResellerWallet: () => null }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PanelPage (RESELLER-only defense in depth)", () => {
  it("asserts requireRole('RESELLER') when rendered, not just verifySession()", async () => {
    const { default: PanelPage } = await import("./page");
    render(<PanelPage />);

    await waitFor(() => expect(requireRole).toHaveBeenCalledWith("RESELLER"));
  });

  it("still renders the panel shell for a real RESELLER session", async () => {
    const { default: PanelPage } = await import("./page");
    render(<PanelPage />);

    expect(screen.getByRole("heading", { name: "Panel" })).toBeVisible();
  });
});
