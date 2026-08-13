import type { Page } from "playwright";

import type {
  PanelQueryOutcome,
  ReadOwnCreditsOutcome,
  SubmitRechargeCommand,
  SubmitRechargeOutcome,
  SupplierPanel,
} from "@/modules/source-accounts/domain/supplier-panel";

import { summarizeError } from "./errors";
import { buildBuckets, PanelParseError, parseOwnCredits } from "./parse-panel";
import { DEFAULT_SELECTORS, type PanelSelectors } from "./selectors";

/**
 * `SupplierPanel`, driven through a real browser.
 *
 * THIS CLASS IS DELIBERATELY DUMB. It knows how to read a row and how to press
 * the buttons, and nothing else. The protocol that makes a recharge safe —
 * capture the anchor, write it down, click, verify — lives in
 * `perform-recharge.ts`, where it is tested against a fake in milliseconds. If
 * a change to this file starts to look like a decision about whether a
 * recharge succeeded, it belongs on the other side of the port.
 *
 * IT NEVER LOGS IN. The page handed to the constructor already carries a
 * session a human opened by hand (`npm run panel:login`). When that session
 * dies this class reports `session-dead` and stops — it does not try the login
 * form, and it does not touch the verification code guarding it.
 *
 * ON FAILURE IT SAYS "UNKNOWN", NOT "FAILED". Every throw between the click
 * and the response becomes `reason: "unknown"`, because after "Aceptar" has
 * been pressed nothing here can tell a dropped connection from a rejected
 * form. The caller re-reads the counter either way; claiming "failed" would
 * invite a retry this class has no right to authorise.
 */
export class PlaywrightSupplierPanel implements SupplierPanel {
  constructor(
    private readonly page: Page,
    private readonly panelUrl: string,
    private readonly selectors: PanelSelectors = DEFAULT_SELECTORS,
  ) {}

  /** True when the page is showing the login form instead of the panel. */
  private async sessionIsDead(): Promise<boolean> {
    return this.page.locator(this.selectors.loginMarker).first().isVisible({ timeout: 2_000 });
  }

  /**
   * Cloudflare's "Error 1015 — you are being rate limited" interstitial.
   *
   * WORTH ITS OWN CHECK, because without it this page is just a page with no
   * balances on it, and the parser reports "el formato cambió" — sending an
   * operator to hunt for a markup change that never happened. It cost exactly
   * one confused debugging session to learn that.
   *
   * The answer to seeing this is to STOP, not to retry harder. Whatever pace
   * produced it was too fast for the supplier, and the supplier decides the
   * pace.
   */
  private async isRateLimited(): Promise<boolean> {
    const text = await this.page.innerText("body").catch(() => "");

    return /Error\s*1015|rate limited|banned you temporarily/i.test(text);
  }

  /** Navigates to Gestión de revendedores → Gestión de créditos. */
  private async openCreditsPage(): Promise<void> {
    await this.page.goto(this.panelUrl, { waitUntil: "domcontentloaded" });
    await this.page.locator(this.selectors.creditsMenu).first().click();
    await this.page.locator(this.selectors.creditsSubmenu).first().click();
  }

  private async runQuery(targetAccount: string): Promise<void> {
    const input = this.page.locator(this.selectors.accountInput).first();
    await input.fill("");
    await input.fill(targetAccount);
    await this.page.locator(this.selectors.queryButton).first().click();
    await this.page.locator(this.selectors.resultsBody).first().waitFor({ timeout: 15_000 });
  }

