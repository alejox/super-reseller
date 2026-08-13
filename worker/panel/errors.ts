/**
 * Turning a browser exception into something an operator can read.
 *
 * WHY THIS EXISTS. `String(playwrightError)` produces a multi-line dump with a
 * "Call log" and ANSI colour codes baked in. Stored in `last_sync_error` and
 * rendered in the alert banner, it came out as:
 *
 *     Error de acceso tras 4 intentos fallidos: TimeoutError: locator.waitFor:
 *     Timeout 20000ms exceeded. Call log: [2m - waiting for
 *     getByText(/Puntos\s+(mensuales|anuales)\s*\(/).first() to be visible [22m
 *
 * — escape codes and all, on a screen meant for somebody deciding whether to
 * go log in again. The detail belongs in the terminal; the banner gets the
 * sentence.
 */

/**
 * CSI sequences: the `[2m` / `[22m` that terminals render as dim text.
 *
 * The ESC is OPTIONAL because by the time these reach a database column the
 * escape byte has often been dropped, leaving the bracket form behind — which
 * is exactly what showed up in the alert banner.
 *
 * At least ONE digit is required, and that is not cosmetic: `[0-9;]*` also
 * matches `[w` in ordinary prose like "[warning]" and would silently eat it.
 */
const ANSI = /\u001b?\[[0-9;]+[A-Za-z]/g;

const MAX_LENGTH = 180;

export function summarizeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);

  const firstLine =
    raw
      .replace(ANSI, "")
      // Playwright appends its diagnostics after this marker; everything past
      // it is for whoever is reading the terminal, not the panel.
      .split(/Call log:/i)[0]
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)[0] ?? "Error desconocido";

  return firstLine.length > MAX_LENGTH ? `${firstLine.slice(0, MAX_LENGTH - 1)}…` : firstLine;
}
