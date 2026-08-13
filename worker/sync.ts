import { chromium } from "playwright";

import { recordSyncAttempt } from "@/modules/source-accounts/application/admin/manage-source-accounts";
import { DrizzleSourceAccountRepository } from "@/modules/source-accounts/infrastructure/drizzle-source-account-repository";
import { getDb } from "@/shared/db/client";

import { PlaywrightSupplierPanel } from "./panel/playwright-supplier-panel";
import { readSession, sessionPath } from "./session/storage";

/**
 * THE WIRE. This is what makes a registered account stop saying "Sin conectar".
 *
 *     npm run panel:sync
 *
 * The web app never opens a browser and never talks to the supplier. It only
 * READS what this process wrote. So the whole loop is:
 *
 *     este proceso  ──abre chromium──▶  panel del proveedor
 *           │                                  │
 *           │◀───────── saldos ────────────────┘
 *           │
 *           └──escribe──▶  source_account + source_account_credit
 *                                    │
 *                                    └──lee──▶  /admin/source-accounts
 *
 * Run it by hand while the selectors are still being settled; put it on a
 * schedule (cron, launchd) once a sync has worked more than once.
 *
 * IT RUNS AS ADMIN WITHOUT A SESSION, which is worth being explicit about:
 * there is no logged-in user here, so `requireRole("ADMIN")` — the guard the
 * screen relies on — cannot apply. This process's authority IS its access to
 * `DATABASE_URL`. Do not give it a wider connection than it needs, and do not
 * expose it over HTTP without putting a real guard in front.
 *
 * It never writes a recharge. Syncing only reads.
 */

const HEADLESS = process.env.PANEL_HEADLESS !== "false";

async function main(): Promise<void> {
  const db = getDb();
  const sourceAccounts = new DrizzleSourceAccountRepository(db);
  const accounts = await sourceAccounts.list();

  if (accounts.length === 0) {
    console.log("No hay cuentas fuente registradas. Registrá una en /admin/source-accounts.");
    process.exit(0);
  }

  console.log(`${accounts.length} cuenta(s) para sincronizar.\n`);
  let failures = 0;

  for (const account of accounts) {
    const label = `${account.panelUsername} @ ${account.panelUrl}`;
    const storageState = await readSession(account.panelUrl);

    if (!storageState) {
      // No session at all is the same problem as an expired one, and gets the
      // same answer: a human has to log in. Recording it means the screen says
      // so instead of the account sitting silently at NEVER_CONNECTED.
      console.log(`✗ ${label}: sin sesión guardada`);
      await recordSyncAttempt(
        { sourceAccounts, actorId: account.createdBy },
        {
          accountId: account.id,
          outcome: {
            ok: false,
            reason: "REQUIRES_2FA",
            detail: `No hay sesión en ${sessionPath(account.panelUrl)}. Corré: npm run panel:login -- ${account.panelUrl}`,
          },
        },
      );
      failures += 1;
      continue;
    }

    const browser = await chromium.launch({ headless: HEADLESS });

    try {
      const context = await browser.newContext({
        locale: "es-CO",
        storageState: JSON.parse(storageState),
      });
      const panel = new PlaywrightSupplierPanel(await context.newPage(), account.panelUrl);

      const outcome = await panel.readOwnCredits();

      // The one write. `recordSyncAttempt` moves the status, the clock, the
      // failure streak and the balances together — see the port.
      const result = await recordSyncAttempt(
        { sourceAccounts, actorId: account.createdBy },
        { accountId: account.id, outcome },
      );

      if (!result.ok) {
        console.log(`✗ ${label}: la cuenta desapareció mientras se sincronizaba`);
        failures += 1;
        continue;
      }

      if (outcome.ok) {
        const summary = outcome.credits
          .filter((credit) => credit.period === "MONTHLY")
          .map((credit) => `${credit.plan}: ${credit.points}`)
          .join(" · ");
        console.log(`✓ ${label}${summary ? ` — ${summary}` : ""}`);
      } else {
        console.log(`✗ ${label}: ${outcome.reason}${outcome.detail ? ` — ${outcome.detail}` : ""}`);
        failures += 1;
      }

      if (result.alert) {
        console.log(`  ⚠ esta cuenta ya aparece alertada en /admin/source-accounts`);
      }
      if (outcome.ok === false && outcome.reason === "BLOCKED") {
        // The supplier told us to slow down. Carrying on down the list is how
        // a temporary limit becomes a long one.
        console.log("\n⛔ El proveedor nos está limitando. Se detiene el sync acá.");
        failures += accounts.length - accounts.indexOf(account) - 1;
        break;
      }
    } finally {
      await browser.close();
    }

    // A courtesy gap between accounts. The panel sits behind Cloudflare and
    // answers a burst with "Error 1015"; nothing here is urgent enough to be
    // worth provoking that.
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }

  console.log(`\nListo. ${accounts.length - failures} ok, ${failures} con problemas.`);
  // Non-zero on failure so a scheduler can notice without reading the log.
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((error: unknown) => {
  console.error("El sync falló por completo:", error);
  process.exit(1);
});
