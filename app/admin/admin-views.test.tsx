import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { requireRole } from "@/modules/identity/application/dal";
import AdminCatalogPage from "./catalog/page";
import AdminLayout from "./layout";
import AdminPage from "./page";

vi.mock("@/modules/identity/application/dal", () => ({
  requireRole: vi.fn().mockResolvedValue({ role: "ADMIN" }),
}));
vi.mock("@/modules/identity/application/actions", () => ({ logout: vi.fn() }));

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

  it("wires the catalog page to authorization and an honest non-mutating view", async () => {
    render(<AdminCatalogPage />);

    expect(screen.getByRole("heading", { name: "Gestión del catálogo" })).toBeVisible();
    expect(screen.getByText(/Los controles de creación y edición aún no están disponibles/i)).toBeVisible();
    expect(screen.getByRole("link", { name: "Volver al panel" })).toHaveAttribute(
      "href",
      "/admin",
    );
    expect(screen.queryByRole("button", { name: /crear/i })).not.toBeInTheDocument();
    await waitFor(() => expect(requireRole).toHaveBeenCalledWith("ADMIN"));
  });
});
