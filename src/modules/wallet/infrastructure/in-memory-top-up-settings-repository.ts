import type { UserId } from "../domain/ids";
import { createTopUpLimits, DEFAULT_TOP_UP_LIMITS, type TopUpLimits } from "../domain/top-up-limits";
import type { TopUpSettingsRepository } from "../domain/top-up-settings-repository";

/** Test double for `TopUpSettingsRepository`. Starts on the defaults, like an unconfigured platform. */
export class InMemoryTopUpSettingsRepository implements TopUpSettingsRepository {
  constructor(private limits: TopUpLimits = DEFAULT_TOP_UP_LIMITS) {}

  async read(): Promise<TopUpLimits> {
    return this.limits;
  }

  async save(limits: TopUpLimits, updatedBy: UserId): Promise<TopUpLimits> {
    this.limits = createTopUpLimits(limits, updatedBy, new Date());
    return this.limits;
  }
}
