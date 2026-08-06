import type { CatalogRepository } from "../../domain/catalog-repository";
import type { Service } from "../../domain/service";

/**
 * ADMIN use case: add a service (Netflix, Spotify, …) — the container every
 * plan hangs off.
 */

export type CreateServiceDeps = Readonly<{
  catalog: Pick<CatalogRepository, "createService" | "listServices">;
}>;

export type CreateServiceResult =
  | Readonly<{ ok: true; service: Service }>
  | Readonly<{
      ok: false;
      reason: "slug-required" | "slug-invalid" | "name-required" | "slug-taken";
    }>;

/**
 * Lower-case words joined by single hyphens — the shape a slug has to keep to
 * be usable in a URL segment. Leading, trailing, and doubled hyphens are
 * rejected rather than silently collapsed: quietly rewriting an operator's
 * input produces a slug they did not choose and cannot predict.
 */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function createServiceAsAdmin(
  deps: CreateServiceDeps,
  input: Readonly<{ slug: string; name: string; description?: string | null }>,
): Promise<CreateServiceResult> {
  const slug = input.slug.trim().toLowerCase();
  const name = input.name.trim();
  const description = input.description?.trim();

  if (slug === "") {
    return { ok: false, reason: "slug-required" };
  }
  if (!SLUG_PATTERN.test(slug)) {
    return { ok: false, reason: "slug-invalid" };
  }
  if (name === "") {
    return { ok: false, reason: "name-required" };
  }

  // Retirement is a soft delete (CAT: Service Retirement Preserves Plans), so
  // a retired service still occupies its slug in the UNIQUE index. Listing
  // every service — not just the active ones — is what keeps this check
  // honest about which slugs the database will actually accept.
  const existing = await deps.catalog.listServices();
  if (existing.some((service) => service.slug === slug)) {
    return { ok: false, reason: "slug-taken" };
  }

  return {
    ok: true,
    service: await deps.catalog.createService({
      slug,
      name,
      // An all-whitespace description is "no description", and a nullable
      // column must not carry two different spellings of absent.
      description: description === "" || description === undefined ? null : description,
    }),
  };
}
