import type { SourceAccountId, UserId } from "./ids";

/**
 * A login on a SUPPLIER's reseller panel — the account the platform buys from,
 * and the source every recharge is drawn against.
 *
 * DO NOT CONFUSE THIS WITH `provider_account`, and the confusion is easy
 * enough that it is worth spelling out — the two are opposite ends of the same
 * transaction:
 *
 *   - `provider_account` (module `provider-accounts`) is CUSTOMER-owned. It is
 *     the identifier a customer uses on the provider's panel, it is tenant
 *     scoped by `reseller_id`, and it deliberately holds no credential and no
 *     lifecycle — "PA: No Credential Or Lifecycle Fields Exist", guarded by an
 *     information_schema tripwire in that module's schema test. It is the
 *     DESTINATION of a recharge.
 *
 *   - `source_account` (this module) is the platform's own login on a
 *     supplier's panel. It has no tenant column because it belongs to nobody
 *     but the operator, and it carries exactly the lifecycle the other one
 *     refuses: connection state, sync clock, failure streak and credit
 *     balances.
 *
 * THE BALANCES ARE A MIRROR, NOT A LEDGER. `credits` is what the supplier's
 * panel reported at `lastSyncAt` and nothing more. This module never adds up
 * its own total, because the operator can spend from the panel by hand at any
 * moment and a parallel ledger would be wrong by lunchtime. Every successful
 * sync REPLACES the balances outright.
 *
 * NO CREDENTIAL IS STORED HERE. The panel asks for a verification code at
 * login and never again during a recharge, so a human logs in by hand and the
 * automation inherits the live session. Nothing needs the password, so nothing
 * stores it.
 */

export const SOURCE_CONNECTION_STATUSES = [
  /** Registered, never yet exercised by a sync. */
  "NEVER_CONNECTED",
  "CONNECTED",
  "LOGIN_ERROR",
  "REQUIRES_2FA",
  "BLOCKED",
] as const;

export type SourceConnectionStatus = (typeof SOURCE_CONNECTION_STATUSES)[number];

/**
 * The subset of statuses a failed attempt can produce.
 *
 * `REQUIRES_2FA` is not an edge case here, it is the expected end of every
 * session: the panel's login asks for a verification code, so a dead session
 * always needs a human. It is the state the whole alerting design exists for.
 */
export const SYNC_FAILURE_REASONS = ["LOGIN_ERROR", "REQUIRES_2FA", "BLOCKED"] as const;

export type SyncFailureReason = (typeof SYNC_FAILURE_REASONS)[number];

export function isSyncFailureReason(value: string): value is SyncFailureReason {
  return (SYNC_FAILURE_REASONS as readonly string[]).includes(value);
}

/**
 * How long a point lasts, as the panel labels it: "1 punto = 1 mes" against
 * "1 punto = 12 meses".
 */
export const CREDIT_PERIODS = ["MONTHLY", "ANNUAL"] as const;

export type CreditPeriod = (typeof CREDIT_PERIODS)[number];

/**
 * One balance bucket, exactly as the supplier reports it.
 *
 * `plan` is FREE TEXT and stays that way: "Plan de 1 Dispositivo" and "Plan de
 * 3 Dispositivos" are the SUPPLIER's catalogue, not ours. The day they add a
 * third plan it must appear on the operator's screen without a migration and
 * without a deploy — an enum here would turn their product decision into our
 * outage.
 */
export type CreditBalance = Readonly<{
  plan: string;
  period: CreditPeriod;
  points: number;
}>;

/** The identity of a bucket, for lookups and for the table's unique index. */
export function creditKey(plan: string, period: CreditPeriod): string {
  return `${plan.trim().toLowerCase()}::${period}`;
}

export class InvalidSourceAccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSourceAccountError";
  }
}

export type SourceAccount = Readonly<{
  id: SourceAccountId;
  /** Which supplier panel this login belongs to. */
  panelUrl: string;
  /** The username on that panel. Never a credential. */
  panelUsername: string;
  /** Optional operator-facing nickname. */
  label: string | null;
  connectionStatus: SourceConnectionStatus;
  /**
   * When the last sync was ATTEMPTED — success or failure alike. A clock that
   * only ticked on success would report an account broken for a week as
   * "synced an hour ago", which is precisely backwards.
   */
  lastSyncAt: Date | null;
  /** Whatever the last failed attempt said. NULL once it recovers. */
  lastSyncError: string | null;
  /** Failures since the last success. Reset by `recordSyncSuccess`. */
  consecutiveFailures: number;
  /**
   * The supplier's balances as of `lastSyncAt`. EMPTY means "nobody has looked
   * yet", which is not the same fact as "zero points left" — see
   * `pointsAvailable`.
   */
  credits: readonly CreditBalance[];
  createdBy: UserId;
  createdAt: Date;
  /** Soft delete, project convention (mirrors `provider_account.archived_at`). */
  archivedAt: Date | null;
}>;

export type NewSourceAccountInput = Readonly<{
  panelUrl: string;
  panelUsername: string;
  label?: string | null;
  createdBy: UserId;
  createdAt?: Date;
}>;

