import { describe, expect, it } from "vitest";

import { createService, isServiceRetired, retireService } from "./service";

// CAT: Service Retirement Preserves Plans (domain-level: the entity itself
// is soft-deleted, never removed).
describe("retireService", () => {
  it("marks a service retired without changing its identity", () => {
    const service = createService({ slug: "netflix", name: "Netflix" });
    expect(isServiceRetired(service)).toBe(false);

    const retired = retireService(service);

    expect(retired.id).toBe(service.id);
    expect(retired.slug).toBe(service.slug);
    expect(isServiceRetired(retired)).toBe(true);
    expect(retired.retiredAt).not.toBeNull();
  });
});
