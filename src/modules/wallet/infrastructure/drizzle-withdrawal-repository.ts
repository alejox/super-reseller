import { and, eq } from "drizzle-orm";
import type { ModuleDb } from "@/shared/db/module-db";
import type { ResellerId } from "../domain/ids";
import type {
  WithdrawalRepository,
  WithdrawalMethod,
  WithdrawalMethodType,
  WithdrawalSettings,
  NewWithdrawalMethodInput,
  UpdateWithdrawalSettingsInput
} from "../domain/withdrawal";
import { withdrawalMethods, withdrawalSettings } from "./wallet.schema";

export function createDrizzleWithdrawalRepository(db: ModuleDb): WithdrawalRepository {
  return {
    async getMethods(resellerId: ResellerId): Promise<readonly WithdrawalMethod[]> {
      const rows = await db
        .select()
        .from(withdrawalMethods)
        .where(eq(withdrawalMethods.resellerId, resellerId));

      return rows.map((row) => ({
        id: row.id,
        resellerId: row.resellerId,
        type: row.type as WithdrawalMethodType,
        details: row.details,
        isPrimary: row.isPrimary,
        isActive: row.isActive,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }));
    },

    async addMethod(input: NewWithdrawalMethodInput): Promise<WithdrawalMethod> {
      const [row] = await db
        .insert(withdrawalMethods)
        .values({
          resellerId: input.resellerId,
          type: input.type,
          details: input.details,
          isPrimary: input.isPrimary ?? false,
        })
        .returning();

      return {
        id: row.id,
        resellerId: row.resellerId,
        type: row.type as WithdrawalMethodType,
        details: row.details,
        isPrimary: row.isPrimary,
        isActive: row.isActive,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    },

    async setPrimaryMethod(resellerId: ResellerId, methodId: string): Promise<void> {
      await db.transaction(async (tx) => {
        // Reset all methods for this reseller to not primary
        await tx
          .update(withdrawalMethods)
          .set({ isPrimary: false })
          .where(eq(withdrawalMethods.resellerId, resellerId));

        // Set the chosen one to primary. The `resellerId` predicate is not
        // redundant with the `id` lookup: `methodId` arrives from the client,
        // so filtering by id alone lets one reseller flip another reseller's
        // method — and the withdrawal debit pays out to whatever is primary.
        // Owning the row is what grants the right to change it.
        await tx
          .update(withdrawalMethods)
          .set({ isPrimary: true })
          .where(
            and(
              eq(withdrawalMethods.id, methodId),
              eq(withdrawalMethods.resellerId, resellerId),
            ),
          );
      });
    },

    async deactivateMethod(resellerId: ResellerId, methodId: string): Promise<void> {
      await db
        .update(withdrawalMethods)
        .set({ isActive: false })
        .where(
          and(
            eq(withdrawalMethods.id, methodId),
            eq(withdrawalMethods.resellerId, resellerId),
          ),
        );
    },

    async getSettings(resellerId: ResellerId): Promise<WithdrawalSettings | null> {
      const [row] = await db
        .select()
        .from(withdrawalSettings)
        .where(eq(withdrawalSettings.resellerId, resellerId));

      if (!row) return null;

      return {
        resellerId: row.resellerId,
        autoWithdraw: row.autoWithdraw,
        condition: row.condition as WithdrawalSettings["condition"],
        thresholdAmountMinor: row.thresholdAmountMinor,
        scheduleFrequency: row.scheduleFrequency as WithdrawalSettings["scheduleFrequency"],
        minWithdrawalMinor: row.minWithdrawalMinor,
        maxDailyWithdrawalMinor: row.maxDailyWithdrawalMinor,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    },

    async upsertSettings(input: UpdateWithdrawalSettingsInput): Promise<WithdrawalSettings> {
      const [row] = await db
        .insert(withdrawalSettings)
        .values({
          resellerId: input.resellerId,
          autoWithdraw: input.autoWithdraw ?? false,
          condition: input.condition ?? "THRESHOLD",
          thresholdAmountMinor: input.thresholdAmountMinor ?? 5000,
          scheduleFrequency: input.scheduleFrequency ?? "MONTHLY",
          minWithdrawalMinor: input.minWithdrawalMinor ?? 5000,
          maxDailyWithdrawalMinor: input.maxDailyWithdrawalMinor ?? 500000,
        })
        .onConflictDoUpdate({
          target: withdrawalSettings.resellerId,
          set: {
            autoWithdraw: input.autoWithdraw ?? withdrawalSettings.autoWithdraw,
            condition: input.condition ?? withdrawalSettings.condition,
            thresholdAmountMinor: input.thresholdAmountMinor ?? withdrawalSettings.thresholdAmountMinor,
            scheduleFrequency: input.scheduleFrequency ?? withdrawalSettings.scheduleFrequency,
            minWithdrawalMinor: input.minWithdrawalMinor ?? withdrawalSettings.minWithdrawalMinor,
            maxDailyWithdrawalMinor: input.maxDailyWithdrawalMinor ?? withdrawalSettings.maxDailyWithdrawalMinor,
            updatedAt: new Date(),
          },
        })
        .returning();

      return {
        resellerId: row.resellerId,
        autoWithdraw: row.autoWithdraw,
        condition: row.condition as WithdrawalSettings["condition"],
        thresholdAmountMinor: row.thresholdAmountMinor,
        scheduleFrequency: row.scheduleFrequency as WithdrawalSettings["scheduleFrequency"],
        minWithdrawalMinor: row.minWithdrawalMinor,
        maxDailyWithdrawalMinor: row.maxDailyWithdrawalMinor,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    },
  };
}
