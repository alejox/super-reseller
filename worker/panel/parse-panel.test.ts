import { describe, expect, it } from "vitest";

import {
  buildBuckets,
  PanelParseError,
  parseOwnCredits,
  parsePoints,
  parsePointsCell,
} from "./parse-panel";

/**
 * The header exactly as `innerText` returns it from the live panel — captured
 * from `syainj.pro-reventa.net`, not transcribed from a screenshot.
 *
 * THE NUMBER IS ON ITS OWN LINE. The label, the figure and the "(1 punto = …)"
 * note are three separate elements, so they arrive as three lines. A regex
 * written from the screenshot — where they look like one line — matches
 * nothing here, which is exactly how the first sync failed.
 */
const HEADER = `Créditos:
Puntos mensuales (Plan de 3 Dispositivos)：
0
(1 punto = 1 mes)
Puntos anuales (Plan de 3 Dispositivos)：
0
(1 punto = 12 meses)
Puntos mensuales (Plan de 1 Dispositivo)：
73
(1 punto = 1 mes)
Puntos anuales (Plan de 1 Dispositivo)：
0
(1 punto = 12 meses)`;

/** The same block on one line, in case the layout ever collapses it. */
const HEADER_INLINE = `Créditos:
Puntos mensuales (Plan de 3 Dispositivos)： 99 (1 punto = 1 mes)
Puntos anuales (Plan de 3 Dispositivos)： 0 (1 punto = 12 meses)
Puntos mensuales (Plan de 1 Dispositivo)： 193 (1 punto = 1 mes)
Puntos anuales (Plan de 1 Dispositivo)： 0 (1 punto = 12 meses)`;

describe("parseOwnCredits", () => {
  // The real thing: label, number and note on three separate lines.
  it("reads OUR balance out of the live header, not a customer's", () => {
    expect(parseOwnCredits(HEADER)).toEqual([
      { plan: "Plan de 3 Dispositivos", period: "MONTHLY", points: 0 },
      { plan: "Plan de 3 Dispositivos", period: "ANNUAL", points: 0 },
      { plan: "Plan de 1 Dispositivo", period: "MONTHLY", points: 73 },
      { plan: "Plan de 1 Dispositivo", period: "ANNUAL", points: 0 },
    ]);
  });

  it("still reads it if the layout ever collapses onto one line", () => {
    expect(parseOwnCredits(HEADER_INLINE)).toHaveLength(4);
  });

  it("ignores the panel explaining what a point is worth", () => {
    const monthly = parseOwnCredits(HEADER).find(
      (c) => c.plan === "Plan de 1 Dispositivo" && c.period === "MONTHLY",
    );

    // 73, never 1 or 12 from "(1 punto = 1 mes)".
    expect(monthly?.points).toBe(73);
  });

  // The credits TABLE prints "Plan de 1 Dispositivo： 97" in its cells. Those
  // must never be mistaken for our own balance — the header format always puts
  // the plan in parentheses after "Puntos mensuales/anuales".
  it("does not pick up a customer's row from the same page", () => {
    const withTable = `${HEADER}\nPuntos mensuales disponibles\nPlan de 1 Dispositivo： 97`;

    expect(parseOwnCredits(withTable)).toHaveLength(4);
  });

  it("collapses a bucket the layout repeats", () => {
    const doubled = `${HEADER}\nPuntos mensuales (Plan de 1 Dispositivo)： 193 (1 punto = 1 mes)`;

    expect(parseOwnCredits(doubled)).toHaveLength(4);
  });

  // "No credits" is a business fact; an unreadable header is not. Returning an
  // empty list would write "the supplier has nothing left" into the database.
  it("refuses an unreadable header instead of reporting zero balances", () => {
    expect(() => parseOwnCredits("Bienvenido al panel")).toThrow(PanelParseError);
  });
});

/**
 * The cells exactly as the panel renders them, FULLWIDTH COLON included
 * (U+FF1A). These fixtures are transcribed from a real screenshot of
 * "Gestión de créditos" for account +573112329185.
 */
const MONTHLY_AVAILABLE = "Plan de 3 Dispositivos： 0\nPlan de 1 Dispositivo： 97";
const MONTHLY_ACCUMULATED = "Plan de 3 Dispositivos： 577\nPlan de 1 Dispositivo： 6125";
const ANNUAL_AVAILABLE = "Plan de 3 Dispositivos： 0\nPlan de 1 Dispositivo： 0";
const ANNUAL_ACCUMULATED = "Plan de 3 Dispositivos： 0\nPlan de 1 Dispositivo： 5";

