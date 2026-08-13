import type { UserId } from "./ids";
import type { TopUpLimits } from "./top-up-limits";

/**
 * The platform's top-up limits, as a port.
 *
 * `read` never returns null. A missing row means "nobody has configured this
 * yet", and the answer to that is `DEFAULT_TOP_UP_LIMITS`, not an absent value
 * every caller would have to remember to default — a forgotten default here is
 * a top-up screen with no limits at all.
 */
export interface TopUpSettingsRepository {
  read(): Promise<TopUpLimits>;

  save(limits: TopUpLimits, updatedBy: UserId): Promise<TopUpLimits>;
}
