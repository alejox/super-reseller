import type { PlanId, ServiceId } from "./ids";

/**
 * Owner-confirmed exactly two kinds, kept as a `text` CHECK (not a Postgres
 * enum) at the schema level — see design.md "Decision: `role` is a Postgres
 * enum; `plan.kind` is `text` + CHECK". A third domain-licensed kind may be
 * added later; enum values can never be removed once shipped.
 */
export type PlanKind = "SCREEN" | "FULL_ACCOUNT";

export type Plan = Readonly<{
  id: PlanId;
  serviceId: ServiceId;
  name: string;
  kind: PlanKind;
  /**
   * CAT: Duration Is a First-Class Field. This is the modeling fix for the
   * WooCommerce original: duration is a real integer column, never parsed
   * from `name`.
   */
  durationDays: number;
  createdAt: Date;
  updatedAt: Date;
  retiredAt: Date | null;
}>;

export class InvalidPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPlanError";
  }
}

export class DuplicatePlanIdentityError extends Error {
  constructor(serviceId: ServiceId, kind: PlanKind, durationDays: number) {
    super(
      `An active plan already exists for service "${serviceId}" with kind "${kind}" and durationDays ${durationDays} (plan_identity_uniq).`,
    );
    this.name = "DuplicatePlanIdentityError";
  }
}

export type NewPlanInput = Readonly<{
  serviceId: ServiceId;
  name: string;
  kind: PlanKind;
  durationDays: number;
}>;

export function createPlan(input: NewPlanInput): Plan {
  if (!Number.isInteger(input.durationDays) || input.durationDays <= 0) {
    throw new InvalidPlanError(
      `durationDays must be a positive integer, got ${JSON.stringify(input.durationDays)}.`,
    );
  }
  if (!input.name.trim()) {
    throw new InvalidPlanError("name must not be empty.");
  }

  const now = new Date();
  return Object.freeze({
    id: crypto.randomUUID(),
    serviceId: input.serviceId,
    name: input.name,
    kind: input.kind,
    durationDays: input.durationDays,
    createdAt: now,
    updatedAt: now,
    retiredAt: null,
  });
}

/**
 * CAT: Duration Is a First-Class Field. Always reads the stored integer
 * column — there is no name-parsing path to accidentally call instead.
 */
export function planDurationDays(plan: Plan): number {
  return plan.durationDays;
}

/** Soft-retires a plan while retaining it for history and foreign-key references. */
export function retirePlan(plan: Plan, retiredAt: Date = new Date()): Plan {
  return Object.freeze({ ...plan, retiredAt, updatedAt: retiredAt });
}
