import { describe, expect, it } from "vitest";

import { InvalidPlanError, createPlan, planDurationDays } from "./plan";

// CAT: Duration Is a First-Class Field.
describe("planDurationDays", () => {
  it("reads duration from duration_days, independent of the plan's display name", () => {
    const plan = createPlan({
      serviceId: "11111111-1111-1111-1111-111111111111",
      // Name deliberately references a different number of days than the
      // stored field, to prove the reader never parses the name.
      name: "Netflix Pantalla 60 días",
      kind: "SCREEN",
      durationDays: 30,
    });

    expect(planDurationDays(plan)).toBe(30);
  });

  it("rejects a non-positive duration", () => {
    expect(() =>
      createPlan({
        serviceId: "11111111-1111-1111-1111-111111111111",
        name: "Netflix Pantalla",
        kind: "SCREEN",
        durationDays: 0,
      }),
    ).toThrow(InvalidPlanError);
  });

  it("rejects a non-integer duration", () => {
    expect(() =>
      createPlan({
        serviceId: "11111111-1111-1111-1111-111111111111",
        name: "Netflix Pantalla",
        kind: "SCREEN",
        durationDays: 30.5,
      }),
    ).toThrow(InvalidPlanError);
  });
});