  /**
   * A SYNC: open the panel and read our own balances off the header.
   *
   * This is the only thing that ever moves an account out of
   * `NEVER_CONNECTED`. The screen at `/admin/source-accounts` shows what this
   * method last wrote and never opens a browser itself.
   *
   * A dead session comes back as `REQUIRES_2FA` rather than `LOGIN_ERROR`, and
   * the distinction is the honest one: getting back in needs the verification
   * code the panel prints at login, which means it needs a person. Calling it
   * a login error would suggest something retrying could fix.
   */
  async readOwnCredits(): Promise<ReadOwnCreditsOutcome> {
    try {
      // NO NAVIGATION. The balances render in the panel's global header — a
      // capture found all four on `#/info/accountSecurity`, which is not the
      // credits page at all. Clicking through a menu to reach numbers that are
      // already on screen would add two failure modes for nothing.
      await this.page.goto(this.panelUrl, { waitUntil: "networkidle" });

      // Checked FIRST: a rate-limit page carries neither the login form nor
      // the balances, so every other check would misread it.
      if (await this.isRateLimited()) {
        return {
          ok: false,
          reason: "BLOCKED",
          detail:
            "El proveedor nos está limitando (Cloudflare 1015). Es temporal. " +
            "Esperá antes de volver a sincronizar y bajá la frecuencia: " +
            "reintentar ahora alarga el bloqueo.",
        };
      }

      if (await this.sessionIsDead()) {
        return {
          ok: false,
          reason: "REQUIRES_2FA",
          detail: "la sesión caducó: hay que volver a entrar a mano (npm run panel:login)",
        };
      }

      // `networkidle` says the requests stopped, NOT that the app rendered.
      // This is a client-side SPA: the header paints a beat later, and reading
      // the body before it does returns a page with no balances on it — which
      // the parser correctly, and uselessly, reports as "formato cambiado".
      // Wait for the thing we came for.
      await this.page
        .getByText(/Puntos\s+(mensuales|anuales)\s*\(/)
        .first()
        .waitFor({ timeout: 20_000 });

      const header = await this.page.locator(this.selectors.creditsHeader).first().innerText();

      return { ok: true, credits: parseOwnCredits(header) };
    } catch (error) {
      const detail =
        error instanceof PanelParseError ? error.message : summarizeError(error);

      // Not BLOCKED: nothing suggests the supplier locked us out. An unreadable
      // page is a broken scrape, and LOGIN_ERROR is the closest honest label
      // the alerting understands.
      return { ok: false, reason: "LOGIN_ERROR", detail };
    }
  }

  async query(targetAccount: string): Promise<PanelQueryOutcome> {
    try {
      await this.openCreditsPage();

      if (await this.sessionIsDead()) {
        return { ok: false, reason: "session-dead", detail: "el panel pide iniciar sesión" };
      }

      await this.runQuery(targetAccount);

      const row = this.page.locator(this.selectors.rowForAccount(targetAccount)).first();
      if ((await row.count()) === 0) {
        return { ok: false, reason: "account-not-found" };
      }

      const cell = async (selector: string): Promise<string> =>
        (await row.locator(selector).first().innerText()).trim();

      const buckets = buildBuckets({
        monthlyAvailable: await cell(this.selectors.cellMonthlyAvailable),
        monthlyAccumulated: await cell(this.selectors.cellMonthlyAccumulated),
        annualAvailable: await cell(this.selectors.cellAnnualAvailable),
        annualAccumulated: await cell(this.selectors.cellAnnualAccumulated),
      });

      return {
        ok: true,
        snapshot: {
          // The account as the PANEL echoes it, not as it was asked for — a
          // row matched by text could belong to a longer number.
          account: (await row.locator("td").first().innerText()).trim(),
          status: await cell(this.selectors.cellStatus),
          buckets,
        },
      };
    } catch (error) {
      // A misread number is a broken scrape, not a missing account. Reporting
      // it as `panel-error` keeps it out of the "account does not exist" path,
      // where it would look like ordinary business.
      const detail =
        error instanceof PanelParseError
          ? `No se pudo leer la tabla: ${error.message}`
          : summarizeError(error);

      return { ok: false, reason: "panel-error", detail };
    }
  }

  async submitRecharge(command: SubmitRechargeCommand): Promise<SubmitRechargeOutcome> {
    // Annual points are never bought by this operation, and the modal's annual
    // field is meant to stay empty. Refusing here beats discovering it halfway
    // through a form.
    if (command.period !== "MONTHLY") {
      return {
        ok: false,
        reason: "rejected",
        detail: "Solo se recargan puntos mensuales desde este panel.",
      };
    }

    let clicked = false;

    try {
      await this.openCreditsPage();

      if (await this.sessionIsDead()) {
        return { ok: false, reason: "session-dead", detail: "el panel pide iniciar sesión" };
      }

      await this.runQuery(command.targetAccount);

      const row = this.page.locator(this.selectors.rowForAccount(command.targetAccount)).first();
      if ((await row.count()) === 0) {
        return { ok: false, reason: "rejected", detail: "la cuenta no apareció al consultar" };
      }

      // The `+`, scoped to THIS row. Never a page-wide locator: the `−` beside
      // it subtracts, and a page-wide match could land on either, in any row.
      await row.locator(this.selectors.rechargeButton).first().click();

      const modal = this.page.locator(this.selectors.modal).first();
      await modal.waitFor({ timeout: 15_000 });

      // THE GUARD THAT MATTERS. The modal restates the account; if it is not
      // the one that was asked for, the wrong row was clicked and the whole
      // attempt stops here — before anything is confirmed.
      const echo = await modal.locator(this.selectors.modalAccountEcho).first().inputValue();
      if (!echo.includes(command.targetAccount)) {
        return {
          ok: false,
          reason: "rejected",
          detail: `El modal muestra "${echo}" y se pidió "${command.targetAccount}". No se confirmó nada.`,
        };
      }

      await modal
        .locator(this.selectors.modalPlanSelect)
        .first()
        .selectOption({ label: command.plan });

      await modal.locator(this.selectors.modalMonthlyPoints).first().fill(String(command.points));

      // "Puntos anuales" and "Observaciones" stay empty, on purpose.

      await modal.locator(this.selectors.modalConfirm).first().click();

      const dialog = this.page.locator(this.selectors.confirmDialog).first();
      await dialog.waitFor({ timeout: 15_000 });

      // FROM HERE ON THE OUTCOME IS UNKNOWABLE FROM THIS SIDE.
      clicked = true;
      await dialog.locator(this.selectors.confirmAccept).first().click();

      return { ok: true };
    } catch (error) {
      // Before the accept: nothing moved, so "rejected" is honest and the
      // caller may safely see FAILED. After it: only the counter knows.
      return {
        ok: false,
        reason: clicked ? "unknown" : "rejected",
        detail: summarizeError(error),
      };
    }
  }
}
