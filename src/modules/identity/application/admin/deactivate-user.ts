import type {
  AccountAdministration,
  DeactivationOutcome,
} from "@/modules/identity/domain/account-administration";
import type { UserId } from "@/modules/identity/domain/ids";
import { assertRole, requireSession } from "../authorization";
import type { VerifiedSession } from "../session-verifier";

export type DeactivateUserDeps = Readonly<{
  administration: AccountAdministration;
}>;

/**
 * The representative ADMIN-only operation (task 5b.6). Both checks run
 * BEFORE the write and both throw rather than return, so there is no code
 * path where a denied caller still reaches the database.
 *
 * It takes the verified session as an argument instead of reading it
 * itself: that keeps the use case free of `next/headers` and testable
 * against a real database, while the Server Action wrapper stays a
 * three-line shim that cannot hide any logic.
 */
export async function deactivateUserAsAdmin(
  deps: DeactivateUserDeps,
  session: VerifiedSession | null,
  targetUserId: UserId,
): Promise<DeactivationOutcome | null> {
  assertRole(requireSession(session), "ADMIN");

  return deps.administration.deactivateUserAndRevokeSessions(targetUserId);
}
