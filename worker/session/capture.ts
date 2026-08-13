import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Page } from "playwright";

import { DEFAULT_SELECTORS } from "../panel/selectors";
import { readSession, sessionPath } from "./storage";

/**
 * Dumps the real "Gestión de créditos" page so its selectors can be written
 * against what is actually there.
 *
 *     npm run panel:capture -- https://syainj.pro-reventa.net/
 *
 * WHY THIS EXISTS. Selectors written from a screenshot are guesses. A guessed
 * selector on this page is not a small problem either: the "Operar" column
 * carries a `−` button pixels away from the `+`, and the `−` SUBTRACTS. A
 * selector that drifts by one element stops adding credits and starts removing
 * them, against a real customer, silently.
 *
 * FULLY AUTOMATIC, and deliberately so — an earlier version waited for Enter
 * on stdin, which does nothing once the command is backgrounded. It navigates
 * on its own, reports which selectors matched and which did not, and dumps the
 * page either way. A failed navigation is the most useful dump of all.
 *
 * It only ever READS. It clicks menu items to reach the page and nothing else
 * — never the `+`, never the `−`, never a form.
 */

const OUTPUT_DIR = path.join(process.cwd(), ".captures");

/** Reports whether a selector matched, without ever failing the run. */
async function probe(page: Page, label: string, selector: string): Promise<number> {
  const count = await page
    .locator(selector)
    .count()
    .catch(() => 0);

  console.log(`  ${count > 0 ? "✓" : "✗"} ${label}: ${count} coincidencia(s)  [${selector}]`);
  return count;
}

async function main(): Promise<void> {
  const panelUrl = process.argv[2];

  if (!panelUrl) {
    console.error("Uso: npm run panel:capture -- <url-del-panel>");
    process.exit(1);
  }

  const storageState = await readSession(panelUrl);
  if (!storageState) {
    console.error(`No hay sesión guardada para ${panelUrl}.`);
    console.error(`Esperaba encontrarla en ${sessionPath(panelUrl)}`);
    console.error(`Corré primero: npm run panel:login -- ${panelUrl}`);
    process.exit(1);
  }

  await mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "es-CO",
    storageState: JSON.parse(storageState),
  });
  const page = await context.newPage();

  await page.goto(panelUrl, { waitUntil: "networkidle" }).catch(() => undefined);
  console.log(`\nURL tras entrar: ${page.url()}`);
  console.log(`Título: ${await page.title()}\n`);

  console.log("Selectores actuales, contra la página de inicio:");
  await probe(page, "marcador de sesión", DEFAULT_SELECTORS.sessionMarker);
  await probe(page, "marcador de login", DEFAULT_SELECTORS.loginMarker);
  await probe(page, "menú créditos", DEFAULT_SELECTORS.creditsMenu);

  // Navigate the way the adapter does, reporting each step rather than
  // throwing on the first miss.
  for (const [label, selector] of [
    ["menú Gestión de revendedores", DEFAULT_SELECTORS.creditsMenu],
    ["submenú Gestión de créditos", DEFAULT_SELECTORS.creditsSubmenu],
  ] as const) {
    const target = page.locator(selector).first();
    if ((await target.count().catch(() => 0)) === 0) {
      console.log(`\n✗ No se pudo clickear ${label}: no existe con ese selector.`);
      break;
    }
    await target.click({ timeout: 10_000 }).catch((error: unknown) => {
      console.log(`\n✗ Falló el click en ${label}: ${String(error).split("\n")[0]}`);
    });
    await page.waitForTimeout(2_000);
    console.log(`\nDespués de ${label} → ${page.url()}`);
  }

  console.log("\nSelectores de la página de créditos:");
  await probe(page, "encabezado de saldos", DEFAULT_SELECTORS.creditsHeader);
  await probe(page, "input de cuenta", DEFAULT_SELECTORS.accountInput);
  await probe(page, "botón Consultar", DEFAULT_SELECTORS.queryButton);
  await probe(page, "cuerpo de la tabla", DEFAULT_SELECTORS.resultsBody);

  // The literal text the parser needs to find, wherever it lives.
  const bodyText = await page.innerText("body").catch(() => "");
  const hasCredits = /Cr[eé]ditos/i.test(bodyText);
  const hasPuntos = /Puntos\s+(mensuales|anuales)/i.test(bodyText);
  console.log(`\n¿El texto "Créditos" aparece en la página?  ${hasCredits ? "sí" : "NO"}`);
  console.log(`¿El texto "Puntos mensuales/anuales"?          ${hasPuntos ? "sí" : "NO"}`);

  if (hasPuntos) {
    const sample = bodyText
      .split(/\r?\n/)
      .filter((line) => /Puntos\s+(mensuales|anuales)/i.test(line))
      .slice(0, 6);
    console.log("\nLíneas de saldo encontradas:");
    for (const line of sample) console.log(`  ${JSON.stringify(line)}`);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const htmlPath = path.join(OUTPUT_DIR, `creditos-${stamp}.html`);
  const textPath = path.join(OUTPUT_DIR, `creditos-${stamp}.txt`);
  const shotPath = path.join(OUTPUT_DIR, `creditos-${stamp}.png`);

  await writeFile(htmlPath, await page.content(), "utf8");
  await writeFile(textPath, bodyText, "utf8");
  await page.screenshot({ path: shotPath, fullPage: true }).catch(() => undefined);

  await browser.close();

  console.log(`\nHTML:    ${htmlPath}`);
  console.log(`Texto:   ${textPath}`);
  console.log(`Captura: ${shotPath}`);
  console.log("\nEstos archivos pueden contener tokens de sesión y datos de clientes.");
  console.log("Están en .gitignore. Revisalos antes de compartirlos fuera de esta máquina.\n");

  process.exit(0);
}

main().catch((error: unknown) => {
  console.error("No se pudo capturar la página:", error);
  process.exit(1);
});
