import type { SourceAccountId, UserId } from "../../domain/ids";
import {
  lowCredits,
  needsAttention,
  type CreditBalance,
  type SourceAccount,
  type SourceConnectionStatus,
} from "../../domain/source-account";
import type {
  SourceAccountRepository,
  SyncOutcome,
} from "../../domain/source-account-repository";

/**
 * Block B's use cases: register the platform's login on a supplier panel,
 * record what happened the last time the automation used it, and put both the
 * broken sessions and the emptying buckets in front of the operator.
 *
 * ADMIN-only, guarded at the composition root (`adminSourceAccountsDeps`)
 * because the repository has no tenant column to scope by. See the port.
 */

/**
 * How many consecutive failures before the operator is told.
 *
 * Three, not one: a single failed attempt is usually a hiccup, and an alert
 * that cries wolf on every blip gets ignored — which is the same as having no
 * alert. `BLOCKED` bypasses this entirely; see `needsAttention`.
 */
export const FAILURE_ALERT_THRESHOLD = 3;

/**
 * When a credit bucket is low enough to warn about.
 *
 * This pool is FINITE, which is what separates it from the reseller's COP
 * balance — the platform issues that one, so it can never run dry. These
 * points were bought from somebody else, and at zero every recharge stops. Ten
 * is a day or two of room to go buy more, not a number with a theory behind
 * it; move it once real volume says what a day looks like.
 */
export const LOW_CREDIT_THRESHOLD = 10;

export type SourceAccountDeps = Readonly<{
  sourceAccounts: SourceAccountRepository;
  actorId: UserId;
}>;

export type RegisterSourceAccountCommand = Readonly<{
  panelUrl: string;
  panelUsername: string;
  label?: string | null;
}>;

export type RegisterSourceAccountResult =
  | Readonly<{ ok: true; account: SourceAccount }>
  | Readonly<{
      ok: false;
      reason: "panel-url-required" | "panel-username-required" | "identity-taken";
    }>;

export async function registerSourceAccount(
  deps: SourceAccountDeps,
  command: RegisterSourceAccountCommand,
): Promise<RegisterSourceAccountResult> {
  if (command.panelUrl.trim() === "") {
    return { ok: false, reason: "panel-url-required" };
  }

  if (command.panelUsername.trim() === "") {
    return { ok: false, reason: "panel-username-required" };
  }

  const outcome = await deps.sourceAccounts.create({
    panelUrl: command.panelUrl,
    panelUsername: command.panelUsername,
    label: command.label ?? null,
    createdBy: deps.actorId,
  });

  if (!outcome.ok) {
    return { ok: false, reason: "identity-taken" };
  }

  return { ok: true, account: outcome.account };
}

export type RecordSyncAttemptCommand = Readonly<{
  accountId: SourceAccountId;
  outcome: SyncOutcome;
}>;

export type RecordSyncAttemptResult =
  | Readonly<{ ok: true; account: SourceAccount; alert: boolean }>
  | Readonly<{ ok: false; reason: "not-found" }>;

/**
 * THE SEAM THE AUTOMATION REPORTS THROUGH.
 *
 * There is no browser in this repository, and this function is deliberately
 * the entire contract one will have to satisfy: say whether the session
 * worked, hand over the balances you read, get back whether a human now needs
 * to look. Everything the automation knows enters the platform here and
 * nowhere else.
 *
 * `alert` is returned rather than logged, because the criterion is "visible in
 * the panel, not only in a server log" — and a caller that has to remember to
 * compute it is a caller that will forget.
 */
export async function recordSyncAttempt(
  deps: SourceAccountDeps,
  command: RecordSyncAttemptCommand,
): Promise<RecordSyncAttemptResult> {
  const account = await deps.sourceAccounts.recordSync(command.accountId, command.outcome);

  if (!account) {
    return { ok: false, reason: "not-found" };
  }

  return { ok: true, account, alert: needsAttention(account, FAILURE_ALERT_THRESHOLD) };
}

/** A bucket running out, carrying the account it belongs to. */
export type LowStockEntry = Readonly<{
  account: SourceAccount;
  balance: CreditBalance;
}>;

export type SourceAccountBoard = Readonly<{
  accounts: readonly SourceAccount[];
  /** Sessions the operator has to fix. Never empty for a blocked account. */
  alerting: readonly SourceAccount[];
  /** Buckets the operator has to go buy more of. */
  lowStock: readonly LowStockEntry[];
  counts: ReadonlyMap<SourceConnectionStatus, number>;
}>;

/**
 * The two alerts are SEPARATE on purpose. A broken session and an emptying
 * bucket need different actions from different people — one is "go log in
 * again", the other is "go pay the supplier" — and merging them into a single
 * "problems" count would tell the operator neither.
 */
export async function loadSourceAccountBoard(deps: SourceAccountDeps): Promise<SourceAccountBoard> {
  const [accounts, counts] = await Promise.all([
    deps.sourceAccounts.list(),
    deps.sourceAccounts.countByConnectionStatus(),
  ]);

  const lowStock = accounts.flatMap((account) =>
    lowCredits(account, LOW_CREDIT_THRESHOLD).map((balance) => ({ account, balance })),
  );

  return {
    accounts,
    alerting: accounts.filter((account) => needsAttention(account, FAILURE_ALERT_THRESHOLD)),
    lowStock,
    counts,
  };
}

export type ArchiveSourceAccountResult =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; reason: "not-found" }>;

export async function archiveSourceAccount(
  deps: SourceAccountDeps,
  accountId: SourceAccountId,
): Promise<ArchiveSourceAccountResult> {
  const archived = await deps.sourceAccounts.archive(accountId);

  return archived ? { ok: true } : { ok: false, reason: "not-found" };
}
