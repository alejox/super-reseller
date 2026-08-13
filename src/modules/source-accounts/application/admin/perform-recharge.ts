import type { SourceAccountId, UserId } from "../../domain/ids";
import {
  markSubmitted,
  markUnverifiable,
  openRechargeAttempt,
  settleAttempt,
  type RechargeAttempt,
  type RechargeAttemptId,
} from "../../domain/recharge-attempt";
import type { RechargeAttemptRepository } from "../../domain/recharge-attempt-repository";
import { canRecharge, creditKey, type CreditPeriod } from "../../domain/source-account";
import type { SourceAccountRepository } from "../../domain/source-account-repository";
import type { PanelBucket, PanelQueryOutcome, SupplierPanel } from "../../domain/supplier-panel";

/**
 * The recharge protocol.
 *
 * Read this once and the rest of the integration follows:
 *
 *   1. Check locally whether we even have the points. Cheap, no browser.
 *   2. Ask the panel for the target's counter. THE ANCHOR.
 *   3. Write the attempt down as PENDING, anchor included.
 *   4. Write it down as SUBMITTED — BEFORE clicking, never after.
 *   5. Click.
 *   6. Re-read the counter and compare. ALWAYS, whatever step 5 said.
 *
 * STEP 6 RUNS UNCONDITIONALLY, and that is the load-bearing decision. A
 * submit that reported success can still have been dropped; a submit that
 * reported failure can still have landed before the connection died. The
 * counter is the only authority in this system, so it is always consulted.
 *
 * STEP 4 BEFORE STEP 5 is the other one. A process killed during the click
 * leaves a SUBMITTED row, and a SUBMITTED row means "verify me". Written after
 * the click it would be missing from exactly the attempts that need it, and
 * the operator would be left guessing about the ones that matter most.
 */

export type RechargeDeps = Readonly<{
  sourceAccounts: SourceAccountRepository;
  attempts: RechargeAttemptRepository;
  panel: SupplierPanel;
  actorId: UserId;
  /** Injectable clock, so the tests do not have to sleep. */
  now?: () => Date;
}>;

export type PerformRechargeCommand = Readonly<{
  sourceAccountId: SourceAccountId;
  targetAccount: string;
  plan: string;
  period: CreditPeriod;
  points: number;
}>;

export type PerformRechargeResult =
  | Readonly<{ ok: true; attempt: RechargeAttempt }>
  | Readonly<{
      ok: false;
      reason:
        | "source-not-found"
        | "source-not-connected"
        | "source-balance-unknown"
        | "invalid-quantity"
        | "target-not-found"
        | "target-bucket-unknown"
        | "panel-unreachable";
      detail?: string;
    }>
  | Readonly<{ ok: false; reason: "insufficient-credits"; available: number }>;

function bucketOf(
  buckets: readonly PanelBucket[],
  plan: string,
  period: CreditPeriod,
): PanelBucket | null {
  const key = creditKey(plan, period);

  return buckets.find((bucket) => creditKey(bucket.plan, bucket.period) === key) ?? null;
}

/** Maps a failed panel read onto the caller's vocabulary. */
function queryFailure(
  outcome: Extract<PanelQueryOutcome, { ok: false }>,
): Extract<PerformRechargeResult, { ok: false }> {
  if (outcome.reason === "account-not-found") {
    return { ok: false, reason: "target-not-found" };
  }

  return { ok: false, reason: "panel-unreachable", detail: outcome.detail };
}

