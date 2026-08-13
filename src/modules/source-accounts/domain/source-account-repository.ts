import type { SourceAccountId, UserId } from "./ids";
import type {
  CreditBalance,
  SourceAccount,
  SourceConnectionStatus,
  SyncFailureReason,
} from "./source-account";

/**
 * The source-accounts port.
 *
 * NOT scoped by tenant, and it cannot be: `source_account` has no
 * `reseller_id` because the platform owns these, not a reseller. The guard is
 * therefore the composition root — every caller reaches this through a deps
 * factory that has already run `requireRole("ADMIN")`, exactly like
 * `TopUpSettingsRepository`. That is a deliberate difference from the
 * tenant-scoped repositories, so it is written down rather than left to be
 * noticed.
 */

export type NewSourceAccountCommand = Readonly<{
  panelUrl: string;
  panelUsername: string;
  label?: string | null;
  createdBy: UserId;
  /** Defaults to now. Explicit only where a caller needs a deterministic clock. */
  createdAt?: Date;
}>;

export type CreateSourceAccountOutcome =
  | Readonly<{ ok: true; account: SourceAccount }>
  | Readonly<{ ok: false; reason: "identity-taken"; conflictingAccountId: SourceAccountId }>;

/**
 * What the automation reports after trying to use the session.
 *
 * A SUCCESS CARRIES THE BALANCES, and that is not a convenience — it is the
 * whole contract. "I got in" and "here is what the supplier says you have" are
 * the same observation, made at the same instant against the same page. Split
 * them into two calls and there is a window where the platform believes the
 * session is alive while showing balances from the previous one.
 *
 * A failure carries a reason rather than an optional message: "it failed" with
 * nothing attached is the state an operator can do nothing with, so the type
 * refuses to express it.
 */
export type SyncOutcome =
  | Readonly<{ ok: true; credits: readonly CreditBalance[] }>
  | Readonly<{ ok: false; reason: SyncFailureReason; detail?: string | null }>;

export interface SourceAccountRepository {
  /**
   * Rejects a duplicate (panel url, username) among the live accounts —
   * registering the same login twice would let two workers drive one session
   * against each other.
   */
  create(command: NewSourceAccountCommand): Promise<CreateSourceAccountOutcome>;

  /** Newest first, each with its last known balances. */
  list(): Promise<readonly SourceAccount[]>;

  get(id: SourceAccountId): Promise<SourceAccount | null>;

  /**
   * One event, one call: the status, the clock, the failure streak and the
   * balances all move together or not at all. Returns `null` when the account
   * is gone.
   *
   * On success the balance rows are REPLACED wholesale, never merged — see the
   * schema's header on why this table is a mirror and not a ledger.
   */
  recordSync(id: SourceAccountId, outcome: SyncOutcome, at?: Date): Promise<SourceAccount | null>;

  archive(id: SourceAccountId, at?: Date): Promise<SourceAccount | null>;

  /** One grouped query for the header badges, not one `list` per status. */
  countByConnectionStatus(): Promise<ReadonlyMap<SourceConnectionStatus, number>>;
}
