import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requireRole } from "@/modules/identity/application/dal";
import AdminCatalogPage from "./catalog/page";
import { CatalogWorkspace } from "./catalog/catalog-workspace";
import AdminLayout from "./layout";
import AdminPage from "./page";

const listPriceTiers = vi.fn();
const listServices = vi.fn();

vi.mock("@/modules/identity/application/dal", () => ({
  requireRole: vi.fn().mockResolvedValue({ role: "ADMIN" }),
  getScope: vi.fn().mockResolvedValue({ kind: "admin", userId: "admin-1" }),
}));
vi.mock("@/modules/identity/application/actions", () => ({ logout: vi.fn() }));

// Only the process boundaries are mocked — the database handle and the
// repository gate. Everything between them (the read model, the ordering, the
// tables, the empty states) is the real code under test.
vi.mock("@/shared/db/client", () => ({ getDb: vi.fn() }));
vi.mock("@/modules/identity/infrastructure/repository-factory", () => ({
  createDrizzleScopedCatalogRepositoryFactory: () => ({
    for: () => ({ listPriceTiers, listServices }),
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



/** Every suite starts from an empty catalog; each test fills in what it needs. */
function emptyCatalog() {
  listPriceTiers.mockResolvedValue([]);
  listServices.mockResolvedValue([]);
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

/** Scopes a query to one section, so a value repeated across two is unambiguous. */
function section(name: "Niveles de precio" | "Servicios") {
  return within(screen.getByRole("region", { name }));
}

beforeEach(() => {
  emptyCatalog();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("admin route wiring", () => {
  it("gives an ADMIN the responsive shell, dashboard, and catalog route link", async () => {
    const { container } = render(
      <AdminLayout>
        <AdminPage />
      </AdminLayout>,
    );

    expect(screen.getByRole("heading", { name: "Panel de administración" })).toBeVisible();
    expect(screen.getAllByRole("link", { name: "Catálogo" })[0]).toHaveAttribute(
      "href",
      "/admin/catalog",
    );
    expect(screen.getByRole("navigation", { name: "Navegación de administración" })).toHaveClass(
      "lg:flex-col",
    );
    expect(container.firstElementChild).toHaveClass("lg:grid-cols-[15rem_1fr]");
    await waitFor(() => expect(requireRole).toHaveBeenCalledWith("ADMIN"));
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
