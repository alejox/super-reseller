import { describe, expect, it } from "vitest";

import { summarizeError } from "./errors";

describe("summarizeError", () => {
  // The exact shape that leaked onto the operator's screen, escape codes and
  // all, before this function existed.
  it("keeps the sentence and drops Playwright's call log", () => {
    const raw = new Error(
      "locator.waitFor: Timeout 20000ms exceeded.\nCall log:\n[2m  - waiting for getByText(/Puntos/).first() to be visible[22m",
    );

    expect(summarizeError(raw)).toBe("locator.waitFor: Timeout 20000ms exceeded.");
  });

  it("strips ANSI sequences wherever they sit", () => {
    expect(summarizeError(new Error("[2mtimeout[22m al abrir el panel"))).toBe(
      "timeout al abrir el panel",
    );
  });

  it("caps a long message rather than filling the banner", () => {
    const summary = summarizeError(new Error("x".repeat(500)));

    expect(summary.length).toBeLessThanOrEqual(180);
    expect(summary.endsWith("…")).toBe(true);
  });

  it("handles a thrown non-Error", () => {
    expect(summarizeError("algo se rompió")).toBe("algo se rompió");
  });

  it("never returns an empty string", () => {
    expect(summarizeError(new Error("\n\n"))).toBe("Error desconocido");
  });
});
