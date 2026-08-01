import type { UserId } from "./ids";
import type { ScopedUserRow } from "./scoped-users-repository";

export type DeactivationOutcome = Readonly<{
  user: ScopedUserRow;
  /** How many still-active sessions were revoked by this deactivation. */
  revokedSessions: number;
}>;

/**
 * AUTH: Deactivation Revokes Sessions. Deactivating a user and revoking
 * their sessions is ONE operation, not two: between a successful soft
 * delete and a failed revocation there is a window where a deactivated user
 * still holds a valid session, and that window is the whole vulnerability.
 *
 * Scoped at construction, exactly like `ScopedUsersRepository` — a RESELLER
 * scope can only deactivate a user it owns.
 */
export interface AccountAdministration {
  /**
   * Returns `null` when no user in scope matches — a no-op, not an error
   * (same contract as `ScopedUsersRepository.deactivateUser`).
   */
  deactivateUserAndRevokeSessions(userId: UserId): Promise<DeactivationOutcome | null>;
}
