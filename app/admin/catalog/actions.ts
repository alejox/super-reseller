"use server";

import { refresh } from "next/cache";

import { createPriceTierAsAdmin } from "@/modules/catalog/application/admin/create-price-tier";
import { createServiceAsAdmin } from "@/modules/catalog/application/admin/create-service";
import { adminCatalogRepository } from "./admin-catalog-repository";

/**
 * Catalog Server Actions.
 *
 * These live in `app/` rather than in `src/modules/catalog/application/`
 * because they are composition, not domain logic: they wire identity's DAL to
 * catalog's use cases. eslint.config.mjs forbids `catalog/application` from
 * importing `@/modules/identity/*` at all, so a "catalog action" that calls
 * `requireRole` is not expressible inside the module — and should not be.
 * `app/` is the composition root; it is the one place allowed to know both.
 *
 * Every action re-authorizes itself. A Server Action is a public POST
 * endpoint: an attacker can invoke it without ever loading the page whose
 * form calls it, so the page's own gate proves nothing here.
 */

export type CatalogFormState = { readonly error: string } | undefined;

const PRICE_TIER_ERRORS = {
  "code-required": "Ingrese un código.",
  "code-invalid": "El código admite solo mayúsculas, números y guion bajo, y debe comenzar con una letra.",
  "name-required": "Ingrese un nombre.",
  "code-taken": "Ya existe un nivel de precio con ese código.",
} as const;

const SERVICE_ERRORS = {
  "slug-required": "Ingrese un identificador.",
  "slug-invalid": "El identificador admite solo minúsculas, números y guiones simples entre palabras.",
  "name-required": "Ingrese un nombre.",
  "slug-taken": "Ya existe un servicio con ese identificador.",
} as const;

export async function createPriceTierAction(
  _state: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  const catalog = await adminCatalogRepository();

  const result = await createPriceTierAsAdmin(
    { catalog },
    {
      code: String(formData.get("code") ?? ""),
      name: String(formData.get("name") ?? ""),
    },
  );

  if (!result.ok) {
    return { error: PRICE_TIER_ERRORS[result.reason] };
  }

  // The catalog lists are read per request and never cached, so the router
  // cache is the only stale copy — `refresh()` clears exactly that. There is
  // no `use cache` tag to revalidate here, and adding one would put the DAL's
  // request-scoped reads into a cross-request cache.
  refresh();
  return undefined;
}

export async function createServiceAction(
  _state: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  const catalog = await adminCatalogRepository();

  const result = await createServiceAsAdmin(
    { catalog },
    {
      slug: String(formData.get("slug") ?? ""),
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
    },
  );

  if (!result.ok) {
    return { error: SERVICE_ERRORS[result.reason] };
  }

  refresh();
  return undefined;
}
