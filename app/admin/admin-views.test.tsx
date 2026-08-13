import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requireRole } from "@/modules/identity/application/dal";
import AdminCatalogPage from "./catalog/page";
import { CatalogWorkspace } from "./catalog/catalog-workspace";
import AdminLayout from "./layout";
import AdminPage from "./page";

const listPriceTiers = vi.fn();
const listServices = vi.fn();
const listPlans = vi.fn();
const listCurrentPlanPrices = vi.fn();

vi.mock("@/modules/identity/application/dal", () => ({
  requireRole: vi.fn().mockResolvedValue({ role: "ADMIN" }),
  getScope: vi.fn().mockResolvedValue({ kind: "admin", userId: "admin-1" }),
}));
vi.mock("@/modules/identity/application/actions", () => ({ logout: vi.fn() }));

/**
 * The route the nav thinks it is on. `null` is the real default — that is
 * what `usePathname()` returns with no router mounted, and `AdminNavigation`
 * has to survive it.
 */
let currentPathname: string | null = null;

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => currentPathname,
}));

// Only the process boundaries are mocked — the database handle and the
// repository gate. Everything between them (the read model, the ordering, the
// tables, the empty states) is the real code under test.
vi.mock("@/shared/db/client", () => ({ getDb: vi.fn() }));
vi.mock("@/modules/identity/infrastructure/repository-factory", () => ({
  createDrizzleScopedCatalogRepositoryFactory: () => ({
    for: () => ({ listPriceTiers, listServices, listPlans, listCurrentPlanPrices }),
  }),
}));

const tier = (code: string, name: string) => ({
  id: `tier-${code}`,
  code,
  name,
  createdAt: new Date(),
  archivedAt: null,
});

const service = (slug: string, name: string, description: string | null = null) => ({
  id: `service-${slug}`,
  slug,
  name,
  description,
  createdAt: new Date(),
  updatedAt: new Date(),
  retiredAt: null,
});

const plan = (id: string, serviceSlug: string, name: string, durationDays = 30) => ({
  id,
  serviceId: `service-${serviceSlug}`,
  name,
  kind: "SCREEN" as const,
  durationDays,
  createdAt: new Date(),
  updatedAt: new Date(),
  retiredAt: null,
});

const price = (planId: string, tierCode: string, amountMinor: number) => ({
  id: `price-${planId}-${tierCode}`,
  planId,
  priceTierId: `tier-${tierCode}`,
  amountMinor,
  currency: "COP",
  effectiveFrom: new Date(),
  effectiveTo: null,
});

/** Every suite starts from an empty catalog; each test fills in what it needs. */
function emptyCatalog() {
  listPriceTiers.mockResolvedValue([]);
  listServices.mockResolvedValue([]);
  listPlans.mockResolvedValue([]);
  listCurrentPlanPrices.mockResolvedValue([]);
}

/**
 * `CatalogWorkspace` is an async Server Component, and Testing Library renders
 * with the CLIENT renderer, which refuses to render an async component
 * ("Only Server Components can be async at the moment"). Awaiting the call
 * resolves it to plain elements the client renderer accepts — the component's
 * own body, including every real collaborator, still runs.
 */
async function renderWorkspace() {
  render(await CatalogWorkspace());
}

/**
 * Scopes a query to one section. The three sections legitimately repeat text
 * — a service slug labels both its own row and its plan group — so an
 * unscoped `getByText` is ambiguous by design, not by accident.
 */
function section(name: "Niveles de precio" | "Servicios" | "Planes") {
  return within(screen.getByRole("region", { name }));
}

