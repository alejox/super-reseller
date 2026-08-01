import type { ServiceId } from "./ids";

export type Service = Readonly<{
  id: ServiceId;
  slug: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** CAT: Service Retirement Preserves Plans — soft delete, never removed. */
  retiredAt: Date | null;
}>;

export type NewServiceInput = Readonly<{
  slug: string;
  name: string;
  description?: string | null;
}>;

export function createService(input: NewServiceInput): Service {
  const now = new Date();
  return Object.freeze({
    id: crypto.randomUUID(),
    slug: input.slug,
    name: input.name,
    description: input.description ?? null,
    createdAt: now,
    updatedAt: now,
    retiredAt: null,
  });
}

export function retireService(service: Service, retiredAt: Date = new Date()): Service {
  return Object.freeze({ ...service, retiredAt, updatedAt: retiredAt });
}

export function isServiceRetired(service: Service): boolean {
  return service.retiredAt !== null;
}
