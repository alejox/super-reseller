import { chromium, type BrowserContext, type Page } from "playwright";

import { ensureSessionDir, sessionPath } from "./storage";

/**
 * Opens a real browser so a HUMAN can log into the supplier panel, then saves
 * the session for the automation to reuse.
 *
 *     npm run panel:login -- https://syainj.pro-reventa.net/
 *
 * WHY A HUMAN DOES THIS. The panel's login asks for a verification code it
 * prints on the page. That control exists to stop automated logins, and this
 * project does not try to defeat it — it does not have to. The code appears at
 * LOGIN ONLY and never during a recharge, so one manual login buys a session
 * that serves every recharge until it expires.
 *
 * The side benefit is the one that matters most: NOTHING HERE EVER LEARNS THE
 * PASSWORD. The operator types it into a real browser window; no credential
 * reaches this codebase, this database, or these logs. There is nothing to
 * encrypt, rotate, or leak.
 *
 * IT WAITS BY WATCHING, NOT BY ASKING. An earlier version blocked on Enter
 * from stdin, which broke the moment the command was backgrounded — stdin
 * detaches, the keypress goes nowhere, and the browser sits open forever while
 * the session is never written. Now it polls the page and saves the instant it
 * sees you are inside, so it works the same whether it runs in a terminal, in
 * a CI job, or in an agent's shell.
 */

/** How long the operator gets to find the code and type it. */
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;
const POLL_MS = 2_000;

/**
 * Are we past the login form?
 *
 * Deliberately NOT a single selector. The panel's markup is not pinned down
 * yet, so this asks three cheap questions and takes any of them as a yes:
 * the url moved off the login page, the password field is gone, or the panel's
 * own navigation appeared. Any one being true means the form is behind us.
 */
async function isLoggedIn(page: Page, loginUrl: string): Promise<boolean> {
  if (page.isClosed()) return false;

  const passwordVisible = await page
    .locator('input[type="password"]')
    .first()
    .isVisible()
    .catch(() => false);

  if (passwordVisible) return false;

  const navVisible = await page
    .locator("text=Gestión de revendedores")
    .first()
    .isVisible()
    .catch(() => false);

  if (navVisible) return true;

  // No password field and the url moved: the form is gone even if the nav
  // wording is different from what was guessed above.
  const url = page.url();
  return url !== loginUrl && url !== `${loginUrl}/` && !url.includes("login");
}

async function waitForLogin(context: BrowserContext, page: Page, loginUrl: string): Promise<boolean> {
  const deadline = Date.now() + LOGIN_TIMEOUT_MS;
  let announced = false;

  while (Date.now() < deadline) {
    // Closing the window is a deliberate "I am done" — but only worth
    // honouring if a session actually exists behind it.
    if (page.isClosed() || context.pages().length === 0) {
      return (await context.cookies()).length > 0;
    }

    if (await isLoggedIn(page, loginUrl)) {
      if (!announced) {
        console.log("Entrada detectada. Confirmando que la sesión quedó estable…");
        announced = true;
      }
      // A second look a beat later: the redirect right after submitting can
      // pass this check for an instant before the panel has actually set its
      // cookies.
      await page.waitForTimeout(3_000);
      if (await isLoggedIn(page, loginUrl)) return true;
      announced = false;
    }

    await page.waitForTimeout(POLL_MS);
  }

  return false;
}

async function main(): Promise<void> {
  const panelUrl = process.argv[2];

  if (!panelUrl) {
    console.error("Uso: npm run panel:login -- <url-del-panel>");
    console.error("Ejemplo: npm run panel:login -- https://syainj.pro-reventa.net/");
    process.exit(1);
  }

  await ensureSessionDir();
  const target = sessionPath(panelUrl);

  // Headed, and not negotiable: the point is that a person can see the page
  // and type the code.
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ locale: "es-CO" });
  const page = await context.newPage();

  console.log(`\nAbriendo ${panelUrl}`);
  console.log("Iniciá sesión a mano, incluido el código de verificación.");
  console.log("No hace falta apretar nada acá: en cuanto estés dentro, se guarda solo.");
  console.log(`Tenés ${LOGIN_TIMEOUT_MS / 60000} minutos.\n`);

  await page.goto(panelUrl, { waitUntil: "domcontentloaded" });

  const loggedIn = await waitForLogin(context, page, panelUrl);

  if (!loggedIn) {
    await browser.close();
    console.error("\nNo se detectó una sesión iniciada. No se guardó nada.");
    console.error("Volvé a correr el comando y completá el login dentro del tiempo.\n");
    process.exit(1);
  }

  await context.storageState({ path: target });
  await browser.close();

  console.log(`\nSesión guardada en ${target}`);
  console.log("Esto NO contiene tu contraseña: son cookies, y caducan.");
  console.log("Cuando caduquen, el panel va a avisar y basta con repetir este comando.");
  console.log("\nSiguiente: npm run panel:sync\n");

  process.exit(0);
}

main().catch((error: unknown) => {
  console.error("No se pudo guardar la sesión:", error);
  process.exit(1);
});