describe("parsePoints", () => {
  it("reads a plain number", () => {
    expect(parsePoints("6125")).toBe(6125);
    expect(parsePoints("  97 ")).toBe(97);
    expect(parsePoints("0")).toBe(0);
  });

  it("survives thousands separators", () => {
    expect(parsePoints("6.125")).toBe(6125);
    expect(parsePoints("6,125")).toBe(6125);
    expect(parsePoints("1.234.567")).toBe(1234567);
  });

  // The separator only counts as thousands when exactly three digits follow.
  // Stripping every dot unconditionally would read "1.5" as 15 — off by ten,
  // silently, in the number the whole protocol anchors on.
  it.each(["1.5", "1.23", "1.2345"])("refuses %o rather than guessing at it", (raw) => {
    expect(() => parsePoints(raw)).toThrow(PanelParseError);
  });

  // `Number("")` is 0 and `parseInt("12abc")` is 12. Either would hand the
  // protocol an anchor that is wrong rather than an error that is loud.
  it.each(["", "   ", "abc", "12abc", "-1"])("refuses %o", (raw) => {
    expect(() => parsePoints(raw)).toThrow(PanelParseError);
  });
});

describe("parsePointsCell", () => {
  it("reads one line per plan", () => {
    const parsed = parsePointsCell(MONTHLY_ACCUMULATED);

    expect(parsed.get("Plan de 3 Dispositivos")).toBe(577);
    expect(parsed.get("Plan de 1 Dispositivo")).toBe(6125);
  });

  // The panel uses U+FF1A; a parser that only splits on ASCII ":" matches
  // nothing and reports an empty account, which reads as "no buckets" instead
  // of "the scrape is broken".
  it("accepts the ASCII colon too", () => {
    expect(parsePointsCell("Plan de 1 Dispositivo: 97").get("Plan de 1 Dispositivo")).toBe(97);
  });

  it("ignores blank lines", () => {
    expect(parsePointsCell("\n  \nPlan de 1 Dispositivo： 97\n\n").size).toBe(1);
  });

  it("reads an empty cell as no plans", () => {
    expect(parsePointsCell("   ").size).toBe(0);
  });

  // A layout change that drops the separator must be loud, not silent.
  it("refuses a line with no separator", () => {
    expect(() => parsePointsCell("Plan de 1 Dispositivo 97")).toThrow(PanelParseError);
  });

  it("refuses a line with no plan name", () => {
    expect(() => parsePointsCell("： 97")).toThrow(PanelParseError);
  });
});

describe("buildBuckets", () => {
  const cells = {
    monthlyAvailable: MONTHLY_AVAILABLE,
    monthlyAccumulated: MONTHLY_ACCUMULATED,
    annualAvailable: ANNUAL_AVAILABLE,
    annualAccumulated: ANNUAL_ACCUMULATED,
  };

  it("pairs available with accumulated per plan and period", () => {
    const buckets = buildBuckets(cells);

    expect(buckets).toEqual([
      { plan: "Plan de 3 Dispositivos", period: "MONTHLY", available: 0, accumulated: 577 },
      { plan: "Plan de 1 Dispositivo", period: "MONTHLY", available: 97, accumulated: 6125 },
      { plan: "Plan de 3 Dispositivos", period: "ANNUAL", available: 0, accumulated: 0 },
      { plan: "Plan de 1 Dispositivo", period: "ANNUAL", available: 0, accumulated: 5 },
    ]);
  });

  // The anchor for the plan this operator actually sells.
  it("carries the accumulated counter the protocol anchors on", () => {
    const monthly = buildBuckets(cells).find(
      (b) => b.plan === "Plan de 1 Dispositivo" && b.period === "MONTHLY",
    );

    expect(monthly?.accumulated).toBe(6125);
  });

  // Inventing a zero here would produce a comparison that looks authoritative
  // and means nothing.
  it("refuses a plan with no accumulated counter rather than assuming zero", () => {
    expect(() =>
      buildBuckets({ ...cells, monthlyAccumulated: "Plan de 3 Dispositivos： 577" }),
    ).toThrow(PanelParseError);
  });

  it("handles an account with no annual points at all", () => {
    const buckets = buildBuckets({
      ...cells,
      annualAvailable: "",
      annualAccumulated: "",
    });

    expect(buckets.every((b) => b.period === "MONTHLY")).toBe(true);
  });
});
