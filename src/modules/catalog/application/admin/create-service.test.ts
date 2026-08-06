import { describe, expect, it } from "vitest";

import { InMemoryCatalogRepository } from "../../infrastructure/in-memory-catalog-repository";
import { createServiceAsAdmin } from "./create-service";

function deps() {
  return { catalog: new InMemoryCatalogRepository() };
}

describe("createServiceAsAdmin", () => {
  it("creates a service and returns it", async () => {
    const d = deps();

    const result = await createServiceAsAdmin(d, { slug: "netflix", name: "Netflix" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.service.slug).toBe("netflix");
    expect(result.service.name).toBe("Netflix");
    expect(result.service.retiredAt).toBeNull();
    expect(await d.catalog.listServices()).toHaveLength(1);
  });

  it("lower-cases and trims the slug before storing it", async () => {
    const result = await createServiceAsAdmin(deps(), { slug: "  NetFlix  ", name: " Netflix " });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.service.slug).toBe("netflix");
    expect(result.service.name).toBe("Netflix");
  });

  it("stores an omitted description as null rather than an empty string", async () => {
    const result = await createServiceAsAdmin(deps(), {
      slug: "netflix",
      name: "Netflix",
      description: "   ",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // `description` is a nullable column: "absent" must be one value, not two.
    expect(result.service.description).toBeNull();
  });

  it("keeps a real description", async () => {
    const result = await createServiceAsAdmin(deps(), {
      slug: "netflix",
      name: "Netflix",
      description: "  Streaming de video  ",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.service.description).toBe("Streaming de video");
  });

  it("rejects a duplicate slug that differs only by case", async () => {
    const d = deps();
    await createServiceAsAdmin(d, { slug: "netflix", name: "Netflix" });

    const result = await createServiceAsAdmin(d, { slug: "NETFLIX", name: "Otro" });

    expect(result).toEqual({ ok: false, reason: "slug-taken" });
    expect(await d.catalog.listServices()).toHaveLength(1);
  });

  it("rejects a slug already used by a RETIRED service", async () => {
    const d = deps();
    const created = await createServiceAsAdmin(d, { slug: "netflix", name: "Netflix" });
    if (!created.ok) throw new Error("setup failed");
    await d.catalog.retireService(created.service.id);

    const result = await createServiceAsAdmin(d, { slug: "netflix", name: "Netflix otra vez" });

    // Retirement is a SOFT delete (CAT: Service Retirement Preserves Plans),
    // so the row — and its UNIQUE slug — is still there. Reporting the clash
    // beats letting the database raise a raw constraint violation.
    expect(result).toEqual({ ok: false, reason: "slug-taken" });
  });

  it.each([
    ["", "slug-required"],
    ["   ", "slug-required"],
    ["net flix", "slug-invalid"],
    ["-netflix", "slug-invalid"],
    ["netflix-", "slug-invalid"],
    ["net--flix", "slug-invalid"],
    ["netflix_hd", "slug-invalid"],
  ])("refuses the slug %j with reason %s", async (slug, reason) => {
    const result = await createServiceAsAdmin(deps(), { slug, name: "Nombre" });

    expect(result).toEqual({ ok: false, reason });
  });

  it("refuses an empty name", async () => {
    const result = await createServiceAsAdmin(deps(), { slug: "netflix", name: "  " });

    expect(result).toEqual({ ok: false, reason: "name-required" });
  });

  it("writes nothing when validation fails", async () => {
    const d = deps();

    await createServiceAsAdmin(d, { slug: "no válido", name: "Nombre" });

    expect(await d.catalog.listServices()).toEqual([]);
  });
});