export function createSourceAccount(input: NewSourceAccountInput): SourceAccount {
  const panelUrl = input.panelUrl.trim();
  if (panelUrl === "") {
    throw new InvalidSourceAccountError("A source account requires the supplier's panel url.");
  }

  const panelUsername = input.panelUsername.trim();
  if (panelUsername === "") {
    throw new InvalidSourceAccountError("A source account requires a panel username.");
  }

  const label = input.label?.trim();

  return Object.freeze({
    id: crypto.randomUUID(),
    panelUrl,
    panelUsername,
    label: label === undefined || label === "" ? null : label,
    connectionStatus: "NEVER_CONNECTED" as const,
    lastSyncAt: null,
    lastSyncError: null,
    consecutiveFailures: 0,
    credits: [],
    createdBy: input.createdBy,
    createdAt: input.createdAt ?? new Date(),
    archivedAt: null,
  });
}

/**
 * A sync succeeded: the session is alive and these are the balances it read.
 *
 * The balances REPLACE whatever was there. Merging would keep a bucket alive
 * after the supplier stopped reporting it, and a stale bucket that still shows
 * points is worse than no bucket at all.
 */
export function recordSyncSuccess(
  account: SourceAccount,
  at: Date,
  credits: readonly CreditBalance[],
): SourceAccount {
  for (const balance of credits) {
    if (!Number.isInteger(balance.points) || balance.points < 0) {
      throw new InvalidSourceAccountError(
        `The panel reported an impossible balance for ${balance.plan}: ${balance.points}.`,
      );
    }
  }

  return Object.freeze({
    ...account,
    connectionStatus: "CONNECTED" as const,
    lastSyncAt: at,
    lastSyncError: null,
    consecutiveFailures: 0,
    credits: Object.freeze([...credits]),
  });
}

/**
 * The last known balances are KEPT. They are stale, not wrong, and
 * `lastSyncAt` already says how stale — blanking the operator's screen at the
 * exact moment something broke helps nobody.
 */
export function recordSyncFailure(
  account: SourceAccount,
  reason: SyncFailureReason,
  at: Date,
  detail: string | null,
): SourceAccount {
  const trimmed = detail?.trim();

  return Object.freeze({
    ...account,
    connectionStatus: reason,
    lastSyncAt: at,
    lastSyncError: trimmed === undefined || trimmed === "" ? null : trimmed,
    consecutiveFailures: account.consecutiveFailures + 1,
  });
}

/**
 * "Fails repeatedly" needs to be a number the operator can see and change, not
 * a feeling — so the threshold is an argument, not a constant buried in here.
 *
 * `BLOCKED` short-circuits it: a supplier that has actively locked the account
 * is already an incident on the first occurrence, and waiting for two more
 * attempts only teaches them that we keep knocking.
 */
export function needsAttention(account: SourceAccount, failureThreshold: number): boolean {
  // An archived account is out of service deliberately. Alerting on it would
  // train the operator to ignore the alert.
  if (account.archivedAt !== null) {
    return false;
  }

  if (account.connectionStatus === "BLOCKED") {
    return true;
  }

  return account.consecutiveFailures >= failureThreshold;
}

/**
 * The points the supplier reported for one bucket, or `null` when that bucket
 * was never read.
 *
 * `null` and `0` are DIFFERENT facts and the type says so. Collapsing them into
 * zero is how a recharge gets refused on an account that is actually full,
 * simply because nobody had synced it yet.
 */
export function pointsAvailable(
  account: SourceAccount,
  plan: string,
  period: CreditPeriod,
): number | null {
  const key = creditKey(plan, period);
  const balance = account.credits.find((entry) => creditKey(entry.plan, entry.period) === key);

  return balance?.points ?? null;
}

export type RechargeCheck =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; reason: "not-connected" | "balance-unknown" | "invalid-quantity" }>
  | Readonly<{ ok: false; reason: "insufficient-credits"; available: number }>;

/**
 * The preflight before a recharge is attempted against the panel.
 *
 * It refuses on ANY connection state other than `CONNECTED`, and that is the
 * point rather than an oversight: the balance on file was read at
 * `lastSyncAt`, so on a broken session it is a number from the past. Spending
 * against it is guessing.
 *
 * Passing this is NOT proof the recharge will succeed — the supplier is the
 * only authority on that, and the panel may have moved since. It is the cheap
 * check that stops the obviously doomed attempt before a browser is opened.
 */
export function canRecharge(
  account: SourceAccount,
  plan: string,
  period: CreditPeriod,
  points: number,
): RechargeCheck {
  if (account.archivedAt !== null || account.connectionStatus !== "CONNECTED") {
    return { ok: false, reason: "not-connected" };
  }

  if (!Number.isInteger(points) || points < 1) {
    return { ok: false, reason: "invalid-quantity" };
  }

  const available = pointsAvailable(account, plan, period);
  if (available === null) {
    return { ok: false, reason: "balance-unknown" };
  }

  if (points > available) {
    return { ok: false, reason: "insufficient-credits", available };
  }

  return { ok: true };
}

/**
 * The buckets running out.
 *
 * This pool is FINITE, and that is what separates it from the reseller's COP
 * balance: the platform ISSUES that one, so it can never run dry. These points
 * were bought from somebody else, and when they hit zero every recharge stops
 * — no matter how much COP a reseller is holding.
 *
 * An account nobody has synced reports nothing rather than "everything is
 * low": an unread balance is not an empty one.
 */
export function lowCredits(
  account: SourceAccount,
  threshold: number,
): readonly CreditBalance[] {
  return account.credits.filter((balance) => balance.points <= threshold);
}