beforeEach(() => {
  emptyCatalog();
  currentPathname = null;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("admin route wiring", () => {
  /**
   * Rewritten against the shell that actually exists.
   *
   * The previous version asserted a heading ("Panel de administración"), a
   * link ("Catálogo" -> /admin/catalog) and two Tailwind classes
   * (`lg:flex-col`, `lg:grid-cols-[15rem_1fr]`) from the layout that the
   * 2026-08 redesign replaced. The class assertions are NOT reinstated in a
   * new spelling: pinning a test to utility classes is what made this rot
   * silently instead of failing on the change that caused it. What it checks
   * now is what the shell is FOR — the role gate, the dashboard, and nav
   * links that go where they say.
   *
   */
  it("gives an ADMIN the shell, the dashboard, and nav links that resolve", async () => {
    render(
      <AdminLayout>
        <AdminPage />
      </AdminLayout>,
    );

    expect(screen.getByRole("heading", { name: "Overview" })).toBeVisible();

    const nav = within(screen.getByRole("navigation"));
    expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/admin");
    // Restored after the redesign left `/admin/catalog` reachable only by
    // typing the URL. This is the assertion that keeps it reachable.
    expect(nav.getByRole("link", { name: "Catálogo" })).toHaveAttribute("href", "/admin/catalog");
    expect(nav.getByRole("link", { name: "Account Inventory" })).toHaveAttribute(
      "href",
      "/admin/inventory",
    );
    expect(nav.getByRole("link", { name: "Pagos por validar" })).toHaveAttribute(
      "href",
      "/admin/payments",
    );
    expect(nav.getByRole("link", { name: "Financials" })).toHaveAttribute("href", "/admin/orders");

    await waitFor(() => expect(requireRole).toHaveBeenCalledWith("ADMIN"));
  });

  /**
   * `aria-current`, not a Tailwind class. The active item used to be marked
   * by colour alone — invisible to a screen reader, and untestable except by
   * pinning the test to utility classes, which is exactly how the previous
   * version of this suite rotted through a redesign without failing.
   */
  it.each([
    ["/admin/orders/8f2c-order-id", "Financials"],
    ["/admin/inventory/upload", "Account Inventory"],
    ["/admin/settings/topups", "Settings"],
    ["/admin/catalog", "Catálogo"],
  ])("marks the section owning %s as the current page", (pathname, expectedItem) => {
    currentPathname = pathname;

    render(
      <AdminLayout>
        <AdminPage />
      </AdminLayout>,
    );

    const current = within(screen.getByRole("navigation")).getByRole("link", { current: "page" });
    expect(current).toHaveAccessibleName(expectedItem);
  });

  it("does not leave Dashboard permanently current just because every route starts with /admin", () => {
    currentPathname = "/admin/resellers";

    render(
      <AdminLayout>
        <AdminPage />
      </AdminLayout>,
    );

    const nav = within(screen.getByRole("navigation"));
    expect(nav.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
    expect(nav.getByRole("link", { name: "Reseller Network" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("renders the nav when there is no router context to read a pathname from", () => {
    // `usePathname()` returns null here, exactly as it does before the client
    // router mounts. `AdminNavigation` used to call `.startsWith` on it and
    // take the entire admin shell down with a TypeError.
    expect(() =>
      render(
        <AdminLayout>
          <AdminPage />
        </AdminLayout>,
      ),
    ).not.toThrow();
  });

  it("mounts the catalog page behind authorization and reads the real catalog", async () => {
    render(<AdminCatalogPage />);

    expect(screen.getByRole("heading", { name: "Gestión del catálogo" })).toBeVisible();
    // These two calls are made ONLY by CatalogWorkspace, so observing them is
    // what proves the page actually mounted it behind its Suspense boundary —
    // the client renderer cannot produce the workspace's own markup here.
    await waitFor(() => expect(requireRole).toHaveBeenCalledWith("ADMIN"));
    await waitFor(() => expect(listPriceTiers).toHaveBeenCalled());
    await waitFor(() => expect(listServices).toHaveBeenCalled());
  });
});

describe("catalog workspace", () => {
  it("renders price tiers and services from the repository", async () => {
    listPriceTiers.mockResolvedValue([tier("MAYOR", "Mayorista")]);
    listServices.mockResolvedValue([service("netflix", "Netflix", "Streaming de video")]);

    await renderWorkspace();

    expect(screen.getByRole("heading", { name: "Niveles de precio" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Servicios" })).toBeVisible();
    expect(section("Niveles de precio").getByText("MAYOR")).toBeVisible();
    expect(section("Niveles de precio").getByText("Mayorista")).toBeVisible();
    expect(section("Servicios").getByText("netflix")).toBeVisible();
    expect(section("Servicios").getByText("Streaming de video")).toBeVisible();
  });

  it("orders rows deterministically rather than by insertion", async () => {
    listPriceTiers.mockResolvedValue([tier("MINOR", "Minorista"), tier("MAYOR", "Mayorista")]);
    listServices.mockResolvedValue([service("spotify", "Spotify"), service("disney", "Disney+")]);

    await renderWorkspace();

    const codes = screen.getAllByRole("row").map((row) => row.textContent ?? "");
    expect(codes.findIndex((t) => t.includes("MAYOR"))).toBeLessThan(
      codes.findIndex((t) => t.includes("MINOR")),
    );
    expect(codes.findIndex((t) => t.includes("Disney+"))).toBeLessThan(
      codes.findIndex((t) => t.includes("Spotify")),
    );
  });

  it("offers the creation controls for both sections", async () => {
    await renderWorkspace();

    expect(screen.getByRole("button", { name: "Crear nivel" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Crear servicio" })).toBeVisible();
  });

  it("tells the operator what to do when the catalog is empty", async () => {
    await renderWorkspace();

    // An empty catalog is the state EVERY new installation starts in, so the
    // screen names the next action instead of rendering two blank tables.
    expect(screen.getByText(/Todavía no hay niveles de precio/i)).toBeVisible();
    expect(screen.getByText(/Todavía no hay servicios/i)).toBeVisible();
    // Tripwire for the placeholder this screen replaced: if that copy comes
    // back, the screen has silently regressed to a mock-up.
    expect(screen.queryByText(/aún no están disponibles/i)).not.toBeInTheDocument();
  });

  it("shows a retired service instead of hiding it", async () => {
    listServices.mockResolvedValue([{ ...service("netflix", "Netflix"), retiredAt: new Date() }]);

    await renderWorkspace();

    // A retired service still owns its slug in the UNIQUE index; hiding it
    // would leave the operator unable to explain why that slug is refused.
    expect(screen.getByText("netflix")).toBeVisible();
    expect(screen.getByText("Retirado")).toBeVisible();
  });
});

describe("catalog workspace: plans", () => {
  /** A catalog with two tiers, one service and one plan priced at MAYOR only. */
  function catalogWithOnePlan() {
    listPriceTiers.mockResolvedValue([tier("MAYOR", "Mayorista"), tier("MINOR", "Minorista")]);
    listServices.mockResolvedValue([service("netflix", "Netflix")]);
    listPlans.mockResolvedValue([plan("plan-1", "netflix", "1 Pantalla")]);
    listCurrentPlanPrices.mockResolvedValue([price("plan-1", "MAYOR", 12000)]);
  }

  it("renders a plan row with one column per tier", async () => {
    catalogWithOnePlan();

    await renderWorkspace();

    expect(screen.getByRole("heading", { name: "Planes" })).toBeVisible();

    // Assert on the ROW, not on loose text: "Pantalla" is also an option in
    // the kind select, so a bare getByText would be ambiguous.
    const row = section("Planes")
      .getAllByRole("row")
      .find((candidate) => candidate.textContent?.includes("1 Pantalla"));
    expect(row).toBeDefined();
    expect(row?.textContent).toContain("Pantalla");
    expect(row?.textContent).toContain("30 días");

    // One column per tier, plus Plan / Tipo / Duración.
    expect(section("Planes").getAllByRole("columnheader")).toHaveLength(5);
  });

  it("formats a priced tier as money and names an unpriced tier as unsellable", async () => {
    catalogWithOnePlan();

    await renderWorkspace();

    // COP has no fractional unit, so 12000 minor units IS $12.000 — the
    // formatter divides by 10^0 here, not 10^2.
    expect(screen.getByText(/\$\s?12\.000/)).toBeVisible();
    // The whole point of the matrix: an empty cell must say why it matters.
    expect(screen.getByText(/Sin precio — no se vende/)).toBeVisible();
  });

  it("pre-fills the price control of a priced tier and leaves the unpriced one blank", async () => {
    catalogWithOnePlan();

    await renderWorkspace();

    const priceInputs = screen.getAllByRole("spinbutton", { name: "Precio" });
    expect(priceInputs).toHaveLength(2);
    expect(priceInputs[0]).toHaveValue(12000);
    expect(priceInputs[1]).toHaveValue(null);
  });

  it("refuses to offer the plan form until a tier exists", async () => {
    listServices.mockResolvedValue([service("netflix", "Netflix")]);

    await renderWorkspace();

    // `createPlanWithInitialPrice` demands a tier, so a plan form here could
    // only ever produce a rejection the operator cannot act on.
    expect(screen.getByText(/Cree un nivel de precio antes de cargar planes/i)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Crear plan" })).not.toBeInTheDocument();
  });

  it("refuses to offer the plan form until a service exists", async () => {
    listPriceTiers.mockResolvedValue([tier("MAYOR", "Mayorista")]);

    await renderWorkspace();

    expect(screen.getByText(/Cree un servicio antes de cargar planes/i)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Crear plan" })).not.toBeInTheDocument();
  });

  it("offers the plan form once both exist, even with no plans yet", async () => {
    listPriceTiers.mockResolvedValue([tier("MAYOR", "Mayorista")]);
    listServices.mockResolvedValue([service("netflix", "Netflix")]);

    await renderWorkspace();

    expect(screen.getByRole("button", { name: "Crear plan" })).toBeVisible();
    expect(screen.getByText(/Este servicio todavía no tiene planes/i)).toBeVisible();
  });

  it("groups plans under their own service", async () => {
    listPriceTiers.mockResolvedValue([tier("MAYOR", "Mayorista")]);
    listServices.mockResolvedValue([service("netflix", "Netflix"), service("spotify", "Spotify")]);
    listPlans.mockResolvedValue([
      plan("plan-n", "netflix", "Netflix Pantalla"),
      plan("plan-s", "spotify", "Spotify Familiar"),
    ]);
    listCurrentPlanPrices.mockResolvedValue([]);

    await renderWorkspace();

    // Two services means two plan forms, each bound to its own service id.
    expect(screen.getAllByRole("button", { name: "Crear plan" })).toHaveLength(2);
    expect(screen.getByText("Netflix Pantalla")).toBeVisible();
    expect(screen.getByText("Spotify Familiar")).toBeVisible();
  });
});