export async function performRecharge(
  deps: RechargeDeps,
  command: PerformRechargeCommand,
): Promise<PerformRechargeResult> {
  const clock = deps.now ?? (() => new Date());

  const source = await deps.sourceAccounts.get(command.sourceAccountId);
  if (!source) {
    return { ok: false, reason: "source-not-found" };
  }

  // Step 1. The cheap local guard: a dead session, an unread balance or an
  // amount we plainly cannot cover, settled before a browser is opened.
  const preflight = canRecharge(source, command.plan, command.period, command.points);
  if (!preflight.ok) {
    if (preflight.reason === "insufficient-credits") {
      return { ok: false, reason: "insufficient-credits", available: preflight.available };
    }
    if (preflight.reason === "not-connected") {
      return { ok: false, reason: "source-not-connected" };
    }
    if (preflight.reason === "balance-unknown") {
      return { ok: false, reason: "source-balance-unknown" };
    }
    return { ok: false, reason: "invalid-quantity" };
  }

  // Step 2. The anchor.
  const before = await deps.panel.query(command.targetAccount);
  if (!before.ok) {
    return queryFailure(before);
  }

  const bucket = bucketOf(before.snapshot.buckets, command.plan, command.period);
  if (!bucket) {
    // The panel does not offer this plan for this account. Guessing a starting
    // counter of zero here would make every later comparison meaningless.
    return { ok: false, reason: "target-bucket-unknown" };
  }

  // Step 3. Written down before anything is touched.
  let attempt = await deps.attempts.save(
    openRechargeAttempt({
      sourceAccountId: source.id,
      targetAccount: command.targetAccount,
      plan: command.plan,
      period: command.period,
      points: command.points,
      accumulatedBefore: bucket.accumulated,
      createdBy: deps.actorId,
      createdAt: clock(),
    }),
  );

  // Step 4. BEFORE the click. This row is what a crash leaves behind.
  attempt = await deps.attempts.save(markSubmitted(attempt, clock()));

  // Step 5. The only mutating call in the whole flow.
  const submitted = await deps.panel.submitRecharge({
    targetAccount: command.targetAccount,
    plan: command.plan,
    period: command.period,
    points: command.points,
  });

  // Step 6. Unconditional. `submitted` is a hint; the counter is the authority.
  return { ok: true, attempt: await verify(deps, attempt, submitted.ok ? null : submitted.detail) };
}

/**
 * Re-read the counter and settle the attempt against it.
 *
 * Shared by the live flow and by recovery, because they are the same question
 * asked at different times: "the anchor said N — what does it say now?"
 */
async function verify(
  deps: RechargeDeps,
  attempt: RechargeAttempt,
  submitDetail: string | null | undefined,
): Promise<RechargeAttempt> {
  const clock = deps.now ?? (() => new Date());
  const after = await deps.panel.query(attempt.targetAccount);

  if (!after.ok) {
    // Could not look. NOT a failure: the recharge may have landed, and there
    // is no evidence either way, so it goes to a human instead of to a retry.
    return deps.attempts.save(
      markUnverifiable(
        attempt,
        `No se pudo reconsultar la cuenta (${after.reason})${
          submitDetail ? `; el envío dijo: ${submitDetail}` : ""
        }.`,
        clock(),
      ),
    );
  }

  const bucket = bucketOf(after.snapshot.buckets, attempt.plan, attempt.period);
  if (!bucket) {
    // The bucket existed a moment ago and does not now. Something is wrong
    // with the page, the row, or the account — not something to guess about.
    return deps.attempts.save(
      markUnverifiable(
        attempt,
        `El plan "${attempt.plan}" ya no aparece para esa cuenta al reconsultar.`,
        clock(),
      ),
    );
  }

  return deps.attempts.save(settleAttempt(attempt, bucket.accumulated, clock()));
}

export type ResumeAttemptResult =
  | Readonly<{ ok: true; attempt: RechargeAttempt }>
  | Readonly<{ ok: false; reason: "not-found" | "already-settled" }>;

/**
 * RECOVERY. Takes an attempt left open by a crash and asks the counter what
 * happened, exactly as the live flow would have.
 *
 * It never re-clicks. A `SUBMITTED` attempt may already have moved points, and
 * the whole reason it was written down before the click was so that nobody —
 * including this function — has to guess.
 */
export async function resumeRechargeAttempt(
  deps: RechargeDeps,
  attemptId: RechargeAttemptId,
): Promise<ResumeAttemptResult> {
  const attempt = await deps.attempts.get(attemptId);
  if (!attempt) {
    return { ok: false, reason: "not-found" };
  }

  if (attempt.status !== "PENDING" && attempt.status !== "SUBMITTED") {
    return { ok: false, reason: "already-settled" };
  }

  return { ok: true, attempt: await verify(deps, attempt, null) };
}
