import type { SourceAccountId, UserId } from "./ids";
import type { CreditPeriod } from "./source-account";

/**
 * One recharge against the supplier's panel, and the record that makes it
 * SAFE TO RETRY.
 *
 * THE PROBLEM THIS EXISTS TO SOLVE. A web form has no idempotency key. The
 * automation clicks "Aceptar", the connection drops, and nobody knows whether
 * the supplier applied the recharge or not. Retrying might double-charge a
 * customer; not retrying might leave them unpaid. Both are wrong and there is
 * no way to tell them apart — unless something observable was written down
 * first.
 *
 * THE ANCHOR. The panel reports "Puntos acumulados", a counter that only ever
 * grows. Captured BEFORE the click and compared after, it settles the question
 * with evidence instead of a guess:
 *
 *   after == before + points  -> it landed          (CONFIRMED)
 *   after == before           -> it never landed    (FAILED, safe to retry)
 *   anything else             -> cannot be attributed (UNVERIFIED, ask a human)
 *
 * THE ORDERING IS THE DESIGN. `markSubmitted` is persisted BEFORE the click,
 * not after. A process that dies mid-click leaves a `SUBMITTED` row behind,
 * and a `SUBMITTED` row means "go verify", never "go retry". Writing it
 * afterwards would lose exactly the attempts that most need verifying.
 *
 * `UNVERIFIED` IS NOT A FAILURE and must never be treated as one. It means the
 * evidence is ambiguous — the session died before the counter could be re-read,
 * or somebody recharged the same account by hand at the same moment. Collapsing
 * it into `FAILED` so a retry can proceed is precisely how money gets moved
 * twice.
 */

export type RechargeAttemptId = string;

export const RECHARGE_ATTEMPT_STATUSES = [
  /** Anchor captured, nothing clicked yet. */
  "PENDING",
  /** The click happened, or may have. Outcome unknown until verified. */
  "SUBMITTED",
  /** Verified: the counter moved by exactly the points asked for. */
  "CONFIRMED",
  /** Verified: the counter did not move. The only state safe to retry. */
  "FAILED",
  /** Unresolvable from evidence. A human has to look at the panel. */
  "UNVERIFIED",
] as const;

export type RechargeAttemptStatus = (typeof RECHARGE_ATTEMPT_STATUSES)[number];

/** The states still awaiting an outcome. */
const OPEN_STATUSES: readonly RechargeAttemptStatus[] = ["PENDING", "SUBMITTED"];

export class InvalidRechargeAttemptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidRechargeAttemptError";
  }
}

export class RechargeAttemptNotOpenError extends Error {
  constructor(
    public readonly attemptId: RechargeAttemptId,
    public readonly status: RechargeAttemptStatus,
  ) {
    super(`Recharge attempt ${attemptId} is ${status} and cannot change any more.`);
    this.name = "RechargeAttemptNotOpenError";
  }
}

export type RechargeAttempt = Readonly<{
  id: RechargeAttemptId;
  /** The supplier login this was drawn against. */
  sourceAccountId: SourceAccountId;
  /** The customer account on the panel, as typed into "Cuenta" (a phone). */
  targetAccount: string;
  /** The supplier's plan name, verbatim. */
  plan: string;
  period: CreditPeriod;
  points: number;
  status: RechargeAttemptStatus;
  /** "Puntos acumulados" as read immediately before the attempt. The anchor. */
  accumulatedBefore: number;
  /** The same counter after. NULL while open, and when it could not be read. */
  accumulatedAfter: number | null;
  /** Why it is unverifiable, for the human who has to resolve it. */
  failureDetail: string | null;
  createdBy: UserId;
  createdAt: Date;
  submittedAt: Date | null;
  settledAt: Date | null;
}>;

export type NewRechargeAttemptInput = Readonly<{
  sourceAccountId: SourceAccountId;
  targetAccount: string;
  plan: string;
  period: CreditPeriod;
  points: number;
  accumulatedBefore: number;
  createdBy: UserId;
  createdAt?: Date;
}>;

