/**
 * EVERY SELECTOR FOR THE SUPPLIER PANEL, IN ONE PLACE.
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  THESE ARE UNVERIFIED. They were written from a screenshot, not from  │
 * │  the page. Run `npm run panel:capture` and correct them against the   │
 * │  real DOM before pointing this at anything that matters.              │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * They live together, apart from the logic, for two reasons. The panel will
 * change its markup without telling anybody, and when it does the fix should
 * be one file with no behaviour in it. And a reviewer should be able to read
 * every way this code can touch the page in under a minute.
 *
 * THE DANGEROUS ONE IS `rechargeButton`. The "Operar" column carries three
 * controls side by side, and one of them SUBTRACTS credits. A selector that
 * drifts by a single element turns every recharge into a debit against a real
 * customer, silently, and the counter check will faithfully report FAILED
 * while the customer's balance goes down. Anchor it by identity — the icon
 * class, an aria-label, a title — never by index, and never by "the second
 * button in the cell".
 */

export type PanelSelectors = Readonly<{
  /** Present only when logged in; its absence is how session death is detected. */
  sessionMarker: string;
  /** Present on the login page; its presence means the session is gone. */
  loginMarker: string;

  creditsMenu: string;
  creditsSubmenu: string;

  /**
   * The block at the top printing OUR balances ("Créditos: Puntos mensuales
   * (Plan de 3 Dispositivos)： 99"). NOT the table — that is a customer's.
   */
  creditsHeader: string;

  accountInput: string;
  queryButton: string;

  /** The results table body. */
  resultsBody: string;
  /** A row, given the account text. Built as a function: the account is data. */
  rowForAccount: (account: string) => string;

  /** Cells, relative to a row. Index-free: matched by header position at runtime. */
  cellStatus: string;
  cellMonthlyAvailable: string;
  cellMonthlyAccumulated: string;
  cellAnnualAvailable: string;
  cellAnnualAccumulated: string;

  /** THE `+`. Never the `−`. See the header. */
  rechargeButton: string;

  modal: string;
  /** The account the modal echoes back — verified before anything is confirmed. */
  modalAccountEcho: string;
  modalPlanSelect: string;
  modalMonthlyPoints: string;
  modalConfirm: string;

  /** The second, smaller "¿desea recargar esta cuenta?" dialog. */
  confirmDialog: string;
  confirmAccept: string;
}>;

/**
 * Best-effort starting point, written from the screenshot of
 * `syainj.pro-reventa.net`. Treat every line as a hypothesis.
 */
export const DEFAULT_SELECTORS: PanelSelectors = {
  sessionMarker: "text=Gestión de revendedores",
  loginMarker: "text=Entrada",

  creditsMenu:
    'li.xxl-menu-submenu:has(span:text-is("Gestión de revendedores")) .xxl-menu-submenu-title',
  creditsSubmenu: 'li.xxl-menu-item:has(span:text-is("Gestión de créditos"))',

  /**
   * VERIFIED against a real capture, and deliberately the whole body.
   *
   * The first attempt was `:has-text("Créditos:") >> nth=-1`, which matched the
   * SMALLEST element containing that text — the label `<span>` on its own,
   * carrying no numbers at all. The parser then reported "no balances" on a
   * page that was showing four.
   *
   * The balances also turn out to live in the GLOBAL header: they render on
   * `#/info/accountSecurity` just as they do on Gestión de créditos. So there
   * is no header element worth pinning, and `parseOwnCredits` is strict enough
   * to pick out exactly the four `Puntos … (Plan …)：` lines from the page
   * text and ignore everything else. A blunt selector plus a strict parser
   * beats a clever selector against markup nobody controls.
   */
  creditsHeader: "body",

  accountInput: 'input[placeholder*="Cuenta" i], label:has-text("Cuenta") input',
  queryButton: 'button:has-text("Consultar")',

  resultsBody: "table tbody",
  // Quoted so an account containing a quote cannot break out of the selector.
  rowForAccount: (account: string) => `table tbody tr:has-text(${JSON.stringify(account)})`,

  cellStatus: "td:nth-child(2)",
  cellMonthlyAvailable: "td:nth-child(3)",
  cellMonthlyAccumulated: "td:nth-child(4)",
  cellAnnualAvailable: "td:nth-child(5)",
  cellAnnualAccumulated: "td:nth-child(6)",

  // UNVERIFIED AND DANGEROUS. Replace with something anchored to the button's
  // own identity as soon as the real DOM is in hand.
  rechargeButton: '[aria-label*="recargar" i], .anticon-plus-circle',

  modal: '.ant-modal:has-text("Recargar créditos"), [role="dialog"]:has-text("Recargar créditos")',
  modalAccountEcho: '[data-account], .ant-modal input[readonly]',
  modalPlanSelect: '.ant-modal select, .ant-modal [role="combobox"]',
  modalMonthlyPoints:
    '.ant-modal label:has-text("Puntos mensuales") input, .ant-modal input[type="number"]',
  modalConfirm: '.ant-modal button:has-text("Confirmar")',

  confirmDialog: '.ant-modal-confirm, [role="alertdialog"]',
  confirmAccept: 'button:has-text("Aceptar")',
};
