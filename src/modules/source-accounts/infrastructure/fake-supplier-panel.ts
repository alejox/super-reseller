import { creditKey, type CreditBalance, type CreditPeriod } from "../domain/source-account";
import type {
  PanelAccountSnapshot,
  PanelBucket,
  PanelQueryOutcome,
  ReadOwnCreditsOutcome,
  SubmitRechargeCommand,
  SubmitRechargeOutcome,
  SupplierPanel,
} from "../domain/supplier-panel";

/**
 * A supplier panel that behaves like the real one, including the ways it
 * breaks.
 *
 * This exists so the protocol can be tested where the real panel cannot be: at
 * the instant the connection dies between "Aceptar" and the response. That
 * scenario is the entire reason the anchor exists, it happens perhaps once a
 * month in production, and it is unreproducible on demand against a live
 * supplier — so it is reproduced here instead.
 *
 * The fake keeps a real monotonic counter, so a test that double-submits sees
 * the counter move twice, exactly as an operator's customer would.
 */
export class FakeSupplierPanel implements SupplierPanel {
  private readonly accounts = new Map<string, Map<string, PanelBucket>>();

  /** Set from a test to make the NEXT call fail in a specific way. */
  failNextQuery: Extract<PanelQueryOutcome, { ok: false }> | null = null;
  failNextSubmit: Extract<SubmitRechargeOutcome, { ok: false }> | null = null;

  /**
   * The nasty one: the recharge LANDS and the caller is told it did not,
   * because the connection died after the panel had already committed. Any
   * implementation that trusts the submit result gets this wrong.
   */
  applyThenReportUnknown = false;

  /** Runs after a successful submit — used to simulate a concurrent human. */
  onAfterSubmit: (() => void) | null = null;

  queries = 0;
  submits = 0;

  seed(account: string, buckets: readonly PanelBucket[], status = "Normal"): void {
    const byKey = new Map(buckets.map((b) => [creditKey(b.plan, b.period), b]));
    this.accounts.set(account, byKey);
    this.statuses.set(account, status);
  }

  private readonly statuses = new Map<string, string>();

  /** Moves the counter directly, as a human clicking `+` on the panel would. */
  applyRecharge(account: string, plan: string, period: CreditPeriod, points: number): void {
    const buckets = this.accounts.get(account);
    if (!buckets) throw new Error(`fake panel: unknown account ${account}`);

    const key = creditKey(plan, period);
    const bucket = buckets.get(key);
    if (!bucket) throw new Error(`fake panel: unknown bucket ${key}`);

    buckets.set(key, {
      ...bucket,
      available: bucket.available + points,
      // Monotonic, exactly like the real "Puntos acumulados".
      accumulated: bucket.accumulated + points,
    });
  }

  snapshot(account: string): PanelAccountSnapshot | null {
    const buckets = this.accounts.get(account);
    if (!buckets) return null;

    return {
      account,
      status: this.statuses.get(account) ?? "Normal",
      buckets: [...buckets.values()],
    };
  }

  /** OUR balances, as the page header would report them. */
  ownCredits: CreditBalance[] = [];

  /** Set from a test to make the NEXT sync fail in a specific way. */
  failNextSync: Extract<ReadOwnCreditsOutcome, { ok: false }> | null = null;

  syncs = 0;

  async readOwnCredits(): Promise<ReadOwnCreditsOutcome> {
    this.syncs += 1;

    if (this.failNextSync) {
      const failure = this.failNextSync;
      this.failNextSync = null;
      return failure;
    }

    return { ok: true, credits: this.ownCredits };
  }

  async query(targetAccount: string): Promise<PanelQueryOutcome> {
    this.queries += 1;

    if (this.failNextQuery) {
      const failure = this.failNextQuery;
      this.failNextQuery = null;
      return failure;
    }

    const snapshot = this.snapshot(targetAccount);
    if (!snapshot) return { ok: false, reason: "account-not-found" };

    return { ok: true, snapshot };
  }

  async submitRecharge(command: SubmitRechargeCommand): Promise<SubmitRechargeOutcome> {
    this.submits += 1;

    if (this.applyThenReportUnknown) {
      this.applyThenReportUnknown = false;
      this.applyRecharge(command.targetAccount, command.plan, command.period, command.points);
      return { ok: false, reason: "unknown", detail: "se cortó después de Aceptar" };
    }

    if (this.failNextSubmit) {
      const failure = this.failNextSubmit;
      this.failNextSubmit = null;
      return failure;
    }

    this.applyRecharge(command.targetAccount, command.plan, command.period, command.points);
    this.onAfterSubmit?.();

    return { ok: true };
  }
}