export function openRechargeAttempt(input: NewRechargeAttemptInput): RechargeAttempt {
  const targetAccount = input.targetAccount.trim();
  if (targetAccount === "") {
    throw new InvalidRechargeAttemptError("A recharge needs the account it is going to.");
  }

  const plan = input.plan.trim();
  if (plan === "") {
    throw new InvalidRechargeAttemptError("A recharge needs the supplier's plan name.");
  }

  if (!Number.isInteger(input.points) || input.points < 1) {
    throw new InvalidRechargeAttemptError("A recharge must move at least one whole point.");
  }

  // A negative or fractional anchor means the scrape misread the page, and
  // recording it would poison every later comparison against it.
  if (!Number.isInteger(input.accumulatedBefore) || input.accumulatedBefore < 0) {
    throw new InvalidRechargeAttemptError(
      `The panel reported an impossible accumulated total: ${input.accumulatedBefore}.`,
    );
  }

  return Object.freeze({
    id: crypto.randomUUID(),
    sourceAccountId: input.sourceAccountId,
    targetAccount,
    plan,
    period: input.period,
    points: input.points,
    status: "PENDING" as const,
    accumulatedBefore: input.accumulatedBefore,
    accumulatedAfter: null,
    failureDetail: null,
    createdBy: input.createdBy,
    createdAt: input.createdAt ?? new Date(),
    submittedAt: null,
    settledAt: null,
  });
}

/**
 * Persist this BEFORE clicking, never after. Its whole purpose is to survive a
 * crash that happens during the click — written afterwards it would be missing
 * from exactly the attempts that need it.
 */
export function markSubmitted(attempt: RechargeAttempt, at: Date): RechargeAttempt {
  if (attempt.status !== "PENDING") {
    throw new RechargeAttemptNotOpenError(attempt.id, attempt.status);
  }

  return Object.freeze({ ...attempt, status: "SUBMITTED" as const, submittedAt: at });
}

/**
 * The verdict, from the counter alone.
 *
 * Kept as a free function so the rule can be read, tested and argued about on
 * its own — it is the single most consequential line of the whole integration.
 */
export function classifyOutcome(
  accumulatedBefore: number,
  accumulatedAfter: number,
  points: number,
): Extract<RechargeAttemptStatus, "CONFIRMED" | "FAILED" | "UNVERIFIED"> {
  if (accumulatedAfter === accumulatedBefore + points) return "CONFIRMED";
  if (accumulatedAfter === accumulatedBefore) return "FAILED";

  // Includes the counter going backwards, which is impossible against a
  // monotonic total and therefore means the scrape read the wrong thing.
  return "UNVERIFIED";
}

/**
 * Settle an open attempt against a fresh reading of the counter.
 *
 * A `PENDING` attempt is settleable on purpose: that is the recovery path for
 * a crash BEFORE the click, where the honest answer is almost always `FAILED`
 * and the retry is safe.
 */
export function settleAttempt(
  attempt: RechargeAttempt,
  accumulatedAfter: number,
  at: Date,
): RechargeAttempt {
  if (!OPEN_STATUSES.includes(attempt.status)) {
    throw new RechargeAttemptNotOpenError(attempt.id, attempt.status);
  }

  const status = classifyOutcome(attempt.accumulatedBefore, accumulatedAfter, attempt.points);

  return Object.freeze({
    ...attempt,
    status,
    accumulatedAfter,
    failureDetail:
      status === "UNVERIFIED"
        ? `El contador pasó de ${attempt.accumulatedBefore} a ${accumulatedAfter}, y se esperaba ${
            attempt.accumulatedBefore + attempt.points
          }.`
        : null,
    settledAt: at,
  });
}

/**
 * The counter could not be read at all.
 *
 * This is NOT a failure and the type keeps them apart deliberately: the
 * recharge may well have landed, and there is no evidence either way. A human
 * opens the panel and decides. Treating this as `FAILED` so an automatic retry
 * can proceed is the one mistake that costs real money.
 */
export function markUnverifiable(
  attempt: RechargeAttempt,
  reason: string,
  at: Date,
): RechargeAttempt {
  if (!OPEN_STATUSES.includes(attempt.status)) {
    throw new RechargeAttemptNotOpenError(attempt.id, attempt.status);
  }

  const trimmed = reason.trim();
  if (trimmed === "") {
    throw new InvalidRechargeAttemptError("An unverifiable attempt must record why.");
  }

  return Object.freeze({
    ...attempt,
    status: "UNVERIFIED" as const,
    accumulatedAfter: null,
    failureDetail: trimmed,
    settledAt: at,
  });
}

/** Attempts a human still has to resolve. */
export function needsHumanReview(attempt: RechargeAttempt): boolean {
  return attempt.status === "UNVERIFIED" || attempt.status === "SUBMITTED";
}
