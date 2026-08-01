import type { PriceTierId } from "./ids";

export type PriceTier = Readonly<{
  id: PriceTierId;
  code: string;
  name: string;
  createdAt: Date;
  archivedAt: Date | null;
}>;

export type NewPriceTierInput = Readonly<{
  code: string;
  name: string;
}>;

export function createPriceTier(input: NewPriceTierInput): PriceTier {
  return Object.freeze({
    id: crypto.randomUUID(),
    code: input.code,
    name: input.name,
    createdAt: new Date(),
    archivedAt: null,
  });
}
