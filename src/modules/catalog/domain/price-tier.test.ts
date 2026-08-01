import { describe, expect, it } from "vitest";

import { createPriceTier } from "./price-tier";

describe("createPriceTier", () => {
  it("creates an active (non-archived) tier with a generated id", () => {
    const tier = createPriceTier({ code: "TIER_A", name: "Tier A" });

    expect(tier.id).toBeTruthy();
    expect(tier.code).toBe("TIER_A");
    expect(tier.archivedAt).toBeNull();
  });
});
