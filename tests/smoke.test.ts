import { describe, expect, it } from "vitest";

describe("test harness smoke test", () => {
  it("runs Vitest through the configured npm test script", () => {
    // GREEN (task 1.6): the harness is wired — vitest.config.ts, jsdom
    // environment, and `npm test` all resolve. This trivial assertion
    // proves the runner itself works; behavioral coverage lives in each
    // module's own test files from slice 3 onward.
    expect(true).toBe(true);
  });
});
