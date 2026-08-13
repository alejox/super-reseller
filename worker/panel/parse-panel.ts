import type {
  CreditBalance,
  CreditPeriod,
} from "@/modules/source-accounts/domain/source-account";
import type { PanelBucket } from "@/modules/source-accounts/domain/supplier-panel";

/**
 * Turning the supplier panel's cells into numbers.
 *
 * PURE ON PURPOSE. This is the half of the scraper that can be tested without
 * a browser, and it is the half that actually breaks: a misread digit here
 * becomes a wrong anchor, and a wrong anchor makes the whole idempotency
 * protocol lie. The Playwright adapter's only job is to hand this function
 * strings.
 *
 * THE SHAPE OF A CELL. Each points column stacks one line per plan:
 *
 *     Plan de 3 Dispositivos： 0
 *     Plan de 1 Dispositivo： 97
 *
 * THE COLON IS NOT ALWAYS A COLON. This panel renders U+FF1A (FULLWIDTH
 * COLON), not U+003A — the giveaway that it is a localised build of a
 * Chinese-origin product. A parser that only splits on ":" matches nothing at
 * all and reports an empty panel, which the protocol would read as "no
 * buckets" rather than as "the scrape is broken". Both are accepted, and so is
 * the fullwidth space that tends to travel with them.
 */

/** `:` U+003A and `：` U+FF1A. */
const COLON = /[:：]/;

/** Whitespace, including the fullwidth space U+3000 these panels like. */
const WHITESPACE = /[\s　]/g;

/** A bare integer: `97`, `6125`. */
const PLAIN = /^\d+$/;

/**
 * An integer with thousands separators: `6.125`, `1,234,567`.
 *
 * The `\d{3}` is doing real work. Stripping every `.` and `,` unconditionally
 * would turn `1.5` into `15` — off by a factor of ten, silently, in the number
 * the whole idempotency protocol anchors on. A separator only counts as
 * thousands when exactly three digits follow it; anything else is not a number
 * this parser is willing to guess about.
 */
const GROUPED = /^\d{1,3}([.,]\d{3})+$/;

export class PanelParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PanelParseError";
  }
}

/**
 * `"Plan de 1 Dispositivo： 6.125"` -> `6125`.
 *
 * Strict: anything that is not a plain non-negative integer after the
 * separators are stripped throws instead of coercing. `Number("")` is 0 and
 * `parseInt("12abc")` is 12 — both would silently produce an anchor that is
 * wrong rather than an error that is loud.
 */
export function parsePoints(raw: string): number {
  const cleaned = raw.replace(WHITESPACE, "");

  if (PLAIN.test(cleaned)) {
    return Number(cleaned);
  }

  if (GROUPED.test(cleaned)) {
    return Number(cleaned.replace(/[.,]/g, ""));
  }

  throw new PanelParseError(`El panel devolvió un número ilegible: "${raw}".`);
}

/**
 * One points cell -> plan name to points.
 *
 * Blank lines are skipped; a line with no colon is an error rather than a
 * skip, because a layout change that drops the separator would otherwise read
 * as "this account has no plans" and quietly return nothing.
 */
export function parsePointsCell(cellText: string): Map<string, number> {
  const byPlan = new Map<string, number>();

  for (const line of cellText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "") continue;

    const match = COLON.exec(trimmed);
    if (!match) {
      throw new PanelParseError(`Línea sin separador en la celda de puntos: "${trimmed}".`);
    }

    const plan = trimmed.slice(0, match.index).trim();
    const points = trimmed.slice(match.index + 1);

    if (plan === "") {
      throw new PanelParseError(`Línea sin nombre de plan: "${trimmed}".`);
    }

    byPlan.set(plan, parsePoints(points));
  }

  return byPlan;
}

/**
 * The panel's own header: how many points WE hold, not a customer.
 *
 * A DIFFERENT PLACE ON THE SAME PAGE, and a different format. The table cells
 * stack "plan： n"; the header stacks whole sentences:
 *
 *     Puntos mensuales (Plan de 3 Dispositivos)： 99 (1 punto = 1 mes)
 *     Puntos anuales (Plan de 1 Dispositivo)： 0 (1 punto = 12 meses)
 *
 * This is what a sync writes into `source_account_credit` — the supplier's
 * answer to "what is left". The trailing "(1 punto = 1 mes)" is the panel
 * explaining itself and carries no number worth reading.
 */
const HEADER_LINE = /Puntos\s+(mensuales|anuales)\s*\(([^)]+)\)\s*[:：]\s*([\d.,\s　]+)/gi;

export function parseOwnCredits(headerText: string): readonly CreditBalance[] {
  const credits: CreditBalance[] = [];
  const seen = new Set<string>();

  for (const match of headerText.matchAll(HEADER_LINE)) {
    const [, periodWord, plan, points] = match;
    const period: CreditPeriod = periodWord.toLowerCase().startsWith("mensual")
      ? "MONTHLY"
      : "ANNUAL";

    const key = `${plan.trim().toLowerCase()}::${period}`;
    // The header can repeat itself across a responsive layout; the same bucket
    // twice is not two buckets, and the unique index downstream agrees.
    if (seen.has(key)) continue;
    seen.add(key);

    credits.push({ plan: plan.trim(), period, points: parsePoints(points) });
  }

  if (credits.length === 0) {
    // Reporting "no credits" would be read downstream as an empty supplier
    // account, which is a business fact. An unreadable header is not.
    throw new PanelParseError(
      "No se encontró ningún saldo en el encabezado del panel. " +
        "O cambió el formato, o la página no es la de Gestión de créditos.",
    );
  }

  return credits;
}

/** The four points columns of one account row, as raw cell text. */
export type PanelRowCells = Readonly<{
  monthlyAvailable: string;
  monthlyAccumulated: string;
  annualAvailable: string;
  annualAccumulated: string;
}>;

/**
 * The row's four cells -> one bucket per (plan, period).
 *
 * A plan that appears in the "disponibles" column but not in "acumulados" is
 * an ERROR, not a zero. The accumulated counter is the anchor the entire
 * protocol rests on; inventing one would produce a comparison that looks
 * authoritative and means nothing.
 */
export function buildBuckets(cells: PanelRowCells): readonly PanelBucket[] {
  const buckets: PanelBucket[] = [];

  const columns: readonly [CreditPeriod, string, string][] = [
    ["MONTHLY", cells.monthlyAvailable, cells.monthlyAccumulated],
    ["ANNUAL", cells.annualAvailable, cells.annualAccumulated],
  ];

  for (const [period, availableText, accumulatedText] of columns) {
    const available = parsePointsCell(availableText);
    const accumulated = parsePointsCell(accumulatedText);

    for (const [plan, availablePoints] of available) {
      const accumulatedPoints = accumulated.get(plan);

      if (accumulatedPoints === undefined) {
        throw new PanelParseError(
          `El plan "${plan}" aparece en disponibles (${period}) pero no en acumulados. ` +
            "Sin el acumulado no hay ancla, y sin ancla no se puede verificar la recarga.",
        );
      }

      buckets.push({ plan, period, available: availablePoints, accumulated: accumulatedPoints });
    }
  }

  return buckets;
}
