import type { CreditBalance, CreditPeriod, SyncFailureReason } from "./source-account";

/**
 * THE PORT THE BROWSER IMPLEMENTS.
 *
 * Everything the automation is allowed to do to the supplier's panel is these
 * two methods, and that narrowness is the point. The protocol that makes a
 * recharge safe — capture the anchor, write it down, click, verify — lives in
 * the application layer where it can be tested in milliseconds against a fake.
 * A Playwright adapter behind this interface only has to translate clicks.
 *
 * If you find yourself wanting to add "rechargeAndVerify" here, stop: that is
 * the protocol leaking into the browser, where it stops being testable.
 */

/** One (plan, period) row as the panel prints it for a customer account. */
export type PanelBucket = Readonly<{
  /** The supplier's plan name, verbatim: "Plan de 1 Dispositivo". */
  plan: string;
  period: CreditPeriod;
  /** "Puntos disponibles" — rises and falls as they are consumed. */
  available: number;
  /**
   * "Puntos acumulados" — MONOTONIC. Only ever grows, which is the single
   * property the whole idempotency protocol rests on.
   */
  accumulated: number;
}>;

/** What "Consultar" returns for one account. */
export type PanelAccountSnapshot = Readonly<{
  /** The account as the panel echoes it back — verify it against what was asked. */
  account: string;
  /** The panel's own status column ("Normal"). */
  status: string;
  buckets: readonly PanelBucket[];
}>;

export type PanelQueryOutcome =
  | Readonly<{ ok: true; snapshot: PanelAccountSnapshot }>
  | Readonly<{ ok: false; reason: "account-not-found" }>
  /** The session died. Nothing was read; a human has to log in again. */
  | Readonly<{ ok: false; reason: "session-dead"; detail?: string }>
  | Readonly<{ ok: false; reason: "panel-error"; detail?: string }>;

export type SubmitRechargeCommand = Readonly<{
  targetAccount: string;
  plan: string;
  period: CreditPeriod;
  points: number;
}>;

/**
 * The outcome of the click, AND IT IS ONLY A HINT.
 *
 * Not one of these values is treated as proof by the caller. `ok: true` can
 * still be a recharge the panel silently dropped; `unknown` is the honest
 * answer to a connection that died between "Aceptar" and the response. The
 * counter is the only authority, so the use case re-reads it either way.
 */
export type SubmitRechargeOutcome =
  | Readonly<{ ok: true }>
  /** The panel said no, out loud — out of credits, bad account, closed modal. */
  | Readonly<{ ok: false; reason: "rejected"; detail?: string }>
  | Readonly<{ ok: false; reason: "session-dead"; detail?: string }>
  /** Something broke mid-flight. It may or may not have landed. */
  | Readonly<{ ok: false; reason: "unknown"; detail?: string }>;

/**
 * The result of a sync: OUR balances, or why they could not be read.
 *
 * Its failure reasons are `SyncFailureReason` verbatim, so a sync's outcome
 * drops straight into `recordSyncAttempt` with no translation layer inventing
 * meanings along the way.
 */
export type ReadOwnCreditsOutcome =
  | Readonly<{ ok: true; credits: readonly CreditBalance[] }>
  | Readonly<{ ok: false; reason: SyncFailureReason; detail?: string }>;

export interface SupplierPanel {
  /**
   * OUR OWN balances, from the page header — not a customer's.
   *
   * Two different places on the same page, and it is worth keeping them
   * straight: the header says how many points WE have left to sell, the table
   * row says how many a CUSTOMER has received. A sync writes the first; the
   * recharge protocol anchors on the second.
   */
  readOwnCredits(): Promise<ReadOwnCreditsOutcome>;

  /**
   * "Consultar": type the account, press the button, read the row back.
   *
   * Used twice per recharge — once for the anchor, once for the verdict.
   */
  query(targetAccount: string): Promise<PanelQueryOutcome>;

  /**
   * The mutating step: the `+` button, the "Recargar créditos" modal, then
   * "Confirmar" and "Aceptar".
   *
   * WARNING FOR THE IMPLEMENTOR. The `Operar` column carries a `−` button
   * pixels away from the `+`, and it subtracts. Anchor every selector to the
   * row by account number and to the button by identity, never by position,
   * and check the account the modal echoes back before confirming.
   */
  submitRecharge(command: SubmitRechargeCommand): Promise<SubmitRechargeOutcome>;
}
